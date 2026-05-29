"use client";

export default function RulesPage({ goToStage }) {
  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center">
      <div className="max-w-3xl bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-6">
        <h1 className="text-3xl font-bold">Interview Rules</h1>

        <ul className="list-disc ml-6 text-slate-300 space-y-3">
          <li>Keep your camera and microphone enabled.</li>
          <li>Do not switch tabs during the interview.</li>
          <li>Do not use external sources, AI tools, or notes.</li>
          <li>Screen sharing must remain active.</li>
          <li>Suspicious activity may be flagged for recruiter review.</li>
        </ul>

        <button
          onClick={() => goToStage("hardware")}
          className="bg-purple-600 px-6 py-3 rounded font-semibold"
        >
          I Understand, Continue
        </button>
      </div>
    </main>
  );
}