import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { CurrentUser } from "../auth/current-user";
import {
  DAILY_MODEL_CALL_LIMIT,
  MODEL_CALL_LIMIT_STATUS,
} from "../model-calls/budget";
import { forgetModelCalls, setModelCallCount } from "../model-calls/repository";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import {
  readProfileResponse,
  setProfileSkillsResponse,
  uploadProfileResponse,
} from "./api";
import {
  MAX_CV_BYTES,
  Profile,
  ProfileOrNone,
  ProfileSkills,
  SKILL_LIST_LIMIT,
  UploadedCv,
} from "./contract";
import type { CvReading, ReadCv } from "./reader";
import { forgetProfile, getProfile } from "./repository";
import type { CvStore, CvUpload } from "./storage";

/**
 * The Profile endpoints as the dashboard sees them: what an upload answers
 * with, what it refuses, what happens to the file it replaced, and what one
 * user can see of another's.
 *
 * No API key, no bucket and no network. The reader is substituted at the
 * function the endpoint was built around — a fake standing in for Gemini also
 * lets the test read what it was handed, which is how "stored byte-for-byte"
 * is asserted without reaching into a bucket. The store is substituted the
 * same way, and being able to look inside it is the point: the bucket is where
 * "never rewritten" and "the previous file is removed" are true or not.
 *
 * The Profile itself is a real row in the real table, cleared around each
 * test, because one per user is the database's promise rather than the
 * endpoint's. The daily budget is real for the same reason; what that budget
 * is and how it is spent lives in `lib/model-calls`, tested there.
 */

const ENDPOINT = "https://job-tracker.test/api/profile";
const SKILLS_ENDPOINT = `${ENDPOINT}/skills`;

/** A CV as a PDF: bytes that are not text, so a copy of them can be recognised. */
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0xff, 0xfe, 0x00, 0x01,
]);

const CV_TEXT = "Jane Doe\nSenior Engineer\nTypeScript, Postgres, Terraform";

/** What the model proposes from that CV, until a test says otherwise. */
const CV_SKILLS = ["TypeScript", "Postgres", "Terraform"];

beforeEach(clear);
afterAll(clear);

async function clear(): Promise<void> {
  for (const user of [TEST_USER, OTHER_TEST_USER]) {
    await forgetProfile(user.id);
    await forgetModelCalls(user.id);
  }
}

/**
 * A stand-in for the model that answers as the test says, and keeps what it
 * was asked. An `Error` means the provider could not be reached or understood;
 * an empty text means the file held no text, which is the reader's other real
 * answer.
 */
type FakeReader = { read: ReadCv; asked: CvUpload[] };

function reading(
  reply: string | Error,
  skills: string[] = CV_SKILLS,
): FakeReader {
  const asked: CvUpload[] = [];
  const answer: CvReading | Error =
    reply instanceof Error ? reply : { text: reply, skills };

  return {
    asked,
    read: async (file) => {
      asked.push(file);
      if (answer instanceof Error) throw answer;
      return answer;
    },
  };
}

/**
 * A stand-in for the bucket. It keeps every path it was ever given a file for,
 * so a test can ask not only what is stored now but whether anything was ever
 * written over — which is the promise the real store makes by never reusing a
 * path.
 */
type FakeStore = CvStore & {
  stored: Map<string, { userId: string; file: CvUpload }>;
  written: string[];
  removed: string[];
};

function bucket(): FakeStore {
  const stored = new Map<string, { userId: string; file: CvUpload }>();
  const written: string[] = [];
  const removed: string[] = [];

  return {
    stored,
    written,
    removed,
    put: async (userId, file) => {
      const path = `${userId}/${written.length + 1}`;
      stored.set(path, { userId, file });
      written.push(path);
      return path;
    },
    remove: async (_userId, path) => {
      stored.delete(path);
      removed.push(path);
    },
    signedUrl: async (_userId, path) =>
      `https://storage.test/${path}?token=signed`,
  };
}

