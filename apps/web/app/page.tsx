import { Card } from "@repo/ui/card";
import { StatusBadge } from "@repo/ui/status-badge";
import type { JobStatus } from "@repo/schema";

const SAMPLE_STATUSES: JobStatus[] = [
  "bookmarked",
  "applied",
  "interviewing",
  "offer",
];

export default function Page() {
  return (
    <main className="mx-auto flex min-h-screen max-w-2xl flex-col gap-6 p-12">
      <div>
        <h1 className="text-2xl font-semibold">Job Tracker</h1>
        <p className="text-sm opacity-60">
          Web app scaffold — dashboard UI goes here.
        </p>
      </div>

      <Card title="Wiring check">
        <div className="mt-2 flex flex-wrap gap-2">
          {SAMPLE_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </Card>
    </main>
  );
}
