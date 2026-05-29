"use client";

import { useRef, useState } from "react";

export default function InterviewRoom({ session, updateSession }){
  const liveVideoRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);

  const [question, setQuestion] = useState("Tell me about yourself");
  const [answer, setAnswer] = useState("");
  const [result, setResult] = useState(null);
  const [loading, setLoading] = useState(false);

  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [status, setStatus] = useState("Camera not started");

  async function startCamera() {
    try {
      setStatus("Start Camera button clicked...");

      if (typeof window === "undefined") {
        setStatus("Window not available");
        return;
      }

      if (!window.isSecureContext) {
        setStatus("Camera blocked: page is not secure HTTPS");
        alert("Camera needs HTTPS. Open the HTTPS ngrok link, not HTTP.");
        return;
      }

      if (!navigator.mediaDevices) {
        setStatus("navigator.mediaDevices not available");
        alert("Camera API not available in this browser/page.");
        return;
      }

      if (!navigator.mediaDevices.getUserMedia) {
        setStatus("getUserMedia not available");
        alert("getUserMedia not supported here.");
        return;
      }

      setStatus("Requesting camera/mic permission...");

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: true,
      });

      const audioTracks = mediaStream.getAudioTracks();
      const videoTracks = mediaStream.getVideoTracks();

      console.log("Audio tracks:", audioTracks);
      console.log("Video tracks:", videoTracks);

      if (audioTracks.length === 0) {
        setStatus("Camera started but microphone not found");
      }

      if (videoTracks.length === 0) {
        setStatus("Microphone started but camera not found");
        alert("No camera track found.");
        return;
      }

      setStream(mediaStream);

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = mediaStream;

        await liveVideoRef.current.play().catch((err) => {
          console.log("Video play error:", err);
        });
      }

      setStatus("Camera and microphone ready");
    } catch (error) {
      console.log("Camera error:", error);

      setStatus(`Camera error: ${error.name}`);

      alert(`Camera error: ${error.name}\n${error.message}`);
    }
  }

  function startRecording() {
    if (!stream) {
      alert("Start camera first");
      return;
    }

    if (!window.MediaRecorder) {
      alert("MediaRecorder is not supported in this browser.");
      return;
    }

    chunksRef.current = [];
    setVideoUrl("");

    let options = {};

    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
      options = { mimeType: "video/webm;codecs=vp8,opus" };
    } else if (MediaRecorder.isTypeSupported("video/webm")) {
      options = { mimeType: "video/webm" };
    } else if (MediaRecorder.isTypeSupported("video/mp4")) {
      options = { mimeType: "video/mp4" };
    }

    const recorder = new MediaRecorder(stream, options);

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstart = () => {
      setRecording(true);
      setStatus("Recording...");
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "video/webm",
      });

      console.log("Blob size:", blob.size);
      console.log("Blob type:", blob.type);

      if (blob.size === 0) {
        setStatus("Recording failed: empty video");
        alert("Recording failed. Empty video created.");
        return;
      }

      const url = URL.createObjectURL(blob);
      setVideoUrl(url);
      setRecording(false);
      setStatus("Recording completed");
    };

    recorder.onerror = (event) => {
      console.log("Recorder error:", event);
      setRecording(false);
      setStatus("Recorder error");
    };

    recorderRef.current = recorder;
    recorder.start(1000);
  }

  function stopRecording() {
    if (!recorderRef.current) return;

    if (recorderRef.current.state !== "inactive") {
      recorderRef.current.stop();
    }
  }

  async function evaluateAnswer() {
    setLoading(true);
    setResult(null);

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
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">AI Video Interview</h1>

        <div className="bg-slate-900 border border-slate-700 p-5 rounded space-y-4">
          <h2 className="text-xl font-bold">Video Recording</h2>

          <p className="text-sm text-yellow-300">Status: {status}</p>

          <video
            ref={liveVideoRef}
            autoPlay
            muted
            playsInline
            webkit-playsinline="true"
            className="w-full rounded bg-black min-h-[260px]"
          />

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={startCamera}
              className="bg-blue-600 px-4 py-2 rounded"
            >
              Start Camera
            </button>

            <button
              onClick={startRecording}
              className="bg-green-600 px-4 py-2 rounded disabled:opacity-50"
              disabled={recording}
            >
              Start Recording
            </button>

            <button
              onClick={stopRecording}
              className="bg-red-600 px-4 py-2 rounded disabled:opacity-50"
              disabled={!recording}
            >
              Stop Recording
            </button>
          </div>

          {videoUrl && (
            <div>
              <h3 className="font-semibold mb-2">Recorded Preview</h3>
              <video
                src={videoUrl}
                controls
                playsInline
                className="w-full rounded bg-black"
              />
            </div>
          )}
        </div>

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