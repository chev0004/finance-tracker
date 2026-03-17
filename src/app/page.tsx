export default function Home() {
  return (
    <main className="flex min-h-screen flex-col items-center justify-center p-24">
      <div className="z-10 w-full max-w-5xl items-center justify-between font-mono text-sm">
        <h1 className="mb-8 text-center font-bold text-4xl">
          Welcome to Next.js
        </h1>
        <p className="text-center text-gray-600 text-lg">
          Get started by editing{' '}
          <code className="rounded bg-gray-100 px-2 py-1">
            src/app/page.tsx
          </code>
        </p>
      </div>
    </main>
  );
}
