import Link from "next/link";

export default function NotFound() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center bg-background">
      <h1 className="text-6xl font-bold text-foreground">404</h1>
      <p className="mt-2 text-lg text-muted">Page not found</p>
      <Link
        href="/"
        className="mt-6 rounded-lg bg-primary px-6 py-2.5 text-sm font-medium text-white hover:bg-primary-hover transition-colors"
      >
        Go Home
      </Link>
    </div>
  );
}
