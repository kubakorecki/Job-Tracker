import { redirect } from "next/navigation";
import { getCurrentUser } from "../../../lib/auth/current-user";
import { SIGN_IN_PATH } from "../../../lib/auth/route-access";
import { listPersonalAccessTokens } from "../../../lib/personal-access-tokens/repository";
import { SettingsPage } from "../settings-page";
import { PersonalAccessTokens } from "./personal-access-tokens";

export default async function PersonalAccessTokensPage() {
  // The proxy already turned signed-out traffic away; this is the page's own
  // guarantee that `user` is real, and how it learns whose tokens to list.
  const user = await getCurrentUser();
  if (user === null) redirect(SIGN_IN_PATH);

  // Read through the repository, scoped by the user's id (ADR-0001). The list
  // never carries a hash: the repository has no way to hand one out.
  const tokens = await listPersonalAccessTokens(user.id);

  return (
    <SettingsPage
      email={user.email ?? user.id}
      lede="A token lets the browser extension reach your Job Applications without your password. Give each machine its own, and revoke one the moment you lose the machine it lives on."
      title="Personal Access Tokens"
    >
      <PersonalAccessTokens tokens={tokens} />
    </SettingsPage>
  );
}