function cvFile(
  name: string,
  type: string,
  content: Uint8Array | string = PDF_BYTES,
): File {
  return new File([content as BlobPart], name, { type });
}

async function upload(
  user: CurrentUser,
  file: File | undefined,
  {
    reader = reading(CV_TEXT),
    store = bucket(),
  }: { reader?: FakeReader; store?: FakeStore } = {},
): Promise<Response> {
  const body = new FormData();
  if (file !== undefined) body.set("file", file);

  return uploadProfileResponse(reader.read, store)(
    new Request(ENDPOINT, { method: "POST", body }),
    user,
  );
}

async function read(user: CurrentUser, store: FakeStore): Promise<Response> {
  return readProfileResponse(store)(new Request(ENDPOINT), user);
}

/** The body, having first insisted it is the shape the contract promises. */
async function profileOf(response: Response): Promise<Profile> {
  return Profile.parse(await response.json());
}

async function uploadedOf(response: Response): Promise<UploadedCv> {
  return UploadedCv.parse(await response.json());
}

async function skillsOf(response: Response): Promise<string[]> {
  return ProfileSkills.parse(await response.json()).skills;
}

/**
 * The user saying what their skill list should be — accepting a Draft they may
 * have corrected first, or editing the list they accepted weeks ago. One
 * request for both, because a list is a list however it was arrived at.
 */
async function setSkills(user: CurrentUser, body: unknown): Promise<Response> {
  return setProfileSkillsResponse(
    new Request(SKILLS_ENDPOINT, {
      method: "PUT",
      body: JSON.stringify(body),
    }),
    user,
  );
}

/** The Profile as it now stands, skills and all. */
async function profileNow(
  user: CurrentUser,
  store: FakeStore,
): Promise<Profile> {
  return profileOf(await read(user, store));
}

async function profileOrNoneOf(response: Response): Promise<ProfileOrNone> {
  return ProfileOrNone.parse(await response.json());
}

describe("POST /api/profile", () => {
  it("answers with the Profile the uploaded CV became", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("jane-doe-cv.pdf", "application/pdf"),
    );

    expect(response.status).toBe(200);
    expect((await uploadedOf(response)).profile).toMatchObject({
      fileName: "jane-doe-cv.pdf",
      mediaType: "application/pdf",
      extractedText: CV_TEXT,
    });
  });

  it("stores the file byte for byte, exactly as it was uploaded", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });

    const [only] = [...store.stored.values()];
    expect(only?.file.bytes).toEqual(PDF_BYTES);
    expect(only?.file.mediaType).toBe("application/pdf");
  });

  it("hands the reader the same bytes it stored", async () => {
    const reader = reading(CV_TEXT);
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { reader });

    expect(reader.asked).toEqual([
      { bytes: PDF_BYTES, mediaType: "application/pdf" },
    ]);
  });

  it("keeps the extracted text beside the file, for an Analysis to read", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });

    expect((await profileNow(TEST_USER, store)).extractedText).toBe(CV_TEXT);
  });

  it("accepts a Markdown CV", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("cv.md", "text/markdown", "# Jane Doe"),
    );

    expect(response.status).toBe(200);
    expect((await uploadedOf(response)).profile.mediaType).toBe(
      "text/markdown",
    );
  });

  it("accepts a plain text CV", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("cv.txt", "text/plain", "Jane Doe"),
    );

    expect(response.status).toBe(200);
    expect((await uploadedOf(response)).profile.mediaType).toBe("text/plain");
  });

  it("accepts a Markdown CV a browser declared as nothing at all", async () => {
    // `.md` reaches a request as text/markdown, as text/plain or as an empty
    // type depending on the browser and the machine.
    const response = await upload(TEST_USER, cvFile("cv.md", "", "# Jane Doe"));

    expect(response.status).toBe(200);
    expect((await uploadedOf(response)).profile.mediaType).toBe(
      "text/markdown",
    );
  });

  it("answers with a short-lived signed URL for viewing and downloading the file", async () => {
    const store = bucket();
    const response = await upload(
      TEST_USER,
      cvFile("cv.pdf", "application/pdf"),
      {
        store,
      },
    );

    const { fileUrl } = (await uploadedOf(response)).profile;
    expect(fileUrl).toBe(
      `https://storage.test/${store.written[0]}?token=signed`,
    );
  });
});

