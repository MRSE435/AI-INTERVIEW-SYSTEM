import Link from "next/link";

export default function Home() {
  return (
    <main className="min-h-screen bg-slate-950 text-white flex items-center justify-center">
      <Link
        href="/interview/demo-token-123"
        className="bg-purple-600 px-6 py-3 rounded"
      >
        Start Demo Interview
      </Link>
    </main>
  );
}