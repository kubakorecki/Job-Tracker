import { afterAll, beforeEach, describe, expect, it } from "vitest";
import type { CurrentUser } from "../auth/current-user";
import {
  DAILY_MODEL_CALL_LIMIT,
  MODEL_CALL_LIMIT_STATUS,
} from "../model-calls/budget";
import { forgetModelCalls, setModelCallCount } from "../model-calls/repository";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import {
  MAX_CV_BYTES,
  readProfileResponse,
  uploadProfileResponse,
} from "./api";
import { Profile, ProfileOrNone } from "./contract";
import type { ReadCv } from "./reader";
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

/** A CV as a PDF: bytes that are not text, so a copy of them can be recognised. */
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0xff, 0xfe, 0x00, 0x01,
]);

const CV_TEXT = "Jane Doe\nSenior Engineer\nTypeScript, Postgres, Terraform";

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
 * an empty string means the file held no text, which is the reader's other
 * real answer.
 */
type FakeReader = { read: ReadCv; asked: CvUpload[] };

function reading(reply: string | Error): FakeReader {
  const asked: CvUpload[] = [];

  return {
    asked,
    read: async (file) => {
      asked.push(file);
      if (reply instanceof Error) throw reply;
      return reply;
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
    expect(await profileOf(response)).toMatchObject({
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

    expect((await profileOf(await read(TEST_USER, store))).extractedText).toBe(
      CV_TEXT,
    );
  });

  it("accepts a Markdown CV", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("cv.md", "text/markdown", "# Jane Doe"),
    );

    expect(response.status).toBe(200);
    expect((await profileOf(response)).mediaType).toBe("text/markdown");
  });

  it("accepts a plain text CV", async () => {
    const response = await upload(
      TEST_USER,
      cvFile("cv.txt", "text/plain", "Jane Doe"),
    );

    expect(response.status).toBe(200);
    expect((await profileOf(response)).mediaType).toBe("text/plain");
  });

  it("accepts a Markdown CV a browser declared as nothing at all", async () => {
    // `.md` reaches a request as text/markdown, as text/plain or as an empty
    // type depending on the browser and the machine.
    const response = await upload(TEST_USER, cvFile("cv.md", "", "# Jane Doe"));

    expect(response.status).toBe(200);
    expect((await profileOf(response)).mediaType).toBe("text/markdown");
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

    const { fileUrl } = await profileOf(response);
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

    expect((await profileOf(await read(TEST_USER, store))).fileName).toBe(
      "cv.pdf",
    );
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
    const before = await profileOf(await read(TEST_USER, store));

    await upload(TEST_USER, cvFile("scan.pdf", "application/pdf"), {
      reader: reading(""),
      store,
    });

    expect(await profileOf(await read(TEST_USER, store))).toEqual(before);
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

    expect((await profileOf(await read(TEST_USER, store))).fileName).toBe(
      "good.pdf",
    );
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

    expect(await profileOf(response)).toMatchObject({
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
    const first = await profileOf(await read(TEST_USER, store));

    await upload(TEST_USER, cvFile("new.pdf", "application/pdf"), { store });
    const second = await profileOf(await read(TEST_USER, store));

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

    expect((await profileOf(await read(TEST_USER, store))).fileName).toBe(
      "three.pdf",
    );
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

    expect((await profileOf(await read(TEST_USER, store))).fileName).toBe(
      "mine.pdf",
    );
    expect((await profileOf(await read(OTHER_TEST_USER, store))).fileName).toBe(
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
    expect((await profileOf(await read(OTHER_TEST_USER, store))).fileName).toBe(
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
