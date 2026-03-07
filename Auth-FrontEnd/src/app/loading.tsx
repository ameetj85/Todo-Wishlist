export default function Loading() {
  return (
    <main className="mx-auto flex min-h-[calc(100vh-73px)] w-full max-w-5xl items-center justify-center px-6 py-12">
      <div
        className="h-12 w-12 animate-spin rounded-full border-4 border-blue-200 border-t-blue-500"
        aria-label="Loading"
        role="status"
      />
    </main>
  );
}
