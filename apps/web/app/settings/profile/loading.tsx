import { SettingsPage } from "../settings-page";
import { Loading, Skeleton } from "../../states";

/** The Profile, on its way. */
export default function ProfileLoading() {
  return (
    <SettingsPage title="Your Profile">
      <Loading what="your Profile">
        <Skeleton className="h-[92px] rounded-panel" />
        <Skeleton className="mt-4 h-64 rounded-panel" />
        <Skeleton className="mt-4 h-[188px] rounded-panel" />
      </Loading>
    </SettingsPage>
  );
}
