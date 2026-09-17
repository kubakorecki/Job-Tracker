"use client";

import { DASHBOARD_PERIOD_KEY, periodFrom } from "../../lib/dashboard/period";
import {
  DASHBOARD_SORT_KEY,
  sortFrom,
  storedSort,
} from "../../lib/dashboard/sorting";
import { DASHBOARD_VIEW_KEY, viewFrom } from "../../lib/dashboard/view";
import { rememberedChoice } from "./remembered";

/** Which of the board and the table the user last chose. */
export const useDashboardView = rememberedChoice({
  key: DASHBOARD_VIEW_KEY,
  from: viewFrom,
});

/** The Salary Period the user last chose to read salaries in. */
export const useSalaryPeriod = rememberedChoice({
  key: DASHBOARD_PERIOD_KEY,
  from: periodFrom,
});

/** The order the user last put the dashboard in, shared by both views. */
export const useDashboardSort = rememberedChoice({
  key: DASHBOARD_SORT_KEY,
  from: sortFrom,
  written: storedSort,
});
