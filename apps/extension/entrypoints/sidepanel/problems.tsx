/**
 * Everything the user has to put right, or everything that went wrong on their
 * behalf. Every part of the panel that has something to report renders one of
 * these, the way every form in the dashboard renders `Problems` from
 * `apps/web/app/form.tsx` — so a refused save and a refused token do not
 * arrive looking like two different kinds of news.
 */
export function Problems({ problems }: { problems: string[] }) {
  if (problems.length === 0) return null;

  return (
    <ul className="problem" role="alert">
      {problems.map((problem) => (
        <li key={problem}>{problem}</li>
      ))}
    </ul>
  );
}
