import type { ReactNode } from "react";
import { QueryProvider } from "./query-provider";

/**
 * The dashboard's query cache spans every page under `/dashboard`, not just
 * the board. Editing a Job Application on its own page and coming back to the
 * board is one cached list being changed and re-read — which only holds if the
 * cache outlives the navigation between them, so it is held here rather than
 * on the board's page.
 */
export default function DashboardLayout({ children }: { children: ReactNode }) {
  return <QueryProvider>{children}</QueryProvider>;
}