describe("a file the Profile will not take", () => {
  it("refuses a media type it does not accept, naming the ones it does", async () => {
    const response = await upload(
      TEST_USER,
      cvFile(
        "cv.docx",
        "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      ),
    );

    expect(response.status).toBe(415);

    const { error } = await response.json();
    expect(error).toContain("PDF");
    expect(error).toContain("Markdown");
    expect(error).toContain("plain text");
  });

  it("refuses a file whose extension is no CV either", async () => {
    const response = await upload(TEST_USER, cvFile("cv.exe", ""));

    expect(response.status).toBe(415);
  });

  it("stores nothing and asks nothing of the model for a file it refused", async () => {
    const reader = reading(CV_TEXT);
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.docx", "application/msword"), {
      reader,
      store,
    });

    expect(reader.asked).toEqual([]);
    expect(store.written).toEqual([]);
  });

  it("leaves an existing Profile alone when it refuses the next upload", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });
    await upload(TEST_USER, cvFile("cv.docx", "application/msword"), { store });

    expect((await profileNow(TEST_USER, store)).fileName).toBe("cv.pdf");
  });

  it("refuses a CV larger than it will take", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("cv.pdf", "application/pdf", new Uint8Array(MAX_CV_BYTES + 1)),
    );

    expect(response.status).toBe(413);
  });

  it("refuses a request carrying no file at all", async () => {
    const response = await upload(TEST_USER, undefined);

    expect(response.status).toBe(400);
  });
});

describe("a file that cannot be read", () => {
  it("tells the user to upload a cleaner copy", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("scan.pdf", "application/pdf"),
      {
        reader: reading(""),
      },
    );

    expect(response.status).toBe(422);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("cleaner copy"),
    });
  });

  it("stores nothing, so an unreadable file leaves no trace in the bucket", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("scan.pdf", "application/pdf"), {
      reader: reading(""),
      store,
    });

    expect(store.written).toEqual([]);
  });

  it("leaves an existing Profile and its file exactly as they were", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("good.pdf", "application/pdf"), { store });
    const before = await profileNow(TEST_USER, store);

    await upload(TEST_USER, cvFile("scan.pdf", "application/pdf"), {
      reader: reading(""),
      store,
    });

    expect(await profileNow(TEST_USER, store)).toEqual(before);
    expect(store.removed).toEqual([]);
  });

  it("answers a provider failure differently, because the file was not the problem", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("cv.pdf", "application/pdf"),
      {
        reader: reading(new Error("503 Service Unavailable")),
      },
    );

    expect(response.status).toBe(502);
  });

  it("leaves an existing Profile untouched when the provider fails", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("good.pdf", "application/pdf"), { store });

    await upload(TEST_USER, cvFile("next.pdf", "application/pdf"), {
      reader: reading(new Error("503")),
      store,
    });

    expect((await profileNow(TEST_USER, store)).fileName).toBe("good.pdf");
    expect(store.stored.size).toBe(1);
  });
});

