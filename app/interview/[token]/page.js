"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import RulesPage from "../../components/RulesPage";
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

    setSession(updated);
    localStorage.setItem(storageKey, JSON.stringify(updated));
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
    <InterviewRoom session={session} updateSession={updateSession} />
  );
}