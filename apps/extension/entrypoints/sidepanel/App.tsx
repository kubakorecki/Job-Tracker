import { Card } from '@repo/ui/card';
import { StatusBadge } from '@repo/ui/status-badge';
import type { JobStatus } from '@repo/schema';
import './App.css';

const SAMPLE_STATUSES: JobStatus[] = ['bookmarked', 'applied'];

function App() {
  return (
    <main className="panel">
      <h1>Job Tracker</h1>
      <p className="subtitle">Side panel scaffold — extraction UI goes here.</p>

      <Card title="Wiring check">
        <div className="badges">
          {SAMPLE_STATUSES.map((status) => (
            <StatusBadge key={status} status={status} />
          ))}
        </div>
      </Card>
    </main>
  );
}

export default App;
