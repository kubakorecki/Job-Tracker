import { CreateJobApplication, type JobApplication } from "@repo/schema";
import { afterEach, beforeEach, describe, expect, it } from "vitest";
import {
  AI_USAGE_LIMIT_STATUS,
  MONTHLY_AI_USAGE_LIMIT,
} from "../ai-usage/meter";
import {
  aiUsageSoFar,
  forgetAiUsage,
  setAiUsage,
} from "../ai-usage/repository";
import type { CurrentUser } from "../auth/current-user";
import {
  createJobApplication,
  deleteJobApplication,
} from "../job-applications/repository";
import {
  DAILY_MODEL_CALL_LIMIT,
  MODEL_CALL_LIMIT_STATUS,
} from "../model-calls/budget";
import { forgetModelCalls, setModelCallCount } from "../model-calls/repository";
import { MAX_CV_BYTES } from "../profile/contract";
import type { CvReading, ReadCv } from "../profile/reader";
import type { CvStore, CvUpload } from "../profile/storage";
import { OTHER_TEST_USER, TEST_USER } from "../test-support/users";
import {
  attachTailoredCvResponse,
  detachTailoredCvResponse,
  readTailoredCvResponse,
} from "./api";
import { TailoredCv, TailoredCvOrNone } from "./contract";
import { getTailoredCv } from "./repository";

/**
 * The Tailored CV endpoints as the Job Application page sees them: what
 * attaching one answers with, what it refuses, what happens to the file it
 * replaced, what taking one off leaves behind, and what one user can see of
 * another's.
 *
 * No API key, no bucket and no network. The reader and the store are
 * substituted at the functions the endpoints were built around, and being able
 * to look inside the store is the point: the bucket is where "never rewritten",
 * "the previous file is removed" and "detaching deletes it" are true or not.
 *
 * The Job Application and the attachment are real rows in the real tables
 * (ADR-0003), because one Tailored CV per Job Application, and the cascade that
 * takes it away with its Job Application, are the database's promises rather
 * than the endpoints'. The daily count is real for the same reason.
 */

const JOB_APPLICATIONS = "https://job-tracker.test/api/job-applications";

const cvOf = (id: string) => `${JOB_APPLICATIONS}/${id}/cv`;

/** A CV as a PDF: bytes that are not text, so a copy of them can be recognised. */
const PDF_BYTES = new Uint8Array([
  0x25, 0x50, 0x44, 0x46, 0x2d, 0x31, 0x2e, 0x37, 0x0a, 0xff, 0xfe, 0x00, 0x01,
]);

const CV_TEXT = "Jane Doe\nSenior Engineer\nTypeScript for the Vercel role";

/** Everything this file has written, so it can be taken away again. */
const saved: { userId: string; id: string }[] = [];

/** What the fake reader reports having spent, thinking included. */
const TOKENS = 9_700;

beforeEach(async () => {
  for (const user of [TEST_USER, OTHER_TEST_USER]) {
    await forgetModelCalls(user.id);
    await forgetAiUsage(user.id);
  }
});

afterEach(async () => {
  // Taking the Job Application away takes its Tailored CV with it, which is the
  // cascade the schema promises — and what every test here leans on to clear up
  // after itself.
  for (const { userId, id } of saved.splice(0)) {
    await deleteJobApplication(userId, id);
  }
});

/**
 * A stand-in for the model that answers as the test says, and keeps what it was
 * asked. An `Error` means the provider could not be reached or understood; an
 * empty text means the file held no text, which is the reader's other real
 * answer.
 */
type FakeReader = { read: ReadCv; asked: CvUpload[] };

