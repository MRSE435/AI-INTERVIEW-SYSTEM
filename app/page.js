"use client";

import { useState } from "react";

export default function Home() {
  const [question, setQuestion] = useState("Tell me about yourself");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  async function evaluateAnswer() {
    setLoading(true);
    setResult("");

    const res = await fetch("/api/evaluate", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ question, answer }),
    });

    const data = await res.json();
 setResult(data.evaluation || { error: data.error });
    setLoading(false);
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-8">
      <div className="max-w-3xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">AI Interview Evaluator</h1>

        <div>
          <label className="block mb-2">Interview Question</label>
          <textarea
            className="w-full p-3 rounded bg-slate-900 border border-slate-700"
            value={question}
            onChange={(e) => setQuestion(e.target.value)}
          />
        </div>

        <div>
          <label className="block mb-2">Candidate Answer</label>
          <textarea
            className="w-full h-40 p-3 rounded bg-slate-900 border border-slate-700"
            placeholder="Type candidate answer..."
            value={answer}
            onChange={(e) => setAnswer(e.target.value)}
          />
        </div>

        <button
          onClick={evaluateAnswer}
          className="bg-purple-600 px-5 py-3 rounded font-semibold"
        >
          {loading ? "Evaluating..." : "Evaluate Answer"}
        </button>

      {result && (
  <div className="bg-slate-900 border border-slate-700 p-5 rounded space-y-4">
    {result.error ? (
      <p className="text-red-400">{result.error}</p>
    ) : (
      <>
        <h2 className="text-xl font-bold">AI Result</h2>

        <div className="text-3xl font-bold text-purple-400">
          Score: {result.score}/10
        </div>

        <div>
          <h3 className="font-semibold text-green-400">Strengths</h3>
          <ul className="list-disc ml-6">
            {result.strengths.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-red-400">Weaknesses</h3>
          <ul className="list-disc ml-6">
            {result.weaknesses.map((item, index) => (
              <li key={index}>{item}</li>
            ))}
          </ul>
        </div>

        <div>
          <h3 className="font-semibold text-blue-400">Feedback</h3>
          <p>{result.feedback}</p>
        </div>
      </>
    )}
  </div>
)}
      </div>
    </main>
  );
}