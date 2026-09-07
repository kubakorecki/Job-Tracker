import { Loading, Skeleton } from "../states";

/**
 * The board, on its way. It stands in for the whole page rather than for the
 * board alone: `page.tsx` reads the Job Applications before it renders
 * anything at all, so there is no bar already on screen to leave standing.
 *
 * A tally, a toolbar and a row of columns, in the proportions the board
 * arrives in — the shape the user is waiting for is the shape they get.
 */
export default function DashboardLoading() {
  return (
    <main className="flex min-h-screen flex-col bg-paper">
      <div className="h-[60px] border-b border-line bg-paper-raised" />
      <div className="flex flex-col gap-[18px] px-6 pt-[30px] pb-11 lg:px-16">
        <Loading what="your Job Applications">
          <Skeleton className="h-9 w-[420px] max-w-full" />
          <Skeleton className="mt-2 h-[34px] w-[520px] max-w-full rounded-control" />
          <div className="mt-4 grid min-w-0 grid-cols-2 gap-3.5 sm:grid-cols-3 lg:grid-cols-6">
            {[0, 1, 2, 3, 4, 5].map((column) => (
              <Skeleton className="h-40 rounded-card" key={column} />
            ))}
          </div>
        </Loading>
      </div>
    </main>
  );
}
