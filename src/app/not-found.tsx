import Link from 'next/link';

export default function NotFound() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center gap-4 p-24">
      <h2 className="font-semibold text-foreground text-xl">
        404 — Page not found
      </h2>
      <Link href="/" className="text-foreground underline hover:no-underline">
        Return home
      </Link>
    </main>
  );
}
