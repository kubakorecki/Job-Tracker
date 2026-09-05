import type { CurrentUser } from "../auth/current-user";
import {
  forgetProfile,
  replaceProfileCv,
  setProfileSkills,
} from "../profile/repository";

/**
 * A Profile for the tests that need one to compare against but are not about
 * uploading a CV. The Profile endpoints are tested where they live; what a
 * test of Coverage needs is a user with a skill list, and the shortest honest
 * way to one is the two writes an upload and an acceptance would have made.
 *
 * No bucket is touched: the stored path is the only thing a Profile row knows
 * about the file, and nothing that reads a skill list ever follows it.
 */
export async function giveProfileSkills(
  user: CurrentUser,
  skills: string[],
): Promise<void> {
  await replaceProfileCv(user.id, {
    storagePath: `${user.id}/test-cv.md`,
    fileName: "cv.md",
    mediaType: "text/markdown",
    extractedText: skills.join(", "),
  });
  await setProfileSkills(user.id, skills);
}

/** Leaves the users named without a Profile, as most users are. */
export async function forgetTestProfiles(
  ...users: CurrentUser[]
): Promise<void> {
  for (const user of users) await forgetProfile(user.id);
}
