import { redirect } from "next/navigation";
import { DASHBOARD_PATH } from "../lib/auth/route-access";

/** The root is not a page of its own; the board is what the user came for. */
export default function RootPage() {
  redirect(DASHBOARD_PATH);
}