function reading(reply: string | Error): FakeReader {
  const asked: CvUpload[] = [];
  const answer: CvReading | Error =
    reply instanceof Error ? reply : { text: reply, skills: ["TypeScript"] };

  return {
    asked,
    read: async (file) => {
      asked.push(file);
      if (answer instanceof Error) throw answer;
      return { answer, tokens: TOKENS };
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

/** A Job Application to attach a CV to. */
async function save(
  user: CurrentUser,
  company = "Vercel",
): Promise<JobApplication> {
  // Through the contract rather than around it, so the row this writes is the
  // row the endpoint would have written — the defaults a client never sends are
  // the schema's to fill in.
  const created = await createJobApplication(
    user.id,
    CreateJobApplication.parse({
      company,
      jobTitle: "Platform Engineer",
      requirements: [],
    }),
  );

  saved.push({ userId: user.id, id: created.id });
  return created;
}

async function attach(
  user: CurrentUser,
  id: string,
  file: File | undefined,
  {
    reader = reading(CV_TEXT),
    store = bucket(),
  }: { reader?: FakeReader; store?: FakeStore } = {},
): Promise<Response> {
  const body = new FormData();
  if (file !== undefined) body.set("file", file);

  return attachTailoredCvResponse(reader.read, store)(
    new Request(cvOf(id), { method: "POST", body }),
    user,
    { id },
  );
}

async function read(
  user: CurrentUser,
  id: string,
  store: FakeStore,
): Promise<Response> {
  return readTailoredCvResponse(store)(new Request(cvOf(id)), user, { id });
}

async function detach(
  user: CurrentUser,
  id: string,
  store: FakeStore,
): Promise<Response> {
  return detachTailoredCvResponse(store)(
    new Request(cvOf(id), { method: "DELETE" }),
    user,
    { id },
  );
}

/** The body, having first insisted it is the shape the contract promises. */
async function tailoredCvOf(response: Response): Promise<TailoredCv> {
  return TailoredCv.parse(await response.json());
}

async function problemsOf(response: Response): Promise<string> {
  const { error, issues } = await response.json();
  return [error, ...(issues ?? [])].join(" ");
}

describe("attaching a Tailored CV", () => {
  it("stores the file as it arrived and answers with what is attached", async () => {
    const store = bucket();
    const reader = reading(CV_TEXT);
    const { id } = await save(TEST_USER);

    const response = await attach(
      TEST_USER,
      id,
      cvFile("tailored-vercel.pdf", "application/pdf"),
      { reader, store },
    );

    expect(response.status).toBe(200);

    const attached = await tailoredCvOf(response);
    expect(attached.fileName).toBe("tailored-vercel.pdf");
    expect(attached.mediaType).toBe("application/pdf");
    expect(attached.extractedText).toBe(CV_TEXT);
    expect(attached.fileUrl).toContain("token=signed");

    // Byte for byte: the file is the truth about what was sent, so what reached
    // the bucket has to be what left the browser.
    const [path] = store.written;
    expect(store.stored.get(path!)?.file.bytes).toEqual(PDF_BYTES);
    expect(reader.asked).toHaveLength(1);
  });

  it("attaches to the Job Application rather than to the user", async () => {
    const store = bucket();
    const vercel = await save(TEST_USER);
    const linear = await save(TEST_USER, "Linear");

    await attach(TEST_USER, vercel.id, cvFile("vercel.md", "text/markdown"), {
      store,
    });

    // The other Job Application is untouched: there is one CV per Job
    // Application, not one per user, which is the whole difference from the
    // Profile.
    const other = await read(TEST_USER, linear.id, store);
    expect(await other.json()).toBeNull();
    expect(await getTailoredCv(TEST_USER.id, vercel.id)).not.toBeNull();
  });

  it("replaces the document and takes the old file away", async () => {
    const store = bucket();
    const { id } = await save(TEST_USER);

    await attach(TEST_USER, id, cvFile("first.pdf", "application/pdf"), {
      store,
    });
    const first = store.written[0]!;

    const response = await attach(
      TEST_USER,
      id,
      cvFile("second.pdf", "application/pdf"),
      { store },
    );

    expect((await tailoredCvOf(response)).fileName).toBe("second.pdf");
    // Never rewritten in place, and the one it replaced is gone.
    expect(store.written).toHaveLength(2);
    expect(store.removed).toEqual([first]);
    expect(store.stored.has(first)).toBe(false);
  });

  it("refuses a file that is not a CV, and stores nothing", async () => {
    const store = bucket();
    const reader = reading(CV_TEXT);
    const { id } = await save(TEST_USER);

    const response = await attach(
      TEST_USER,
      id,
      cvFile("offer.docx", "application/vnd.openxmlformats"),
      { reader, store },
    );

    expect(response.status).toBe(415);
    expect(await problemsOf(response)).toContain("offer.docx");
    // Refused before anything is spent: no reading, no file, no row.
    expect(reader.asked).toHaveLength(0);
    expect(store.written).toHaveLength(0);
    expect(await getTailoredCv(TEST_USER.id, id)).toBeNull();
  });

  it("refuses a CV that is too large", async () => {
    const { id } = await save(TEST_USER);
    const store = bucket();

    const response = await attach(
      TEST_USER,
      id,
      cvFile("huge.txt", "text/plain", "x".repeat(MAX_CV_BYTES + 1)),
      { store },
    );

    expect(response.status).toBe(413);
    expect(store.written).toHaveLength(0);
  });

  it("refuses a request carrying no file", async () => {
    const { id } = await save(TEST_USER);

    const response = await attach(TEST_USER, id, undefined);

    expect(response.status).toBe(400);
  });

  it("refuses a document nothing could be read out of, and attaches nothing", async () => {
    const store = bucket();
    const { id } = await save(TEST_USER);

    const response = await attach(
      TEST_USER,
      id,
      cvFile("scan.pdf", "application/pdf"),
      { reader: reading(""), store },
    );

    expect(response.status).toBe(422);
    expect(await problemsOf(response)).toContain("cleaner copy");
    expect(await getTailoredCv(TEST_USER.id, id)).toBeNull();
  });

  it("leaves what is attached alone when the reader cannot be reached", async () => {
    const store = bucket();
    const { id } = await save(TEST_USER);

    await attach(TEST_USER, id, cvFile("good.pdf", "application/pdf"), {
      store,
    });

    const response = await attach(
      TEST_USER,
      id,
      cvFile("next.pdf", "application/pdf"),
      { reader: reading(new Error("no")), store },
    );

    expect(response.status).toBe(502);
    // The failed attempt wrote nothing and removed nothing: what was attached
    // before it is still attached, and its file is still there.
    expect(store.written).toHaveLength(1);
    expect(store.removed).toHaveLength(0);
    const row = await getTailoredCv(TEST_USER.id, id);
    expect(row?.fileName).toBe("good.pdf");
  });

  it("spends one model call, and refuses once the day's are gone", async () => {
    const { id } = await save(TEST_USER);

    await setModelCallCount(TEST_USER.id, DAILY_MODEL_CALL_LIMIT - 1);

    expect(
      (await attach(TEST_USER, id, cvFile("a.pdf", "application/pdf"))).status,
    ).toBe(200);

    const reader = reading(CV_TEXT);
    const response = await attach(
      TEST_USER,
      id,
      cvFile("b.pdf", "application/pdf"),
      { reader },
    );

    expect(response.status).toBe(MODEL_CALL_LIMIT_STATUS);
    expect(reader.asked).toHaveLength(0);
  });

  it("is a 404 on somebody else's Job Application", async () => {
    const store = bucket();
    const { id } = await save(TEST_USER);

    const response = await attach(
      OTHER_TEST_USER,
      id,
      cvFile("theirs.pdf", "application/pdf"),
      { store },
    );

    expect(response.status).toBe(404);
    expect(store.written).toHaveLength(0);
    expect(await getTailoredCv(TEST_USER.id, id)).toBeNull();
  });

  it("is a 404 for an id that could never be a Job Application", async () => {
    expect(
      (
        await attach(
          TEST_USER,
          "not-a-uuid",
          cvFile("a.pdf", "application/pdf"),
        )
      ).status,
    ).toBe(404);
  });
});

describe("reading the Tailored CV", () => {
  it("answers null where none is attached", async () => {
    const store = bucket();
    const { id } = await save(TEST_USER);

    const response = await read(TEST_USER, id, store);

    expect(response.status).toBe(200);
    expect(TailoredCvOrNone.parse(await response.json())).toBeNull();
  });

  it("mints a fresh link every time it is read", async () => {
    const store = bucket();
    const { id } = await save(TEST_USER);
    await attach(TEST_USER, id, cvFile("cv.md", "text/markdown"), { store });

    const response = await read(TEST_USER, id, store);

    const attached = await tailoredCvOf(response);
    expect(attached.fileName).toBe("cv.md");
    expect(attached.fileUrl).toContain("token=signed");
  });

  it("does not confirm a stranger's Job Application is real", async () => {
    const store = bucket();
    const { id } = await save(TEST_USER);
    await attach(TEST_USER, id, cvFile("cv.md", "text/markdown"), { store });

    expect((await read(OTHER_TEST_USER, id, store)).status).toBe(404);
  });
});

describe("taking the Tailored CV off", () => {
  it("removes the row and the file, leaving the Profile to stand in", async () => {
    const store = bucket();
    const { id } = await save(TEST_USER);
    await attach(TEST_USER, id, cvFile("cv.pdf", "application/pdf"), { store });
    const path = store.written[0]!;

    const response = await detach(TEST_USER, id, store);

    expect(response.status).toBe(204);
    expect(store.removed).toEqual([path]);
    expect(await getTailoredCv(TEST_USER.id, id)).toBeNull();
  });

  it("is a 404 when there is nothing attached", async () => {
    const store = bucket();
    const { id } = await save(TEST_USER);

    const response = await detach(TEST_USER, id, store);

    expect(response.status).toBe(404);
    expect(store.removed).toHaveLength(0);
  });

  it("is a 404 on somebody else's, and leaves their file alone", async () => {
    const store = bucket();
    const { id } = await save(TEST_USER);
    await attach(TEST_USER, id, cvFile("cv.pdf", "application/pdf"), { store });

    expect((await detach(OTHER_TEST_USER, id, store)).status).toBe(404);
    expect(store.removed).toHaveLength(0);
    expect(await getTailoredCv(TEST_USER.id, id)).not.toBeNull();
  });
});

describe("the Job Application it hangs off", () => {
  it("takes its Tailored CV with it when it is deleted", async () => {
    const store = bucket();
    const { id } = await save(TEST_USER);
    await attach(TEST_USER, id, cvFile("cv.pdf", "application/pdf"), { store });

    await deleteJobApplication(TEST_USER.id, id);
    saved.splice(0);

    // The row goes by cascade. The file does not — nothing in the delete path
    // knows about the bucket, and an unreferenced object is the honest cost of
    // that, worth recording here rather than discovering later.
    expect(await getTailoredCv(TEST_USER.id, id)).toBeNull();
    expect(store.removed).toHaveLength(0);
  });
});

describe("the month's AI Usage", () => {
  it("records what a reading cost, thinking included", async () => {
    const { id } = await save(TEST_USER);
    await attach(TEST_USER, id, cvFile("a.pdf", "application/pdf"));

    expect(await aiUsageSoFar(TEST_USER.id)).toBe(TOKENS);
  });

  it("records nothing for a reading that never reached the provider", async () => {
    const { id } = await save(TEST_USER);
    await attach(TEST_USER, id, cvFile("a.pdf", "application/pdf"), {
      reader: reading(new Error("503")),
    });

    // The Model Call is spent — it is charged before the provider is reached —
    // and AI Usage is not, because the provider never said what it cost
    // (ADR-0009).
    expect(await aiUsageSoFar(TEST_USER.id)).toBe(0);
  });

  it("refuses the attachment once the month is spent, and reads nothing", async () => {
    await setAiUsage(TEST_USER.id, MONTHLY_AI_USAGE_LIMIT);
    const { id } = await save(TEST_USER);
    const reader = reading(CV_TEXT);

    const response = await attach(
      TEST_USER,
      id,
      cvFile("a.pdf", "application/pdf"),
      { reader },
    );

    expect(response.status).toBe(AI_USAGE_LIMIT_STATUS);
    expect(reader.asked).toEqual([]);
  });
});
