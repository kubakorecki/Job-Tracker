import { createClient, type SupabaseClient } from "@supabase/supabase-js";
import { supabaseEnv, supabaseServiceRoleKey } from "../env";
import type { CvMediaType } from "./contract";

/**
 * Where an uploaded CV lives. This is the only module in the app that talks to
 * Supabase Storage, which is what makes it both the swap point for another
 * object store and the substitution point for the endpoint's tests — the same
 * arrangement the extraction provider has.
 *
 * It is also the only module that holds the service role key. Storage puts
 * every object behind Row Level Security on `storage.objects` and this schema
 * has no policies anywhere (ADR-0001), so the key is what makes a private
 * bucket reachable at all — and, like `DATABASE_URL`, it grants everything.
 * Every function therefore takes the owner's id and derives the path from it,
 * exactly as a repository module does, so that one user's CV cannot be written
 * or read under another's name.
 */

/** The private bucket CVs are stored in. Created by hand (docs/setup/supabase.md). */
export const CV_BUCKET = "cvs";

/**
 * How long a signed URL lasts. Long enough to open the document and read it,
 * short enough that a link pasted somewhere by accident is worthless by the
 * time anyone follows it — a page that has been open longer asks for another.
 */
export const CV_URL_TTL_SECONDS = 300;

/** One CV as it arrives, on its way into the bucket. */
export type CvUpload = { bytes: Uint8Array; mediaType: CvMediaType };

/**
 * The store, as everything above it sees one. It names no bucket, no key and
 * no URL scheme; a caller hands over bytes and is told where they went.
 *
 * `put` chooses the path rather than taking one, which is what makes "the file
 * is never rewritten" a property of the store instead of a rule every caller
 * has to keep: there is no way to ask it to write over something.
 */
export type CvStore = {
  /** Stores one user's CV, and answers where it now lives. */
  put(userId: string, file: CvUpload): Promise<string>;
  /** Takes a stored file away. Used on the one it replaced, never on the current one. */
  remove(userId: string, path: string): Promise<void>;
  /** A short-lived URL for viewing and downloading a stored file. */
  signedUrl(userId: string, path: string): Promise<string>;
};

/** The extension a stored file is given, so a downloaded CV opens in something. */
const EXTENSIONS: Record<CvMediaType, string> = {
  "application/pdf": ".pdf",
  "text/markdown": ".md",
  "text/plain": ".txt",
};

export const supabaseCvStore: CvStore = {
  async put(userId, { bytes, mediaType }) {
    const path = cvPath(userId, mediaType);

    // No `upsert`. A fresh path every time means there is nothing there to
    // overwrite, and the write fails loudly rather than quietly if there ever
    // somehow is — the uploaded file is the truth about the document, and a
    // truth that can be edited in place is not one.
    const { error } = await cvs().upload(path, bytes, {
      contentType: mediaType,
    });

    if (error !== null) {
      throw new Error(`The CV could not be stored: ${error.message}`);
    }

    return path;
  },

  async remove(userId, path) {
    const { error } = await cvs().remove([ownedPath(userId, path)]);

    if (error !== null) {
      throw new Error(`The stored CV could not be removed: ${error.message}`);
    }
  },

  async signedUrl(userId, path) {
    // No `download` option: the same URL has to serve viewing the document and
    // saving it, and `download` would force every visit to be a save. The
    // client that wants a save says so on its own link.
    const { data, error } = await cvs().createSignedUrl(
      ownedPath(userId, path),
      CV_URL_TTL_SECONDS,
    );

    if (error !== null || data === null) {
      throw new Error(
        `No signed URL could be minted for the stored CV: ${error?.message ?? "no URL came back"}`,
      );
    }

    return data.signedUrl;
  },
};

/**
 * Where one user's next CV goes: their own folder, and a name nothing else can
 * take. The random name is not secrecy — the bucket is private and every read
 * is signed — it is what stops an upload from ever landing on the file it is
 * replacing.
 */
function cvPath(userId: string, mediaType: CvMediaType): string {
  return `${userId}/${crypto.randomUUID()}${EXTENSIONS[mediaType]}`;
}

/**
 * The path, having first insisted it is this user's. The service role key
 * bypasses every check Storage would otherwise make, so this is the whole of
 * what keeps one user's request from reaching another's document — the same
 * bargain the repository modules make with the database owner (ADR-0001).
 */
function ownedPath(userId: string, path: string): string {
  if (!path.startsWith(`${userId}/`)) {
    throw new Error("That stored CV belongs to somebody else.");
  }

  return path;
}

let client: SupabaseClient | null = null;

/**
 * The storage client, built on first use rather than at module load, so
 * importing the endpoint — which every test of it does — costs no service key.
 */
function cvs() {
  client ??= createClient(supabaseEnv().url, supabaseServiceRoleKey(), {
    // Nothing here is a signed-in user: the key is the credential, and a
    // persisted session would be the wrong one on the next request.
    auth: { persistSession: false, autoRefreshToken: false },
  });

  return client.storage.from(CV_BUCKET);
}
