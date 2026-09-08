import { SettingsPage } from "../settings-page";
import { Loading, Skeleton } from "../../states";

/** The Personal Access Tokens, on their way. */
export default function PersonalAccessTokensLoading() {
  return (
    <SettingsPage title="Personal Access Tokens">
      <Loading what="your Personal Access Tokens">
        <Skeleton className="h-[92px] rounded-panel" />
        <Skeleton className="mt-4 h-40 rounded-panel" />
      </Loading>
    </SettingsPage>
  );
}
