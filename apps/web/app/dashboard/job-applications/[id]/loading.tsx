import { Loading, Skeleton } from "../../../states";

/**
 * One Job Application, on its way. It has a loading state of its own rather
 * than borrowing the board's: the nearest one above this route draws a row of
 * columns, and a user who clicked a card would watch the board reappear on the
 * way to the detail view.
 */
export default function JobApplicationLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-3xl flex-col gap-6 p-12">
      <Loading what="this Job Application">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </Loading>
    </main>
  );
}
