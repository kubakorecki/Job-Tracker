import { Loading, Skeleton } from "../../../states";

/**
 * One Job Application, on its way. It has a loading state of its own rather
 * than borrowing the board's: the nearest one above this route draws a row of
 * columns, and a user who clicked a card would watch the board reappear on the
 * way to the detail view.
 *
 * It stands in for the whole page, bar included — the page reads the record
 * before it renders anything at all, so there is no bar already on screen to
 * leave standing.
 */
export default function JobApplicationLoading() {
  return (
    <main className="flex min-h-screen flex-col bg-paper">
      <div className="h-[60px] border-b border-line bg-paper-raised" />
      <div className="flex flex-col gap-[18px] px-6 pt-[30px] pb-11 lg:px-16">
        <Loading what="this Job Application">
          <Skeleton className="h-12 w-[320px] max-w-full" />
          <div className="mt-4 grid grid-cols-1 items-start gap-6 xl:grid-cols-[minmax(0,1fr)_396px]">
            <div className="flex flex-col gap-5">
              <Skeleton className="h-[92px] rounded-panel" />
              <Skeleton className="h-64 rounded-panel" />
            </div>
            <div className="flex flex-col gap-5">
              <Skeleton className="h-40 rounded-panel" />
              <Skeleton className="h-72 rounded-panel" />
            </div>
          </div>
        </Loading>
      </div>
    </main>
  );
}
