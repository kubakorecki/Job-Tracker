"use client";

import type { JobApplication, JobStatus } from "@repo/schema";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useState } from "react";
import { appliedAtAfterMove } from "../../lib/job-applications/applied-date";
import {
  fetchJobApplications,
  patchJobApplication,
} from "../../lib/job-applications/client";

/**
 * Every Job Application the user has, under one key. The board, and later the
 * table and the search, all read this single cached list and group or filter
 * it in the browser: for a personal tracker that is hundreds of rows, so there
 * is no second cache that can disagree with the board.
 */
export const JOB_APPLICATIONS_KEY = ["job-applications"];

/** Scopes `isMutating` to moves, so an unrelated write is not counted. */
const MOVE_KEY = ["move-job-application"];

export function useJobApplications(initialData: JobApplication[]) {
  return useQuery({
    queryKey: JOB_APPLICATIONS_KEY,
    queryFn: fetchJobApplications,
    // The dashboard page already read this list on the server, so the board
    // paints with real cards rather than an empty frame.
    initialData,
  });
}

/** A card dropped into a column: this Job Application, now at this Status. */
export type Move = { id: string; status: JobStatus };

/** A move that did not save, and why, so it can be explained and reattempted. */
export type FailedMove = { move: Move; reason: string };

/**
 * Moving Job Applications between columns, optimistically. A card is in its
 * new column before the request leaves; if the request fails that one card
 * goes back exactly as it was and the move joins `failures`, carrying both the
 * reason and enough to reattempt the very same change.
 *
 * Failures are kept here rather than read off the mutation, because the
 * mutation only ever describes its latest call: a second card dropped while
 * the first is still in flight would otherwise leave the first to snap back
 * with no explanation at all.
 */
export function useMoveJobApplication() {
  const queryClient = useQueryClient();
  const [failures, setFailures] = useState<FailedMove[]>([]);

  const forget = (id: string) =>
    setFailures((current) => current.filter(({ move }) => move.id !== id));

  const read = () =>
    queryClient.getQueryData<JobApplication[]>(JOB_APPLICATIONS_KEY);

  const write = (change: (jobApplication: JobApplication) => JobApplication) =>
    queryClient.setQueryData<JobApplication[]>(JOB_APPLICATIONS_KEY, (current) =>
      current?.map(change),
    );

  const mutation = useMutation({
    mutationKey: MOVE_KEY,
    mutationFn: ({ id, status }: Move) => patchJobApplication(id, { status }),

    onMutate: async (move: Move) => {
      // A refetch already in flight would otherwise land on top of the
      // optimistic board and undo it.
      await queryClient.cancelQueries({ queryKey: JOB_APPLICATIONS_KEY });

      // The one card, not the whole list: another move may be in flight, and
      // restoring a snapshot of the entire board would take its card back too.
      const before = read()?.find(({ id }) => id === move.id);

      write((jobApplication) =>
        jobApplication.id === move.id
          ? {
              ...jobApplication,
              status: move.status,
              appliedAt: appliedAtAfterMove(
                jobApplication.appliedAt,
                move.status,
              ),
            }
          : jobApplication,
      );

      return { before };
    },

    onError: (error: Error, move, context) => {
      if (context?.before !== undefined) {
        const before = context.before;
        write((jobApplication) =>
          jobApplication.id === move.id ? before : jobApplication,
        );
      }

      setFailures((current) => [
        ...current.filter(({ move: failed }) => failed.id !== move.id),
        { move, reason: error.message },
      ]);
    },

    onSuccess: (_jobApplication, move) => forget(move.id),

    onSettled: async () => {
      // The last move out has the final word. Invalidating while another is
      // still in flight would refetch a board that does not yet carry it, and
      // that card would jump back until its own request landed.
      if (queryClient.isMutating({ mutationKey: MOVE_KEY }) > 1) return;
      await queryClient.invalidateQueries({ queryKey: JOB_APPLICATIONS_KEY });
    },
  });

  return {
    failures,
    move: mutation.mutate,
    /** Reattempts the change that failed, not whatever the board says now. */
    retry: (failed: FailedMove) => {
      forget(failed.move.id);
      mutation.mutate(failed.move);
    },
    dismiss: (failed: FailedMove) => forget(failed.move.id),
  };
}
