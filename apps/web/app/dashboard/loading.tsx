import { JobStatus } from "@repo/schema";
import { Loading, Skeleton } from "../states";

/**
 * The board, on its way. It stands in for the whole page rather than for the
 * board alone: `page.tsx` reads the Job Applications before it renders
 * anything at all, so there is no header already on screen to leave standing.
 *
 * The columns are drawn from `JobStatus.options`, the same list the board
 * itself lays out, so the shape the user is waiting for is the shape they get.
 */
export default function DashboardLoading() {
  return (
    <main className="mx-auto flex min-h-screen max-w-6xl flex-col gap-6 p-12">
      <Loading what="your Job Applications">
        <div className="flex gap-3 overflow-hidden">
          {JobStatus.options.map((status) => (
            <Skeleton className="h-40 w-64 shrink-0" key={status} />
          ))}
        </div>
      </Loading>
    </main>
  );
}
