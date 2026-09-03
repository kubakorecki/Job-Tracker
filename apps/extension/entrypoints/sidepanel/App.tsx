import { useState } from "react";
import { dashboardPage } from "../../lib/api";
import { DEFAULT_API_BASE_URL } from "../../lib/settings";
import { AddManually, SaveThisJob } from "./capture-actions";
import { RecentJobApplications } from "./recent-job-applications";
import { ReviewForm } from "./review-form";
import { SetupForm } from "./setup-form";
import { useCapture } from "./use-capture";
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
 * The review form is the one thing that takes the whole body. It is a form the
 * user is in the middle of filling in, and the list of what they saved last
 * week underneath it would be an invitation to lose the work. Everything else
 * leaves the shell standing: opening the settings does not take the recent
 * list away, because nothing about editing a token makes what is saved
 * unknown.
 */
function App() {
  const { settings, loading, save } = useSettings();
  const [editing, setEditing] = useState(false);
  const { recent, refresh } = useRecentJobApplications(settings);
  const {
    capture,
    extract,
    addManually,
    cancel,
    save: saveReview,
  } = useCapture(settings, refresh);

  // Asked for when there is nothing stored, and whenever the user goes back to
  // it. Never while storage is still answering: a panel that flashed the setup
  // form at an already-configured user would be lying for that moment.
  const setupOpen = !loading && (settings === null || editing);

  // Either thing the panel does can be the one that discovers the token is no
  // longer good. Both say so in the same place, because there is one remedy.
  const tokenRejected =
    recent.kind === "token-rejected" || capture.kind === "token-rejected";

  // The review form takes the body, not the header: the way back to the
  // dashboard is never the thing a panel takes away.
  const reviewing = capture.kind === "reviewing";

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
          {settings !== null && !setupOpen && !reviewing && (
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

      {reviewing ? (
        <ReviewForm
          explanation={capture.explanation}
          initial={capture.fields}
          onCancel={cancel}
          onSave={saveReview}
        />
      ) : (
        <>
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

          {!setupOpen && tokenRejected && (
            <section>
              <p className="problem" role="alert">
                Your Personal Access Token was refused. It may have been
                revoked, or it may belong to a different Job Tracker than the
                one this panel points at.
              </p>
              <div className="actions">
                <button
                  className="button"
                  onClick={() => setEditing(true)}
                  type="button"
                >
                  Update settings
                </button>
                <AddManually onClick={addManually} />
              </div>
            </section>
          )}

          {!setupOpen && !tokenRejected && settings !== null && (
            <SaveThisJob
              capture={capture}
              onAddManually={addManually}
              onSave={extract}
            />
          )}

          {/*
            Manual entry is the secondary action in every state the panel could
            save from, so where the primary action area is not already carrying
            it — the settings form — it stands on its own. The one state
            without it is a first run: there is no Job Tracker configured yet,
            and a form that could not be saved would be a worse answer than the
            setup form already in front of the user.
          */}
          {setupOpen && settings !== null && (
            <section className="actions">
              <AddManually onClick={addManually} />
            </section>
          )}

          {settings !== null && <RecentJobApplications recent={recent} />}
        </>
      )}
    </main>
  );
}

export default App;