describe("replacing the CV", () => {
  it("answers with the new file and its text", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("old.pdf", "application/pdf"), { store });

    const response = await upload(
      TEST_USER,
      cvFile("new.pdf", "application/pdf"),
      { reader: reading("Jane Doe, later"), store },
    );

    expect((await uploadedOf(response)).profile).toMatchObject({
      fileName: "new.pdf",
      extractedText: "Jane Doe, later",
    });
  });

  it("takes the previous file out of the bucket", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("old.pdf", "application/pdf"), { store });
    const [first] = store.written;

    await upload(TEST_USER, cvFile("new.pdf", "application/pdf"), { store });

    expect(store.removed).toEqual([first]);
    expect([...store.stored.keys()]).toEqual([store.written[1]]);
  });

  it("writes the replacement to a path of its own rather than over the old one", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });

    expect(new Set(store.written).size).toBe(store.written.length);
  });

  it("moves the upload stamp on to the CV that is there now", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("old.pdf", "application/pdf"), { store });
    const first = await profileNow(TEST_USER, store);

    await upload(TEST_USER, cvFile("new.pdf", "application/pdf"), { store });
    const second = await profileNow(TEST_USER, store);

    expect(Date.parse(second.uploadedAt)).toBeGreaterThan(
      Date.parse(first.uploadedAt),
    );
  });

  it("moves the stamp an Analysis reads to know the Profile has changed", async () => {
    // The one assertion here that reaches past the response, because nothing
    // reads `updatedAt` yet — the Analysis that will is a later ticket, and a
    // stamp that silently stopped moving would leave it reading a CV that no
    // longer exists and calling itself current.
    const store = bucket();
    await upload(TEST_USER, cvFile("old.pdf", "application/pdf"), { store });
    const first = await getProfile(TEST_USER.id);

    await upload(TEST_USER, cvFile("new.pdf", "application/pdf"), { store });
    const second = await getProfile(TEST_USER.id);

    expect(second?.updatedAt.getTime()).toBeGreaterThan(
      first?.updatedAt.getTime() ?? Infinity,
    );
  });

  it("leaves the user with exactly one Profile, however many times they upload", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("one.pdf", "application/pdf"), { store });
    await upload(TEST_USER, cvFile("two.pdf", "application/pdf"), { store });
    await upload(TEST_USER, cvFile("three.pdf", "application/pdf"), { store });

    expect((await profileNow(TEST_USER, store)).fileName).toBe("three.pdf");
    expect(store.stored.size).toBe(1);
  });
});

describe("GET /api/profile", () => {
  it("answers with nothing for a user who has never uploaded a CV", async () => {
    const response = await read(TEST_USER, bucket());

    expect(response.status).toBe(200);
    expect(await profileOrNoneOf(response)).toBeNull();
  });

  it("mints a fresh signed URL on every read, rather than keeping one", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });

    let minted = 0;
    const counting: FakeStore = {
      ...store,
      signedUrl: async (userId, path) => {
        minted += 1;
        return store.signedUrl(userId, path);
      },
    };

    await read(TEST_USER, counting);
    await read(TEST_USER, counting);

    expect(minted).toBe(2);
  });
});

describe("a user only ever reaches their own Profile", () => {
  it("does not show one user the other's CV", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("mine.pdf", "application/pdf"), { store });

    expect(
      await profileOrNoneOf(await read(OTHER_TEST_USER, store)),
    ).toBeNull();
  });

  it("keeps one Profile per user, each with its own file", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("mine.pdf", "application/pdf"), { store });
    await upload(OTHER_TEST_USER, cvFile("theirs.pdf", "application/pdf"), {
      store,
    });

    expect((await profileNow(TEST_USER, store)).fileName).toBe("mine.pdf");
    expect((await profileNow(OTHER_TEST_USER, store)).fileName).toBe(
      "theirs.pdf",
    );
    expect(store.stored.size).toBe(2);
  });

  it("does not remove another user's file when one of them replaces theirs", async () => {
    const store = bucket();
    await upload(OTHER_TEST_USER, cvFile("theirs.pdf", "application/pdf"), {
      store,
    });
    await upload(TEST_USER, cvFile("mine.pdf", "application/pdf"), { store });
    await upload(TEST_USER, cvFile("mine-again.pdf", "application/pdf"), {
      store,
    });

    expect(store.removed).toEqual([store.written[1]]);
    expect((await profileNow(OTHER_TEST_USER, store)).fileName).toBe(
      "theirs.pdf",
    );
  });

  it("stores each user's CV under their own id", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });

    for (const [path, { userId }] of store.stored) {
      expect(userId).toBe(TEST_USER.id);
      expect(path.startsWith(`${TEST_USER.id}/`)).toBe(true);
    }
  });
});

