"use client";

import { SettingsPage } from "../settings-page";
import { Failure } from "../../states";

/**
 * The Profile could not be read. Reading one is a query and a signed URL, so
 * this is as likely to be the store as the database — either way the CV is
 * still there, and asking again is the whole of what there is to do.
 *
 * The way back to the board is kept, so a user who found this page broken does
 * not have to type a URL to leave.
 */
export default function ProfileError({ retry }: { retry: () => void }) {
  return (
    <SettingsPage title="Your Profile">
      <Failure onRetry={retry} what="your Profile" />
    </SettingsPage>
  );
}
