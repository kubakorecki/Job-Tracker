import { redirect } from "next/navigation";
import { readAiUsage } from "../../../lib/ai-usage/view";
import { getCurrentUser } from "../../../lib/auth/current-user";
import { SIGN_IN_PATH } from "../../../lib/auth/route-access";
import { readProfile } from "../../../lib/profile/view";
import { SettingsPage } from "../settings-page";
import { AiUsageMeter } from "./ai-usage-meter";
import { YourProfile } from "./profile";

export default async function ProfilePage() {
  // The proxy already turned signed-out traffic away; this is the page's own
  // guarantee that `user` is real, and how it learns whose Profile to read.
  const user = await getCurrentUser();
  if (user === null) redirect(SIGN_IN_PATH);

  // Read through the features rather than through their endpoints: this
  // renders on the server, where an HTTP hop to this app's own API would buy
  // nothing. The user's id is still the argument that scopes both (ADR-0001).
  // From here the page owns the Profile, because an upload answers with more
  // of it than any re-read could.
  //
  // The meter does not work that way: reading a CV spends from it and the
  // answer never says what it cost, so `YourProfile` refreshes the route after
  // an upload and this reads again.
  //
  // Together, because a signed URL and a token count have nothing to say to
  // each other and waiting for them in turn would only be slower.
  const [profile, usage] = await Promise.all([
    readProfile(user.id),
    readAiUsage(user.id),
  ]);

  return (
    <SettingsPage
      email={user.email ?? user.id}
      lede="One master CV, kept as the file you uploaded, and the skills read out of it. This is what every Job Application is measured against."
      title="Your Profile"
    >
      <YourProfile profile={profile} />

      {/* Last, because it is the record of what the page above it has spent
          rather than something to do: the CV is what the user came here for,
          and AI Usage is where they find out where they stand before starting
          something long. */}
      <AiUsageMeter usage={usage} />
    </SettingsPage>
  );
}
