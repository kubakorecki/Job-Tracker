import { useState } from "react";
import { dashboardPage } from "../../lib/api";
import { DEFAULT_API_BASE_URL } from "../../lib/settings";
import { RecentJobApplications } from "./recent-job-applications";
import { SetupForm } from "./setup-form";
import { useRecentJobApplications } from "./use-recent-job-applications";
import { useSettings } from "./use-settings";
import "./App.css";

/**
 * The panel is a fixed shell rather than a sequence of screens: a header that
 * links to the dashboard, a primary action area whose contents depend on what
 * the panel has been told, and the recent Job Applications underneath. The
 * pieces keep their places as the panel learns things, so that a user who
 * pastes a token is not moved to a different-looking panel afterwards.
 *
 * Today the primary action area holds the setup form and the one message the
 * user can act on. Saving the current Posting arrives there in ticket 11.
 */
function App() {
  const { settings, loading, save } = useSettings();
  const [editing, setEditing] = useState(false);
  const recent = useRecentJobApplications(settings);

  // Asked for when there is nothing stored, and whenever the user goes back to
  // it. Never while storage is still answering: a panel that flashed the setup
  // form at an already-configured user would be lying for that moment.
  const setupOpen = !loading && (settings === null || editing);

  return (
    <main className="panel">
      <header className="panel-header">
        <h1>Job Tracker</h1>
        <nav>
          <a
            className="link"
            href={dashboardPage(settings?.apiBaseUrl ?? DEFAULT_API_BASE_URL)}
            rel="noreferrer"
            target="_blank"
          >
            Dashboard
          </a>
          {settings !== null && !setupOpen && (
            <button
              className="link"
              onClick={() => setEditing(true)}
              type="button"
            >
              Settings
            </button>
          )}
        </nav>
      </header>

      {setupOpen && (
        <SetupForm
          onCancel={settings === null ? undefined : () => setEditing(false)}
          onSave={async (next) => {
            await save(next);
            setEditing(false);
          }}
          settings={settings}
        />
      )}

      {!setupOpen && recent.kind === "token-rejected" && (
        <section>
          <p className="problem" role="alert">
            Your Personal Access Token was refused. It may have been revoked, or
            it may belong to a different Job Tracker than the one this panel
            points at.
          </p>
          <button
            className="button"
            onClick={() => setEditing(true)}
            type="button"
          >
            Update settings
          </button>
        </section>
      )}

      {settings !== null && <RecentJobApplications recent={recent} />}
    </main>
  );
}

export default App;
