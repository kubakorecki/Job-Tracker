import { errorResponse } from "../api/response";
import {
  ACCEPTED_CV_FORMATS,
  CV_FIELD,
  CV_TOO_LARGE,
  CvMediaType,
  MAX_CV_BYTES,
} from "./contract";

/**
 * One uploaded CV, on its way in: what a file has to be to be a CV at all, and
 * the refusal it earns when it is not.
 *
 * Its own module because two endpoints take a CV now — the Profile's, and the
 * Tailored CV attached to one Job Application — and what a CV may be is one
 * rule rather than two. The wording is the point: a user who met the same
 * refusal twice in two different sentences would reasonably wonder which of
 * two rules they had broken.
 *
 * It sits under `profile/` with the store and the reader, where the first CV in
 * the product put them. Those three are the CV machinery rather than the
 * Profile's own, and the day a third caller wants them is the day they move to
 * a `lib/cvs` of their own.
 */

/** The file extensions each accepted format is recognised by, failing that. */
const EXTENSION_TYPES: Record<string, CvMediaType> = {
  pdf: "application/pdf",
  md: "text/markdown",
  markdown: "text/markdown",
  txt: "text/plain",
};

/** A CV that has arrived and is allowed to be one: its bytes, and what they are. */
export type ArrivedCv = {
  bytes: Uint8Array;
  mediaType: CvMediaType;
  /** The name it was uploaded under, or one of ours for a file that had none. */
  fileName: string;
};

/**
 * The CV in this request, or the refusal it earned — the `{ refusal }` shape
 * `jsonBody` uses, so an endpoint reads both bodies the same way.
 *
 * Nothing here spends anything: every answer below is reached before a model
 * call, a bucket or a row is touched, which is what makes a file that was never
 * going to be accepted free to have sent.
 */
export async function cvFrom(
  request: Request,
): Promise<{ cv: ArrivedCv } | { refusal: Response }> {
  const form = await formData(request);
  if (form === null) {
    return { refusal: errorResponse("Expected a file upload.", 400) };
  }

  const file = form.get(CV_FIELD);
  if (!(file instanceof File)) {
    return {
      refusal: errorResponse(`Expected a CV in the "${CV_FIELD}" field.`, 400),
    };
  }

  const mediaType = cvMediaTypeOf(file);
  if (mediaType === null) {
    return {
      refusal: errorResponse(`A CV has to be ${ACCEPTED_CV_FORMATS}.`, 415, [
        `${file.name || "That file"} is not one of them.`,
      ]),
    };
  }

  if (file.size > MAX_CV_BYTES) {
    return { refusal: errorResponse(CV_TOO_LARGE, 413) };
  }

  return {
    cv: {
      bytes: new Uint8Array(await file.arrayBuffer()),
      mediaType,
      fileName: fileNameOf(file, mediaType),
    },
  };
}

/**
 * What this file is, if it is a CV at all. The media type the browser declared
 * is believed when it is one of the three, and the file's own extension answers
 * when it is not: a `.md` file reaches a request as `text/markdown`, as
 * `text/plain`, or as nothing at all depending on the browser and the operating
 * system, and a user who exported a CV should not have to know which of those
 * they got.
 *
 * An extension is the fallback rather than the rule because it is the weaker
 * claim of the two — anything can be renamed. Neither is trusted further than
 * this: the reader is handed the bytes, and a file that is not what it says it
 * is comes back with no text.
 */
export function cvMediaTypeOf(file: File): CvMediaType | null {
  const declared = CvMediaType.safeParse(file.type.split(";")[0]?.trim());
  if (declared.success) return declared.data;

  const extension = file.name.split(".").pop()?.toLowerCase() ?? "";
  return EXTENSION_TYPES[extension] ?? null;
}

/** The name to keep, or one of our own for a file that arrived without one. */
function fileNameOf(file: File, mediaType: CvMediaType): string {
  return file.name.trim() === "" ? `cv${extensionOf(mediaType)}` : file.name;
}

function extensionOf(mediaType: CvMediaType): string {
  const named = Object.entries(EXTENSION_TYPES).find(
    ([, type]) => type === mediaType,
  );

  return named === undefined ? "" : `.${named[0]}`;
}

/**
 * The request's form body, or `null` when it carries none. A body that will not
 * parse as a multipart upload is the client's mistake, and is worth saying so
 * before anything else gets a look at it — the same question `jsonBody` asks of
 * the endpoints that take JSON.
 */
async function formData(request: Request): Promise<FormData | null> {
  try {
    return await request.formData();
  } catch {
    return null;
  }
}
