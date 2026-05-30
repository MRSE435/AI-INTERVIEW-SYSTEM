"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RulesPage from "../../components/RulesPage"; // 💡 Fixed: Added 'from' keyword here
import HardwareCheck from "../../components/HardwareCheck";
import InterviewRoom from "../../components/InterviewRoom";
export default function Home() {
  const params = useParams();
  const interviewToken = params.token;
  const storageKey = `interviewSession-${interviewToken}`;

  const [stage, setStage] = useState("rules");
  const [session, setSession] = useState(null);

  useEffect(() => {
    if (!interviewToken) return;

    const saved = localStorage.getItem(storageKey);

    if (saved) {
      const parsed = JSON.parse(saved);
      setSession(parsed);
      setStage(parsed.stage || "rules");
    } else {
      const newSession = {
        interviewToken,
        sessionId: crypto.randomUUID(),
        stage: "rules",
        currentQuestionIndex: 0,
        answers: [],
        evaluations: [],
        suspiciousEvents: [],
        tabSwitchCount: 0,
        createdAt: new Date().toISOString(),
      };

      setSession(newSession);
      localStorage.setItem(storageKey, JSON.stringify(newSession));
    }
  }, [interviewToken, storageKey]);

  function updateSession(data) {
    const updated = {
      ...session,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    // Update the live react state with the stream intact
    setSession(updated);

    // Deep clone and strip out the native stream track before stringifying
    const storageClone = { ...updated };
    delete storageClone.sharedScreenStream;

    localStorage.setItem(storageKey, JSON.stringify(storageClone));
  }

  function goToStage(nextStage) {
    setStage(nextStage);
    updateSession({ stage: nextStage });
  }

  if (!session) return null;

  switch (stage) {
    case "rules":
      return <RulesPage goToStage={goToStage} />;

    case "hardware":
      return (
        <HardwareCheck
          goToStage={goToStage}
          updateSession={updateSession}
        />
      );

    case "interview":
      return (
        <InterviewRoom 
          session={session} 
          updateSession={updateSession} 
        />
      );

    default:
      return (
        <main className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <p>Initializing your room state...</p>
        </main>
      );
  }
}