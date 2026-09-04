import { Loading, Skeleton } from "../../states";

/** The Personal Access Tokens, on their way. */
export default function PersonalAccessTokensLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-12">
      <h1 className="text-2xl font-semibold">Personal Access Tokens</h1>
      <Loading what="your Personal Access Tokens">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-12 w-full" />
      </Loading>
    </main>
  );
}
