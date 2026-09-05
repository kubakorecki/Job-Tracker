import { Loading, Skeleton } from "../../states";

/** The Profile, on its way. */
export default function ProfileLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-12">
      <h1 className="text-2xl font-semibold">Your Profile</h1>
      <Loading what="your Profile">
        <Skeleton className="h-12 w-full" />
        <Skeleton className="h-64 w-full" />
      </Loading>
    </main>
  );
}
