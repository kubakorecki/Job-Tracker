"use client";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { useState, type ReactNode } from "react";

/**
 * The dashboard's query cache. It sits here rather than in the root layout so
 * that the sign-in page stays a wholly static Server Component, and it is held
 * in state so a re-render never swaps the cache out from under the board.
 */
export function QueryProvider({ children }: { children: ReactNode }) {
  const [queryClient] = useState(
    () =>
      new QueryClient({
        defaultOptions: {
          // The whole board is one cached list, and a failed Status change is
          // reported to the user rather than retried behind their back — the
          // retry is the button in the message.
          mutations: { retry: false },
        },
      }),
  );

  return (
    <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
  );
}
