import { useState } from "react";
import { dashboardPage } from "../../lib/api";
import { DEFAULT_API_BASE_URL } from "../../lib/settings";
import { AddManually, SaveThisJob } from "./capture-actions";
import { RecentJobApplications } from "./recent-job-applications";
import { ReviewForm } from "./review-form";
import { SavedPosting } from "./saved-posting";
import { SetupForm } from "./setup-form";
import { useCapture } from "./use-capture";
import { listed, useJobApplications } from "./use-job-applications";
import { useSavedPosting } from "./use-saved-posting";
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

  // Both the list and the lookup go stale for the same reason — the panel
  // writes through the endpoints it reads — so one count reloads both. A Job
  // Application saved for the Posting in front of the user turns the panel's
  // primary action into the already-saved view, and nothing else would tell it.
  const [reloads, setReloads] = useState(0);
  const refresh = () => setReloads((times) => times + 1);

  const jobApplications = useJobApplications(settings, reloads);
  const { lookup, setStatus } = useSavedPosting(settings, reloads);
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

  // Any of the three things the panel does can be the one that discovers the
  // token is no longer good. All of them say so in the same place, because
  // there is one remedy.
  const tokenRejected =
    jobApplications.kind === "token-rejected" ||
    capture.kind === "token-rejected" ||
    lookup.kind === "token-rejected";

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
          existing={listed(jobApplications)}
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

          {/*
            The one place the panel decides for the user. A Posting they have
            already saved is answered with the Job Application they saved, and
            "Save this job" is not offered — reading the page again could only
            produce a Draft the API would refuse as a duplicate (ADR-0002).
            Every other answer, including a lookup that could not be made,
            leaves the ordinary path in place: a Posting the panel cannot rule
            out being new is one the user may still want to save.
          */}
          {!setupOpen &&
            !tokenRejected &&
            settings !== null &&
            (lookup.kind === "saved" ? (
              <SavedPosting
                apiBaseUrl={settings.apiBaseUrl}
                jobApplication={lookup.jobApplication}
                onAddManually={addManually}
                onSetStatus={setStatus}
              />
            ) : (
              <SaveThisJob
                capture={capture}
                looking={lookup.kind === "looking"}
                onAddManually={addManually}
                onSave={extract}
              />
            ))}

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

          {settings !== null && (
            <RecentJobApplications jobApplications={jobApplications} />
          )}
        </>
      )}
    </main>
  );
}

export default App;
