"use client";

import { useEffect, useState } from "react";
import RulesPage from "./components/RulesPage";
import HardwareCheck from "./components/HardwareCheck";
import InterviewRoom from "./components/InterviewRoom";

export default function Home() {
  const [stage, setStage] = useState("rules");
  const [session, setSession] = useState(null);

  useEffect(() => {
    const saved = localStorage.getItem("interviewSession");

    if (saved) {
      const parsed = JSON.parse(saved);
      setSession(parsed);
      setStage(parsed.stage || "rules");
    } else {
      const newSession = {
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
      localStorage.setItem("interviewSession", JSON.stringify(newSession));
    }
  }, []);

  function updateSession(data) {
    const updated = {
      ...session,
      ...data,
      updatedAt: new Date().toISOString(),
    };

    setSession(updated);
    localStorage.setItem("interviewSession", JSON.stringify(updated));
  }

  function goToStage(nextStage) {
    setStage(nextStage);
    updateSession({ stage: nextStage });
  }

  if (!session) return null;

  if (stage === "rules") {
    return <RulesPage goToStage={goToStage} />;
  }

  if (stage === "hardware") {
    return (
      <HardwareCheck
        goToStage={goToStage}
        updateSession={updateSession}
      />
    );
  }

  return (
    <InterviewRoom
      session={session}
      updateSession={updateSession}
    />
  );
}