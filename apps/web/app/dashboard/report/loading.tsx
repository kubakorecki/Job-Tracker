import { Loading, Skeleton } from "../../states";

/**
 * The month, on its way. It stands in for the whole page rather than for the
 * sheet alone: `page.tsx` reads the record before it renders anything at all,
 * so there is no bar already on screen to leave standing.
 *
 * A headline, a toolbar and a sheet, in the proportions the page arrives in.
 */
export default function ActivityReportLoading() {
  return (
    <main className="flex min-h-screen flex-col bg-paper">
      <div className="h-[60px] border-b border-line bg-paper-raised" />
      <div className="flex flex-col gap-[18px] px-6 pt-[30px] pb-11 lg:px-16">
        <Loading what="your month">
          <Skeleton className="h-9 w-[420px] max-w-full" />
          <Skeleton className="mt-2 h-[34px] w-[520px] max-w-full rounded-control" />
          <Skeleton className="mt-4 h-[420px] w-full max-w-[880px] rounded-panel" />
        </Loading>
      </div>
    </main>
  );
}
