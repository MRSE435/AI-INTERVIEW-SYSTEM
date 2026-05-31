"use client";

import React, { useState, useEffect } from "react";

export default function AdminDashboard() {
  const [candidateEmail, setCandidateEmail] = useState("");
  const [interviews, setInterviews] = useState([]);
  const [generatedLink, setGeneratedLink] = useState("");
  const [loading, setLoading] = useState(false);
  const [message, setMessage] = useState("");
  const [selectedInterview, setSelectedInterview] = useState(null);

  const BACKEND_URL = process.env.NEXT_PUBLIC_BACKEND_URL;

  const fetchInterviews = async () => {
    try {
      const res = await fetch(`${BACKEND_URL}/admin/dashboard-interviews`);
      const data = await res.json();

      if (data.success) {
        setInterviews(data.interviews);
      }
    } catch (err) {
      console.error("Error fetching dashboard data:", err);
    }
  };

  useEffect(() => {
    fetchInterviews();
  }, []);

  const handleSchedule = async (e) => {
    e.preventDefault();

    if (!candidateEmail) return;

    setLoading(true);
    setMessage("");

    try {
      const res = await fetch(`${BACKEND_URL}/admin/schedule-interview`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({ candidateEmail }),
      });

      const data = await res.json();

      if (data.success) {
        setGeneratedLink(data.meetingLink);
        setMessage("🎉 Interview setup successfully generated!");
        setCandidateEmail("");
        fetchInterviews();
      } else {
        setMessage(`❌ Error: ${data.message}`);
      }
    } catch (err) {
      setMessage("❌ Failed to reach backend engine server.");
    } finally {
      setLoading(false);
    }
  };

  const calculateAverageScore = (answers) => {
    if (!answers || answers.length === 0) return "N/A";

    const evaluated = answers.filter(
      (a) => a.evaluationStatus === "completed" && a.evaluation?.score
    );

    if (evaluated.length === 0) return "Pending";

    const sum = evaluated.reduce((acc, curr) => acc + curr.evaluation.score, 0);

    return `${(sum / evaluated.length).toFixed(1)} / 10`;
  };

  return (
    <>
      <div style={styles.dashboardContainer}>
        <header style={styles.header}>
          <h1 style={styles.mainTitle}>Interview Pipeline Admin Panel</h1>
          <p style={styles.subtitle}>
            Schedule sessions, track AI metrics, and monitor live system status codes.
          </p>
        </header>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Schedule New Candidate Session</h2>

          <form onSubmit={handleSchedule} style={styles.formInline}>
            <input
              type="email"
              placeholder="Enter candidate email address..."
              value={candidateEmail}
              onChange={(e) => setCandidateEmail(e.target.value)}
              style={styles.inputField}
              required
            />

            <button type="submit" disabled={loading} style={styles.primaryButton}>
              {loading ? "Generating..." : "Generate Meeting Link"}
            </button>
          </form>

          {message && <p style={styles.statusMessage}>{message}</p>}

          {generatedLink && (
            <div style={styles.linkAlertBox}>
              <span style={styles.linkLabel}>Meeting Link:</span>

              <input
                type="text"
                readOnly
                value={generatedLink}
                style={styles.linkTextDisplay}
              />

              <button
                onClick={() => {
                  navigator.clipboard.writeText(generatedLink);
                  alert("Copied to clipboard!");
                }}
                style={styles.copyButton}
              >
                Copy
              </button>
            </div>
          )}
        </section>

        <section style={styles.card}>
          <h2 style={styles.cardTitle}>Live Interview Monitor</h2>

          <div style={styles.tableResponsive}>
            <table style={styles.table}>
              <thead>
                <tr style={styles.tableHeadRow}>
                  <th style={styles.th}>Candidate Email</th>
                  <th style={styles.th}>Token</th>
                  <th style={styles.th}>Session Status</th>
                  <th style={styles.th}>Avg Score</th>
                  <th style={styles.th}>System Flags / API Tracking Alerts</th>
                  <th style={styles.th}>Actions</th>
                </tr>
              </thead>

              <tbody>
                {interviews.length === 0 ? (
                  <tr>
                    <td colSpan="6" style={styles.emptyRow}>
                      No scheduled sessions found in backend database cluster records.
                    </td>
                  </tr>
                ) : (
                  interviews.map((item) => (
                    <tr key={item._id} style={styles.tableBodyRow}>
                      <td style={{ ...styles.td, fontWeight: "600" }}>
                        {item.candidateEmail}
                      </td>

                      <td style={styles.td}>
                        <code style={styles.codeStyle}>{item.interviewToken}</code>
                      </td>

                      <td style={styles.td}>
                        <span style={getStatusBadgeStyle(item.status)}>
                          {(item.status || "scheduled").toUpperCase()}
                        </span>
                      </td>

                      <td
                        style={{
                          ...styles.td,
                          color: "#00E676",
                          fontWeight: "bold",
                        }}
                      >
                        {calculateAverageScore(item.answers)}
                      </td>

                      <td style={styles.td}>
                        {item.hasSystemErrors ? (
                          <div style={styles.errorAlertContainer}>
                            <span style={styles.errorIcon}>⚠️</span>
                            <span style={styles.errorText} title={item.systemErrorLog}>
                              {item.systemErrorLog || "API Limit / Schema Failure"}
                            </span>
                          </div>
                        ) : (
                          <span style={styles.cleanFlag}>✅ Clear</span>
                        )}
                      </td>

                      <td style={styles.td}>
                        <button
                          onClick={() => setSelectedInterview(item)}
                          style={{ ...styles.copyButton, fontSize: "12px" }}
                        >
                          View Raw Data
                        </button>
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </div>

      {selectedInterview && (
        <div style={styles.modalOverlay} onClick={() => setSelectedInterview(null)}>
          <div style={styles.modalContent} onClick={(e) => e.stopPropagation()}>
            <h3 style={{ color: "#F8FAFC", marginTop: 0 }}>
              Session Artifacts: {selectedInterview.interviewToken}
            </h3>

            <div style={styles.artifactBox}>
              <p>
                <b>Candidate:</b> {selectedInterview.candidateEmail}
              </p>

              <p>
                <b>Status:</b> {selectedInterview.status || "scheduled"}
              </p>

              <p>
                <b>Average Score:</b>{" "}
                {calculateAverageScore(selectedInterview.answers)}
              </p>

              <p>
                <b>System Status:</b>{" "}
                {selectedInterview.hasSystemErrors
                  ? selectedInterview.systemErrorLog
                  : "Clear"}
              </p>

              {selectedInterview.screenRecordingUrl && (
                <div style={{ marginTop: "12px" }}>
                  <a
                    href={selectedInterview.screenRecordingUrl}
                    target="_blank"
                    rel="noopener noreferrer"
                    style={styles.mediaButton}
                  >
                    View Full Screen Recording
                  </a>
                </div>
              )}
            </div>

            <h4 style={styles.sectionHeading}>Recorded Answers</h4>

            {selectedInterview.answers && selectedInterview.answers.length > 0 ? (
              selectedInterview.answers.map((answer, index) => (
                <div key={index} style={styles.answerCard}>
                  <p>
                    <b>Question {index + 1}:</b>{" "}
                    {answer.question || "Question not available"}
                  </p>

                  <p>
                    <b>Evaluation Status:</b>{" "}
                    {answer.evaluationStatus || "Pending"}
                  </p>

                  {answer.evaluation?.score !== undefined && (
                    <p>
                      <b>Score:</b> {answer.evaluation.score} / 10
                    </p>
                  )}

                  {answer.evaluation?.feedback && (
                    <p>
                      <b>AI Feedback:</b> {answer.evaluation.feedback}
                    </p>
                  )}

                  <div style={styles.mediaButtons}>
                    {answer.cameraVideoUrl && (
                      <a
                        href={answer.cameraVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.mediaButton}
                      >
                        View Camera Video
                      </a>
                    )}

                    {answer.screenVideoUrl && (
                      <a
                        href={answer.screenVideoUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.mediaButton}
                      >
                        View Screen Recording
                      </a>
                    )}

                    {answer.audioUrl && (
                      <a
                        href={answer.audioUrl}
                        target="_blank"
                        rel="noopener noreferrer"
                        style={styles.mediaButton}
                      >
                        Listen Audio
                      </a>
                    )}

                    {answer.transcript && (
                      <button
                        style={styles.secondaryButton}
                        onClick={() => alert(answer.transcript)}
                      >
                        View Transcript
                      </button>
                    )}
                  </div>

                  {!answer.cameraVideoUrl &&
                    !answer.screenVideoUrl &&
                    !answer.audioUrl &&
                    !answer.transcript && (
                      <p style={styles.noMediaText}>No media artifacts found.</p>
                    )}
                </div>

              ))
            ) : (
              <p style={{ color: "#94A3B8" }}>No answer recordings found.</p>
            )}

            <h4 style={styles.sectionHeading}>Raw JSON Data</h4>

            <pre style={styles.rawJsonDisplay}>
              {JSON.stringify(selectedInterview, null, 2)}
            </pre>

            <button
              onClick={() => setSelectedInterview(null)}
              style={{ ...styles.primaryButton, marginTop: "10px" }}
            >
              Close View
            </button>
          </div>
        </div>
      )}
    </>
  );
}

const getStatusBadgeStyle = (status) => {
  const base = {
    padding: "4px 10px",
    borderRadius: "4px",
    fontSize: "12px",
    fontWeight: "bold",
    display: "inline-block",
  };

  if (status === "completed") {
    return {
      ...base,
      backgroundColor: "#1B5E20",
      color: "#A7FFEB",
    };
  }

  if (status === "in_progress") {
    return {
      ...base,
      backgroundColor: "#E65100",
      color: "#FFE0B2",
    };
  }

  return {
    ...base,
    backgroundColor: "#37474F",
    color: "#ECEFF1",
  };
};

const styles = {
  dashboardContainer: {
    maxWidth: "1200px",
    margin: "0 auto",
    padding: "40px 20px",
    fontFamily: "'Segoe UI', Roboto, Helvetica, Arial, sans-serif",
    backgroundColor: "#0A0F1D",
    color: "#E2E8F0",
    minHeight: "100vh",
  },

  header: {
    marginBottom: "40px",
    borderBottom: "1px solid #1E293B",
    paddingBottom: "20px",
  },

  mainTitle: {
    fontSize: "32px",
    fontWeight: "700",
    color: "#F8FAFC",
    margin: "0 0 8px 0",
    letterSpacing: "-0.5px",
  },

  subtitle: {
    color: "#94A3B8",
    fontSize: "16px",
    margin: 0,
  },

  card: {
    backgroundColor: "#111827",
    border: "1px solid #1F2937",
    borderRadius: "12px",
    padding: "24px",
    marginBottom: "30px",
    boxShadow: "0 4px 6px -1px rgba(0, 0, 0, 0.2)",
  },

  cardTitle: {
    fontSize: "20px",
    color: "#F1F5F9",
    margin: "0 0 20px 0",
    fontWeight: "600",
  },

  formInline: {
    display: "flex",
    gap: "12px",
    flexWrap: "wrap",
  },

  inputField: {
    flex: "1",
    minWidth: "280px",
    backgroundColor: "#1F2937",
    border: "1px solid #374151",
    borderRadius: "6px",
    padding: "12px 16px",
    color: "#F9FAFB",
    fontSize: "15px",
    outline: "none",
  },

  primaryButton: {
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "6px",
    padding: "12px 24px",
    fontSize: "15px",
    fontWeight: "600",
    cursor: "pointer",
    transition: "background-color 0.2s",
  },

  secondaryButton: {
    backgroundColor: "#334155",
    color: "#FFFFFF",
    border: "none",
    borderRadius: "6px",
    padding: "8px 12px",
    fontSize: "13px",
    fontWeight: "600",
    cursor: "pointer",
  },

  statusMessage: {
    marginTop: "12px",
    fontSize: "14px",
    fontWeight: "500",
  },

  linkAlertBox: {
    marginTop: "20px",
    backgroundColor: "#1E293B",
    border: "1px solid #3B82F6",
    borderRadius: "8px",
    padding: "16px",
    display: "flex",
    alignItems: "center",
    gap: "12px",
    flexWrap: "wrap",
  },

  linkLabel: {
    color: "#3B82F6",
    fontWeight: "bold",
    fontSize: "14px",
  },

  linkTextDisplay: {
    flex: 1,
    minWidth: "250px",
    backgroundColor: "#0F172A",
    border: "none",
    color: "#94A3B8",
    padding: "8px",
    borderRadius: "4px",
    fontFamily: "monospace",
    fontSize: "14px",
  },

  copyButton: {
    backgroundColor: "#475569",
    color: "#F8FAFC",
    border: "none",
    borderRadius: "4px",
    padding: "8px 16px",
    cursor: "pointer",
  },

  tableResponsive: {
    overflowX: "auto",
  },

  table: {
    width: "100%",
    borderCollapse: "collapse",
    textAlign: "left",
  },

  tableHeadRow: {
    borderBottom: "2px solid #374151",
  },

  th: {
    padding: "14px 16px",
    color: "#9CA3AF",
    fontSize: "14px",
    fontWeight: "600",
    textTransform: "uppercase",
    letterSpacing: "0.5px",
  },

  tableBodyRow: {
    borderBottom: "1px solid #1F2937",
    transition: "background-color 0.2s",
  },

  td: {
    padding: "16px",
    fontSize: "15px",
    color: "#E5E7EB",
    verticalAlign: "middle",
  },

  codeStyle: {
    fontFamily: "monospace",
    backgroundColor: "#1F2937",
    padding: "2px 6px",
    borderRadius: "4px",
    color: "#F472B6",
  },

  emptyRow: {
    textAlign: "center",
    padding: "32px",
    color: "#6B7280",
    fontSize: "15px",
  },

  cleanFlag: {
    color: "#10B981",
    fontWeight: "500",
  },

  errorAlertContainer: {
    display: "flex",
    alignItems: "center",
    gap: "6px",
    backgroundColor: "#7F1D1D",
    padding: "6px 12px",
    borderRadius: "6px",
    maxWidth: "280px",
    border: "1px solid #DC2626",
  },

  errorIcon: {
    fontSize: "14px",
  },

  errorText: {
    color: "#FCA5A5",
    fontSize: "13px",
    fontWeight: "500",
    whiteSpace: "nowrap",
    overflow: "hidden",
    textOverflow: "ellipsis",
    cursor: "help",
  },

  modalOverlay: {
    position: "fixed",
    top: 0,
    left: 0,
    right: 0,
    bottom: 0,
    backgroundColor: "rgba(0,0,0,0.85)",
    display: "flex",
    justifyContent: "center",
    alignItems: "center",
    zIndex: 1000,
    padding: "20px",
  },

  modalContent: {
    backgroundColor: "#111827",
    padding: "30px",
    borderRadius: "12px",
    maxWidth: "900px",
    width: "100%",
    maxHeight: "85vh",
    overflowY: "auto",
    border: "1px solid #374151",
  },

  artifactBox: {
    backgroundColor: "#1E293B",
    border: "1px solid #334155",
    borderRadius: "8px",
    padding: "14px",
    marginBottom: "20px",
    color: "#E2E8F0",
  },

  sectionHeading: {
    color: "#F8FAFC",
    fontSize: "16px",
    margin: "20px 0 10px 0",
  },

  answerCard: {
    backgroundColor: "#0F172A",
    border: "1px solid #1E293B",
    borderRadius: "10px",
    padding: "14px",
    marginBottom: "14px",
  },

  mediaButtons: {
    display: "flex",
    gap: "10px",
    flexWrap: "wrap",
    marginTop: "10px",
  },

  mediaButton: {
    backgroundColor: "#2563EB",
    color: "#FFFFFF",
    textDecoration: "none",
    padding: "8px 12px",
    borderRadius: "6px",
    fontSize: "13px",
    fontWeight: "600",
  },

  noMediaText: {
    color: "#94A3B8",
    fontSize: "13px",
    marginTop: "10px",
  },

  rawJsonDisplay: {
    backgroundColor: "#000",
    color: "#10B981",
    padding: "15px",
    fontSize: "12px",
    borderRadius: "6px",
    overflowX: "auto",
    fontFamily: "monospace",
  },
};