describe("the daily model call budget", () => {
  it("spends one model call per upload", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT - 2);

    expect(
      (await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"))).status,
    ).toBe(200);
    expect(
      (await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"))).status,
    ).toBe(200);
    expect(
      (await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"))).status,
    ).toBe(MODEL_CALL_LIMIT_STATUS);
  });

  it("refuses the upload once the day's allowance is spent, and reads nothing", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);
    const reader = reading(CV_TEXT);
    const store = bucket();

    const response = await upload(
      TEST_USER,
      cvFile("cv.pdf", "application/pdf"),
      { reader, store },
    );

    expect(response.status).toBe(429);
    expect(reader.asked).toEqual([]);
    expect(store.written).toEqual([]);
  });

  it("spends nothing on a file it refused before ever reaching the model", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT - 1);
    await upload(TEST_USER, cvFile("cv.docx", "application/msword"));

    // The one remaining model call is still there to spend.
    expect(
      (await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"))).status,
    ).toBe(200);
  });

  it("counts each user's uploads separately", async () => {
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);

    expect(
      (await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"))).status,
    ).toBe(MODEL_CALL_LIMIT_STATUS);
    expect(
      (await upload(OTHER_TEST_USER, cvFile("cv.pdf", "application/pdf")))
        .status,
    ).toBe(200);
  });
});

describe("the skill list a reading proposes", () => {
  it("answers an upload with the skills the model proposed", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("cv.pdf", "application/pdf"),
    );

    expect((await uploadedOf(response)).proposedSkills).toEqual(CV_SKILLS);
  });

  it("proposes skills from a text CV as well as a PDF", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("cv.md", "text/markdown", "# Jane Doe"),
      { reader: reading("# Jane Doe", ["Kubernetes"]) },
    );

    expect((await uploadedOf(response)).proposedSkills).toEqual(["Kubernetes"]);
  });

  it("does not make them the Profile's, because nobody has accepted them", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });

    expect((await profileNow(TEST_USER, store)).skills).toEqual([]);
  });

  it("tidies the proposal before showing it, so a review is not of duplicates", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("cv.pdf", "application/pdf"),
      { reader: reading(CV_TEXT, ["TypeScript", " typescript ", "", "Go"]) },
    );

    expect((await uploadedOf(response)).proposedSkills).toEqual([
      "TypeScript",
      "Go",
    ]);
  });

  it("drops a proposed skill the accept request would have been refused for", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("cv.pdf", "application/pdf"),
      { reader: reading(CV_TEXT, ["Go", "x".repeat(121)]) },
    );

    // What is shown for review is what accepting it would keep, so the user
    // cannot be handed a list that bounces when they say yes to it.
    const { proposedSkills } = await uploadedOf(response);
    expect(proposedSkills).toEqual(["Go"]);
    expect(
      await skillsOf(await setSkills(TEST_USER, { skills: proposedSkills })),
    ).toEqual(["Go"]);
  });

  it("proposes nothing when the model named nothing, which is a reading like any other", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("cv.pdf", "application/pdf"),
      { reader: reading(CV_TEXT, []) },
    );

    expect(response.status).toBe(200);
    expect((await uploadedOf(response)).proposedSkills).toEqual([]);
  });
});

