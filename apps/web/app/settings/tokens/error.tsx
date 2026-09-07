"use client";

import { SettingsPage } from "../settings-page";
import { Failure } from "../../states";

/**
 * The Personal Access Tokens could not be read. The way back to the board is
 * kept: a user who came here to set up the extension and found the page broken
 * should not have to type a URL to leave.
 */
export default function PersonalAccessTokensError({
  retry,
}: {
  retry: () => void;
}) {
  return (
    <SettingsPage title="Personal Access Tokens">
      <Failure onRetry={retry} what="your Personal Access Tokens" />
    </SettingsPage>
  );
}
