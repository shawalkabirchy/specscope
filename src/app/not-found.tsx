import Link from "next/link";

export default function NotFound() {
  return (
    <main className="invalid-link">
      <h1>This screen isn’t here.</h1>
      <p>
        Your records remain in this browser. Open the workspace to find them.
      </p>
      <Link href="/" prefetch={false}>
        Go to SpecScope
      </Link>
    </main>
  );
}