describe("accepting a proposed skill list", () => {
  it("makes what the user confirmed the Profile's skill list", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });

    const response = await setSkills(TEST_USER, { skills: CV_SKILLS });

    expect(response.status).toBe(200);
    expect(await skillsOf(response)).toEqual(CV_SKILLS);
    expect((await profileNow(TEST_USER, store)).skills).toEqual(CV_SKILLS);
  });

  it("takes the list the user confirmed, not the one that was proposed", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });

    // The user struck one out, corrected another and added one of their own.
    await setSkills(TEST_USER, {
      skills: ["TypeScript", "PostgreSQL", "German"],
    });

    expect((await profileNow(TEST_USER, store)).skills).toEqual([
      "TypeScript",
      "PostgreSQL",
      "German",
    ]);
  });

  it("tidies what the user sent, the same way it tidied the proposal", async () => {
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"));

    const response = await setSkills(TEST_USER, {
      skills: ["  Terraform ", "terraform", "Go"],
    });

    expect(await skillsOf(response)).toEqual(["Terraform", "Go"]);
  });

  it("leaves the stored document and its text exactly as they were", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });
    const before = await profileNow(TEST_USER, store);

    await setSkills(TEST_USER, { skills: ["Go"] });
    const after = await profileNow(TEST_USER, store);

    expect(after).toEqual({ ...before, skills: ["Go"] });
    expect(store.written).toHaveLength(1);
    expect(store.removed).toEqual([]);
  });

  it("moves the stamp an Analysis reads, because what it measures against has changed", async () => {
    // As on an upload, this is the one assertion that reaches past the
    // response: nothing reads `updatedAt` yet, and a stamp that did not move
    // for an edited skill list would leave a later Analysis calling itself
    // current about a Profile that has changed underneath it.
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"));
    const before = await getProfile(TEST_USER.id);

    await setSkills(TEST_USER, { skills: ["Go"] });
    const after = await getProfile(TEST_USER.id);

    expect(after?.updatedAt.getTime()).toBeGreaterThan(
      before?.updatedAt.getTime() ?? Infinity,
    );
    expect(after?.uploadedAt.getTime()).toBe(before?.uploadedAt.getTime());
  });

  it("spends no model call, because accepting a reading asks nobody anything", async () => {
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"));
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);

    expect((await setSkills(TEST_USER, { skills: ["Go"] })).status).toBe(200);
  });

  it("refuses a skill list from a user who has no Profile to put one on", async () => {
    const response = await setSkills(TEST_USER, { skills: ["Go"] });

    expect(response.status).toBe(404);
    expect(await response.json()).toMatchObject({
      error: expect.stringContaining("CV"),
    });
  });

  it("refuses a list longer than a Profile may hold", async () => {
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"));

    const response = await setSkills(TEST_USER, {
      skills: Array.from({ length: SKILL_LIST_LIMIT + 1 }, (_, i) => `S${i}`),
    });

    expect(response.status).toBe(400);
  });

  it("refuses a body that is not a skill list at all", async () => {
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"));

    expect((await setSkills(TEST_USER, { skills: "Go" })).status).toBe(400);
    expect((await setSkills(TEST_USER, {})).status).toBe(400);
    expect((await setSkills(TEST_USER, { skills: [42] })).status).toBe(400);
  });

  it("leaves the accepted list alone when it refuses a change", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });
    await setSkills(TEST_USER, { skills: CV_SKILLS });

    await setSkills(TEST_USER, { skills: [42] });

    expect((await profileNow(TEST_USER, store)).skills).toEqual(CV_SKILLS);
  });
});

describe("discarding a proposed skill list", () => {
  it("costs the user nothing but the upload, because nothing was persisted", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), {
      reader: reading(CV_TEXT, ["Fortran", "COBOL"]),
      store,
    });

    // The user read the proposal and closed it. There is nothing to discard.
    expect((await profileNow(TEST_USER, store)).skills).toEqual([]);
  });

  it("leaves a previously accepted list exactly as it was", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });
    await setSkills(TEST_USER, { skills: CV_SKILLS });

    await upload(TEST_USER, cvFile("mangled.pdf", "application/pdf"), {
      reader: reading("Jane D0e", ["J4v4"]),
      store,
    });

    expect((await profileNow(TEST_USER, store)).skills).toEqual(CV_SKILLS);
  });
});

