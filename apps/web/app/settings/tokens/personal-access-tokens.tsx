"use client";

import { useRouter } from "next/navigation";
import { useState, type FormEvent } from "react";
import { describeFailure } from "../../../lib/api/client";
import { dayOf } from "../../../lib/day";
import {
  postPersonalAccessToken,
  revokePersonalAccessToken,
} from "../../../lib/personal-access-tokens/client";
import {
  CreatePersonalAccessToken,
  type IssuedPersonalAccessToken,
  type PersonalAccessToken,
} from "../../../lib/personal-access-tokens/contract";
import { describeIssues } from "../../../lib/zod-issues";
import { FIELD, Field, PRIMARY_BUTTON, Problems, Row } from "../../form";

/**
 * Issuing, reading and revoking Personal Access Tokens. The list is rendered
 * on the server and asked for again after every change, so there is no second
 * copy of it here that could disagree with the database.
 *
 * The raw token is held in state for exactly as long as this page is open, and
 * only ever the one just issued: the API cannot show it a second time, so the
 * page says so plainly rather than letting the user assume they can come back
 * for it.
 */
export function PersonalAccessTokens({
  tokens,
}: {
  tokens: PersonalAccessToken[];
}) {
  const router = useRouter();
  const [issued, setIssued] = useState<IssuedPersonalAccessToken | null>(null);
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  async function onSubmit(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();

    const form = event.currentTarget;
    const name = (new FormData(form).get("name") ?? "").toString().trim();

    const input = CreatePersonalAccessToken.safeParse({ name });
    if (!input.success) {
      setProblems(describeIssues(input.error));
      return;
    }

    setProblems([]);
    setSaving(true);

    try {
      setIssued(await postPersonalAccessToken(input.data));
      form.reset();
      router.refresh();
    } catch (error) {
      setProblems(describeFailure(error));
    } finally {
      setSaving(false);
    }
  }

  return (
    <>
      <section className="flex flex-col gap-3">
        <h2 className="text-lg font-semibold">Issue a token</h2>
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <Row>
            <Field label="What is it for?">
              <input className={FIELD} name="name" placeholder="Work laptop" />
            </Field>
          </Row>

          <Problems problems={problems} />

          <button
            className={`self-start ${PRIMARY_BUTTON}`}
            disabled={saving}
            type="submit"
          >
            {saving ? "Issuing…" : "Issue a token"}
          </button>
        </form>
      </section>

      {issued !== null && (
        <IssuedToken issued={issued} onDismiss={() => setIssued(null)} />
      )}

      <TokenList
        onRevoked={() => router.refresh()}
        onFailure={setProblems}
        tokens={tokens}
      />
    </>
  );
}

/**
 * The raw token, the once. It is shown with the warning attached rather than
 * beside it, because a user who closes this panel without copying has to issue
 * another one — nothing can recover this value, including us.
 */
function IssuedToken({
  issued,
  onDismiss,
}: {
  issued: IssuedPersonalAccessToken;
  onDismiss: () => void;
}) {
  const [copied, setCopied] = useState(false);

  async function copy() {
    try {
      await navigator.clipboard.writeText(issued.token);
      setCopied(true);
    } catch {
      // Clipboard access can be refused. The value is on screen and can be
      // selected by hand, so this is not worth an error of its own.
      setCopied(false);
    }
  }

  return (
    <section
      aria-live="polite"
      className="flex flex-col gap-3 rounded-lg border border-neutral-300 p-4 dark:border-neutral-700"
    >
      <div>
        <h2 className="text-lg font-semibold">Copy “{issued.name}” now</h2>
        <p className="text-sm opacity-60">
          This is the only time this token is shown. Paste it into the
          extension; if you lose it, revoke it and issue another.
        </p>
      </div>

      <div className="flex flex-wrap items-center gap-3">
        <code className="flex-1 overflow-x-auto rounded-md bg-neutral-100 px-3 py-2 font-mono text-sm dark:bg-neutral-900">
          {issued.token}
        </code>
        <button className={PRIMARY_BUTTON} onClick={copy} type="button">
          {copied ? "Copied" : "Copy"}
        </button>
      </div>

      <button
        className="self-start text-sm underline underline-offset-2 opacity-60"
        onClick={onDismiss}
        type="button"
      >
        I have copied it
      </button>
    </section>
  );
}

function TokenList({
  tokens,
  onRevoked,
  onFailure,
}: {
  tokens: PersonalAccessToken[];
  onRevoked: () => void;
  onFailure: (problems: string[]) => void;
}) {
  if (tokens.length === 0) {
    return (
      <p className="text-sm opacity-60">
        You have no tokens yet. Issue one to connect the extension.
      </p>
    );
  }

  return (
    <section className="flex flex-col gap-3">
      <h2 className="text-lg font-semibold">Your tokens</h2>
      <div className="overflow-x-auto">
        <table className="w-full text-left text-sm">
          <thead className="opacity-60">
            <tr>
              <th className="py-2 pr-4 font-medium">Name</th>
              <th className="py-2 pr-4 font-medium">Created</th>
              <th className="py-2 pr-4 font-medium">Last used</th>
              <th className="py-2 font-medium">
                <span className="sr-only">Revoke</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {tokens.map((token) => (
              <TokenRow
                key={token.id}
                onFailure={onFailure}
                onRevoked={onRevoked}
                token={token}
              />
            ))}
          </tbody>
        </table>
      </div>
    </section>
  );
}

/**
 * One token. A revoked one keeps its row — that is what makes revocation soft
 * — and says when it was revoked, so a token that had to be withdrawn stays
 * visible alongside when it was last used.
 */
function TokenRow({
  token,
  onRevoked,
  onFailure,
}: {
  token: PersonalAccessToken;
  onRevoked: () => void;
  onFailure: (problems: string[]) => void;
}) {
  const [confirming, setConfirming] = useState(false);
  const [revoking, setRevoking] = useState(false);
  const revokedAt = token.revokedAt;

  async function revoke() {
    setRevoking(true);

    try {
      await revokePersonalAccessToken(token.id);
      onRevoked();
    } catch (error) {
      onFailure(describeFailure(error));
      setConfirming(false);
      setRevoking(false);
    }
  }

  return (
    <tr className="border-t border-neutral-200 dark:border-neutral-800">
      <td className={`py-2 pr-4 ${revokedAt === null ? "" : "opacity-50"}`}>
        {token.name}
      </td>
      <td className="py-2 pr-4 opacity-60">{dayOf(token.createdAt)}</td>
      <td className="py-2 pr-4 opacity-60">
        {token.lastUsedAt === null ? "Never" : dayOf(token.lastUsedAt)}
      </td>
      <td className="py-2 text-right">
        {revokedAt !== null ? (
          <span className="opacity-60">Revoked {dayOf(revokedAt)}</span>
        ) : confirming ? (
          <span className="flex flex-wrap items-center justify-end gap-3">
            <button
              className="rounded-md bg-red-600 px-3 py-1.5 font-medium text-white disabled:opacity-50"
              disabled={revoking}
              onClick={revoke}
              type="button"
            >
              {revoking ? "Revoking…" : "Yes, revoke it"}
            </button>
            <button
              className="underline underline-offset-2 opacity-60"
              disabled={revoking}
              onClick={() => setConfirming(false)}
              type="button"
            >
              Keep it
            </button>
          </span>
        ) : (
          <button
            className="text-red-600 underline underline-offset-2 dark:text-red-400"
            onClick={() => setConfirming(true)}
            type="button"
          >
            Revoke
          </button>
        )}
      </td>
    </tr>
  );
}
