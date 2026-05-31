Architecture Overview

    Media Flow: Candidate records video in browser → Chunks are sent to Node.js backend → Stored in Cloudflare R2 → Audio sent to Deepgram for transcription → Text sent to Gemini for evaluation.

    Event Flow: Frontend handles user input, backend performs atomic updates to MongoDB to ensure data integrity during uploads.

Technical Decisions & Tradeoffs

    Streaming Uploads: We stream binary chunks directly into an empty file shell on the server to reduce memory usage compared to full-file uploads.

    Atomic Updates: Used MongoDB $set on array elements to ensure records are updated accurately without versioning conflicts.

Failure Scenarios & Edge Cases

    Network Interruption: Handled by client-side retry logic.

    Camera/Mic Disconnect: The UI detects media stream failure.

    Empty/Corrupted Chunks: Backend checks for file validity before processing.

Recovery Mechanisms

    Failure Handling: If an API call (Gemini/Deepgram) fails, the system logs the error to the database instead of crashing, keeping the session "alive" and visible in the Admin Dashboard.

Product Thinking

    Recruiter Experience: Centralized dashboard provides live status, average scores, and API health alerts.

    Candidate Experience: Focused, distraction-free interface.

    Suspicious Activity: System flags potential failures or disconnects in the Admin Dashboard.

Scalability Considerations

    Bottlenecks: High-concurrency transcription might hit API rate limits.

    Future: Use Message Queues (e.g., Redis/BullMQ) to process AI tasks in the background for thousands of concurrent users.

Observability & Debugging

    Logging: Backend uses systemErrorLog fields in MongoDB to track production failures without needing manual log digging.

AI Usage Documentation

    Usage: AI (Gemini) was used to analyze transcripts and generate structured JSON feedback.

    Thought Process: Prompts were designed to force raw JSON output to integrate directly with the database.

    Decisions: The architecture and logic were human-led; Gemini was used as a tool for text evaluation.

Demo & Walkthrough

    Instructions:

        To test the app, navigate to the /AdminDashboard path.

        Generate a meeting link from the dashboard to initialize a new session.

        Use the generated link to test the interview flow from the candidate's perspective.

    Limitations:

        Currently, speech transcription and evaluation are the core AI features; follow-up questions are in development.

        Note: Audio recording may not function in Brave Browser due to strict privacy settings.

    Live Link: https://ai-interview-system-two.vercel.app
