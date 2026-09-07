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
import {
  DANGER_BUTTON,
  FIELD_ON_RAISED,
  Field,
  PRIMARY_BUTTON,
  Problems,
  Row,
  SECONDARY_BUTTON_SMALL,
} from "../../form";
import { Panel } from "../../panel";
import { Empty } from "../../states";

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
      <Panel title="Issue a token">
        <form className="flex flex-col gap-3" onSubmit={onSubmit}>
          <Row>
            <Field label="What is it for?">
              <input
                className={FIELD_ON_RAISED}
                name="name"
                placeholder="Work laptop"
              />
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
      </Panel>

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
    // The one panel in the app carrying a secret, and it is drawn in `spectre`
    // rather than in `rose`: nothing has gone wrong, but this is the only time
    // the value exists anywhere the user can reach it.
    <section
      aria-live="polite"
      className="overflow-hidden rounded-panel border border-spectre bg-paper-raised"
    >
      <div className="border-b border-spectre/40 bg-spectre-tint px-[18px] py-[13px]">
        <h2 className="text-[13.5px] leading-[1.4] font-semibold text-spectre">
          Copy “{issued.name}” now
        </h2>
        <p className="mt-1 text-[12.5px] leading-[1.55] text-ink-muted">
          This is the only time this token is shown. Paste it into the
          extension; if you lose it, revoke it and issue another.
        </p>
      </div>

      <div className="flex flex-col gap-3 p-[18px]">
        <div className="flex flex-wrap items-center gap-3">
          <code className="flex-1 overflow-x-auto rounded-control border border-line bg-paper px-3 py-2 font-mono text-[12.5px] text-ink">
            {issued.token}
          </code>
          <button className={PRIMARY_BUTTON} onClick={copy} type="button">
            {copied ? "Copied" : "Copy"}
          </button>
        </div>

        <button
          className={`self-start ${SECONDARY_BUTTON_SMALL}`}
          onClick={onDismiss}
          type="button"
        >
          I have copied it
        </button>
      </div>
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
      <Empty drawing="solid" title="No tokens yet.">
        <p>
          A token is how the extension proves it is you. Issue one above, paste
          it into the extension, and the panel can save a Posting straight off
          the page you are reading.
        </p>
      </Empty>
    );
  }

  return (
    <div className="overflow-x-auto rounded-panel border border-line bg-paper-raised">
      <table className="w-full border-collapse text-[13px]">
        <thead>
          <tr className="border-b border-line bg-paper-sunk text-left">
            <th className={`${CELL} type-eyebrow text-ink-faint`}>Name</th>
            <th className={`${CELL} type-eyebrow text-ink-faint`}>Created</th>
            <th className={`${CELL} type-eyebrow text-ink-faint`}>Last used</th>
            <th className={`${CELL} type-eyebrow text-ink-faint`}>
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
  );
}

/** One cell of the table, at the padding every other table in the app uses. */
const CELL = "px-3.5 py-2.5";

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
    <tr className="border-b border-line last:border-0">
      <td
        className={`${CELL} font-semibold ${
          // A revoked token keeps its row and its name, in the page's faint
          // ink: it is a record of a machine that used to have a key, which is
          // the whole point of revoking softly.
          revokedAt === null ? "text-ink" : "text-ink-faint"
        }`}
      >
        {token.name}
      </td>
      <td className={`${CELL} text-ink-muted`}>{dayOf(token.createdAt)}</td>
      <td className={`${CELL} text-ink-muted`}>
        {token.lastUsedAt === null ? "Never" : dayOf(token.lastUsedAt)}
      </td>
      <td className={`${CELL} text-right`}>
        {revokedAt !== null ? (
          <span className="text-ink-faint">Revoked {dayOf(revokedAt)}</span>
        ) : confirming ? (
          <span className="flex flex-wrap items-center justify-end gap-2.5">
            <button
              className={DANGER_BUTTON}
              disabled={revoking}
              onClick={revoke}
              type="button"
            >
              {revoking ? "Revoking…" : "Yes, revoke it"}
            </button>
            <button
              className={SECONDARY_BUTTON_SMALL}
              disabled={revoking}
              onClick={() => setConfirming(false)}
              type="button"
            >
              Keep it
            </button>
          </span>
        ) : (
          <button
            className={DANGER_BUTTON}
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
