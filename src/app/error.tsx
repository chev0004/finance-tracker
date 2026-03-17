'use client';

export default function ErrorFallback({
  error,
  reset,
}: {
  error: Error & { digest?: string };
  reset: () => void;
}) {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <h2 className="font-semibold text-foreground text-xl">
        Something went wrong
      </h2>
      {process.env.NODE_ENV === 'development' && error?.message && (
        <p className="text-foreground/80 text-sm">{error.message}</p>
      )}
      <button
        type="button"
        onClick={reset}
        className="rounded bg-foreground px-4 py-2 text-background"
      >
        Try again
      </button>
    </main>
  );
}