describe("the skill list, once it is the user's", () => {
  it("can be edited at any time, without touching the document", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });
    await setSkills(TEST_USER, { skills: CV_SKILLS });

    await setSkills(TEST_USER, { skills: [...CV_SKILLS, "German"] });

    const profile = await profileNow(TEST_USER, store);
    expect(profile.skills).toEqual([...CV_SKILLS, "German"]);
    expect(profile.fileName).toBe("cv.pdf");
    expect(profile.extractedText).toBe(CV_TEXT);
  });

  it("is replaced whole, so a skill the user removed is gone", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });
    await setSkills(TEST_USER, { skills: CV_SKILLS });

    await setSkills(TEST_USER, { skills: ["TypeScript"] });

    expect((await profileNow(TEST_USER, store)).skills).toEqual(["TypeScript"]);
  });

  it("can be emptied, for a user who would rather list none", async () => {
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"));
    await setSkills(TEST_USER, { skills: CV_SKILLS });

    expect(await skillsOf(await setSkills(TEST_USER, { skills: [] }))).toEqual(
      [],
    );
  });

  it("survives replacing the file until the user says otherwise", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("old.pdf", "application/pdf"), { store });
    await setSkills(TEST_USER, { skills: CV_SKILLS });

    const response = await upload(
      TEST_USER,
      cvFile("new.pdf", "application/pdf"),
      { reader: reading("Jane Doe, later", ["Rust"]), store },
    );

    const uploaded = await uploadedOf(response);
    expect(uploaded.profile.skills).toEqual(CV_SKILLS);
    expect(uploaded.proposedSkills).toEqual(["Rust"]);
  });

  it("is replaced by the fresh Draft when the user accepts that instead", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("old.pdf", "application/pdf"), { store });
    await setSkills(TEST_USER, { skills: CV_SKILLS });

    await upload(TEST_USER, cvFile("new.pdf", "application/pdf"), {
      reader: reading("Jane Doe, later", ["Rust"]),
      store,
    });
    await setSkills(TEST_USER, { skills: ["Rust"] });

    expect((await profileNow(TEST_USER, store)).skills).toEqual(["Rust"]);
  });

  it("is untouched by a provider failure, and by a spent allowance", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("cv.pdf", "application/pdf"), { store });
    await setSkills(TEST_USER, { skills: CV_SKILLS });

    await upload(TEST_USER, cvFile("next.pdf", "application/pdf"), {
      reader: reading(new Error("503")),
      store,
    });
    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT);
    await upload(TEST_USER, cvFile("next.pdf", "application/pdf"), { store });

    expect(await profileNow(TEST_USER, store)).toMatchObject({
      fileName: "cv.pdf",
      skills: CV_SKILLS,
    });
  });

  it("is one user's own, and not reachable by another", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("mine.pdf", "application/pdf"), { store });
    await setSkills(TEST_USER, { skills: CV_SKILLS });

    // The other user has no Profile of their own, so there is nothing here for
    // them to set — and what they sent lands nowhere near this user's list.
    expect(
      (await setSkills(OTHER_TEST_USER, { skills: ["Rust"] })).status,
    ).toBe(404);
    expect((await profileNow(TEST_USER, store)).skills).toEqual(CV_SKILLS);
  });

  it("stays each user's own when both have one", async () => {
    const store = bucket();
    await upload(TEST_USER, cvFile("mine.pdf", "application/pdf"), { store });
    await upload(OTHER_TEST_USER, cvFile("theirs.pdf", "application/pdf"), {
      store,
    });

    await setSkills(TEST_USER, { skills: ["TypeScript"] });
    await setSkills(OTHER_TEST_USER, { skills: ["Rust"] });

    expect((await profileNow(TEST_USER, store)).skills).toEqual(["TypeScript"]);
    expect((await profileNow(OTHER_TEST_USER, store)).skills).toEqual(["Rust"]);
  });
});
