import { Button } from "./ui/button";
export function QueryState({
  loading,
  error,
  retry,
}: {
  loading?: boolean;
  error?: Error | null;
  retry?: () => void;
}) {
  if (error)
    return (
      <div role="alert" className="my-4 rounded-xl border border-destructive/30 p-4">
        <p>Unable to load this page. {error.message}</p>
        {retry ? (
          <Button variant="outline" className="mt-3" onClick={retry}>
            Try again
          </Button>
        ) : null}
      </div>
    );
  if (loading)
    return (
      <div role="status" aria-label="Loading records" className="my-4 grid gap-3">
        {[1, 2, 3].map((key) => (
          <div key={key} className="h-20 animate-pulse rounded-xl bg-muted" />
        ))}
        <span className="sr-only">Loading records…</span>
      </div>
    );
  return null;
}
