import { useState, type FormEvent } from "react";
import { tokensPage } from "../../lib/api";
import {
  DEFAULT_API_BASE_URL,
  parseApiBaseUrl,
  type Settings,
} from "../../lib/settings";
import { Problems } from "./problems";

/**
 * The panel's first run: a token to act with, and an address to act against.
 * It is the same form the user comes back to when a token is refused, so it
 * fills in from what is already stored and can be cancelled — except on a
 * first run, where there is nothing to go back to.
 */
export function SetupForm({
  settings,
  onSave,
  onCancel,
}: {
  settings: Settings | null;
  onSave: (settings: Settings) => Promise<void>;
  onCancel?: () => void;
}) {
  const [token, setToken] = useState(settings?.token ?? "");
  const [apiBaseUrl, setApiBaseUrl] = useState(
    settings?.apiBaseUrl ?? DEFAULT_API_BASE_URL,
  );
  const [problems, setProblems] = useState<string[]>([]);
  const [saving, setSaving] = useState(false);

  // Doubles as the form's validation and as the address of the page the token
  // is issued on, so the link below follows the field as it is corrected.
  const parsed = parseApiBaseUrl(apiBaseUrl);

  const submit = async (event: FormEvent) => {
    event.preventDefault();

    const found = [
      ...(token.trim() === "" ? ["Paste a Personal Access Token."] : []),
      ...(parsed === null
        ? ["The API base URL must be a full http:// or https:// address."]
        : []),
    ];

    setProblems(found);

    // `parsed` is re-tested rather than read off an empty `found`: it is the
    // value that goes into storage, and nothing tells TypeScript that a list
    // with no problems in it means the URL parsed.
    if (found.length > 0 || parsed === null) return;

    setSaving(true);
    try {
      await onSave({ token: token.trim(), apiBaseUrl: parsed });
    } finally {
      setSaving(false);
    }
  };

  return (
    <section>
      <h2>Connect to your tracker</h2>
      <p className="hint">
        Generate a Personal Access Token on the dashboard&rsquo;s{" "}
        {parsed === null ? (
          "tokens page"
        ) : (
          <a
            className="link"
            href={tokensPage(parsed)}
            rel="noreferrer"
            target="_blank"
          >
            tokens page
          </a>
        )}{" "}
        and paste it here. It is shown once.
      </p>

      <form onSubmit={submit}>
        <label className="field">
          <span>Personal Access Token</span>
          <input
            autoComplete="off"
            onChange={(event) => setToken(event.target.value)}
            type="password"
            value={token}
          />
        </label>

        <label className="field">
          <span>API base URL</span>
          <input
            autoComplete="off"
            onChange={(event) => setApiBaseUrl(event.target.value)}
            spellCheck={false}
            type="text"
            value={apiBaseUrl}
          />
        </label>

        <Problems problems={problems} />

        <div className="actions">
          <button className="button" disabled={saving} type="submit">
            {saving ? "Saving…" : "Save"}
          </button>
          {onCancel !== undefined && (
            <button className="link" onClick={onCancel} type="button">
              Cancel
            </button>
          )}
        </div>
      </form>
    </section>
  );
}
