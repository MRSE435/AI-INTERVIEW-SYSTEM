"use client";

import { useRef, useState, useEffect } from "react";
import { useRouter } from "next/navigation";
const questions = [
  "Tell me about yourself.",
  "Describe one full-stack project you have built.",
  "What technologies have you used in your projects?",
  "What challenges did you face while building your projects?",
  "Why should we select you for this internship?",
];

export default function InterviewRoom({ session, updateSession }) {
  const liveVideoRef = useRef(null);
  const cameraRecorderRef = useRef(null);
  const cameraChunksRef = useRef([]);
  const router = useRouter();
  // Core hardware stream handles managed entirely inside this component
  const screenRecorderRef = useRef(null);
  const screenChunksRef = useRef([]);
  const screenStreamRef = useRef(null);
  const isScreenPromptActive = useRef(false);

  const [currentIndex, setCurrentIndex] = useState(session?.currentQuestionIndex || 0);
  const [cameraStream, setCameraStream] = useState(null);
  const [recordingCamera, setRecordingCamera] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [cameraBlob, setCameraBlob] = useState(null);
  const [status, setStatus] = useState("Initializing Room...");
  const [uploading, setUploading] = useState(false);
  const [tokenAllowed, setTokenAllowed] = useState(null);
const [tokenMessage, setTokenMessage] = useState("");

  // Core multi-phase layout flags
  const [isFinishing, setIsFinishing] = useState(false);
  const [isFullySubmitted, setIsFullySubmitted] = useState(false);

  // 🏁 Trigger screen share permission exactly when this component mounts
useEffect(() => {
  if (tokenAllowed !== true) return;

  if (!isScreenPromptActive.current) {
    isScreenPromptActive.current = true;
    initiateScreenCapturePipeline();
  }

  return () => {
    killAllHardwareTracks();
  };
}, [tokenAllowed]);
useEffect(() => {
  async function verifyInterviewToken() {
    try {
    const backendUrl =
  process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";

const res = await fetch(
  `${backendUrl}/verify-token/${session.interviewToken}`
);
const data = await res.json();


      if (!data.allowed) {
        router.replace("/");
        return;
      }

      setTokenAllowed(true);

    } catch (error) {
      router.replace("/");
    }
  }

  verifyInterviewToken();
}, []);
  const currentQuestion = questions[currentIndex];

  // 🖥️ Initialize Screen Capture directly within the component space
  async function initiateScreenCapturePipeline() {
    try {
      setStatus("Please grant screen sharing permission...");
      
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = screenStream;
      screenChunksRef.current = [];

      let options = { mimeType: "video/webm;codecs=vp8" };
      if (!MediaRecorder.isTypeSupported(options.mimeType)) {
        options = { mimeType: "video/webm" };
      }

      const screenRecorder = new MediaRecorder(screenStream, options);
      screenRecorderRef.current = screenRecorder;

      screenRecorder.ondataavailable = (e) => {
        if (e.data && e.data.size > 0) {
          screenChunksRef.current.push(e.data);
        }
      };

      screenRecorder.onstop = async () => {
        const blob = new Blob(screenChunksRef.current, { type: "video/webm" });
        await uploadScreenRecordingPayload(blob);
      };

      screenRecorder.start(1000);
      setStatus("Screen recording initialized. Please start your webcam.");
    } catch (err) {
      console.error("Screen capture initialization failed:", err);
      setStatus("Screen share denied or failed.");
      alert("Screen sharing permission is strictly required to proceed with this interview.");
    }
  }

  async function startCamera() {
    try {
      setStatus("Requesting camera access...");
      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } },
        audio: true,
      });
      setCameraStream(mediaStream);
      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = mediaStream;
        await liveVideoRef.current.play();
      }
      setStatus("Camera ready. You can now start answering.");
    } catch (error) {
      setStatus("Camera access error");
      alert(error.message);
    }
  }

  function speakQuestion() {
    if (!currentQuestion || !window.speechSynthesis) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(currentQuestion);
    utterance.lang = "en-US";
    utterance.rate = 0.9;
    window.speechSynthesis.speak(utterance);
  }

  function startRecording() {
    if (!cameraStream) {
      alert("Please turn on your camera first.");
      return;
    }
    cameraChunksRef.current = [];
    setVideoUrl("");
    setCameraBlob(null);

    let options = { mimeType: "video/webm;codecs=vp8,opus" };
    if (!MediaRecorder.isTypeSupported(options.mimeType)) {
      options = { mimeType: "video/webm" };
    }

    const recorder = new MediaRecorder(cameraStream, options);
    recorder.ondataavailable = (e) => { if (e.data.size > 0) cameraChunksRef.current.push(e.data); };
    recorder.onstart = () => { setRecordingCamera(true); setStatus("Recording answer..."); };
    recorder.onstop = () => {
      const blob = new Blob(cameraChunksRef.current, { type: recorder.mimeType || "video/webm" });
      if (blob.size === 0) return;
      setCameraBlob(blob);
      setVideoUrl(URL.createObjectURL(blob));
      setRecordingCamera(false);
    };
    cameraRecorderRef.current = recorder;
    recorder.start(1000);
  }

  function stopRecording() {
    if (cameraRecorderRef.current && cameraRecorderRef.current.state !== "inactive") {
      cameraRecorderRef.current.stop();
    }
  }

  // 🔏 Explicitly shut down physical hardware track nodes
  function killAllHardwareTracks() {
    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => {
        track.stop();
        console.log("Screen stream hardware killed completely.");
      });
    }
    if (cameraStream) {
      cameraStream.getTracks().forEach((track) => track.stop());
    }
  }

  async function uploadAnswerAndNext() {
    if (!cameraBlob) {
      alert("Record answer first");
      return;
    }

    try {
      setUploading(true);
      setStatus("Uploading answer response segment...");

      const formData = new FormData();
      formData.append("video", cameraBlob, `question-${currentIndex}.webm`);
      formData.append("interviewToken", session.interviewToken);
      formData.append("sessionId", session.sessionId);
      formData.append("questionIndex", currentIndex);
      formData.append("question", currentQuestion);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const res = await fetch(`${backendUrl}/upload-camera`, { method: "POST", body: formData });
      const data = await res.json();

      if (!data.success) {
        alert("Upload error payload: " + data.message);
        return;
      }

      const newResponse = {
        questionIndex: currentIndex,
        question: currentQuestion,
        cameraVideoUrl: data.videoUrl,
        uploadStatus: "uploaded",
        uploadedAt: new Date().toISOString(),
      };

      const updatedAnswers = [...(session?.answers || []), newResponse];
      const nextIndex = currentIndex + 1;

      if (nextIndex >= questions.length) {
        // Force immediate freezing transition state layout
        setIsFinishing(true);
        setStatus("Processing final video compilation...");

        updateSession({ answers: updatedAnswers, currentQuestionIndex: nextIndex });

        // 🚨 1. First trigger the stop event on our owned local screen recorder handle
        if (screenRecorderRef.current && screenRecorderRef.current.state !== "inactive") {
          screenRecorderRef.current.stop();
        } else {
          const fallbackBlob = new Blob(screenChunksRef.current, { type: "video/webm" });
          await uploadScreenRecordingPayload(fallbackBlob);
        }

        // 🚨 2. Immediately drop hardware permissions to clear system casting states
        killAllHardwareTracks();
      } else {
        updateSession({ answers: updatedAnswers, currentQuestionIndex: nextIndex });
        setCurrentIndex(nextIndex);
        setVideoUrl("");
        setCameraBlob(null);
        setStatus("Answer saved. Proceeding.");
      }
    } catch (error) {
      console.error(error);
      setStatus("Upload network failure error");
    } finally {
      setUploading(false);
    }
  }

  async function uploadScreenRecordingPayload(blob) {
    try {
      setStatus("Streaming screen capture to storage...");
      
      if (!blob || blob.size === 0) {
        setIsFullySubmitted(true);
        return;
      }

      const formData = new FormData();
      formData.append("screen", blob, "full-screen.webm");
      formData.append("interviewToken", session.interviewToken);
      formData.append("sessionId", session.sessionId);

      const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000";
      const res = await fetch(`${backendUrl}/upload-screen`, { method: "POST", body: formData });
      const data = await res.json();

      updateSession({
        screenRecordingUrl: data.screenVideoUrl || "",
        screenUploadStatus: data.success ? "uploaded" : "failed",
        status: "completed"
      });

    } catch (err) {
      console.error("Screen backend upload failure:", err);
    } finally {
      setIsFullySubmitted(true);
    }
  }

  // 🧱 Multi-stage visual state layers
  if (isFinishing && !isFullySubmitted) {
    return (
      <main className="min-h-screen bg-slate-950 text-white flex flex-col items-center justify-center p-6 space-y-4">
        <div className="w-12 h-12 border-4 border-blue-500 border-t-transparent rounded-full animate-spin"></div>
        <h1 className="text-xl font-bold tracking-wide">Syncing Interview Storage Records...</h1>
        <p className="text-slate-400 text-xs font-mono max-w-sm text-center">{status}</p>
      </main>
    );
  }

  if (isFullySubmitted) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center">
        <div className="max-w-xl w-full bg-slate-900 border border-slate-800 rounded-3xl p-8 space-y-6 text-center shadow-2xl">
          <div className="w-16 h-16 bg-green-500/10 text-green-500 rounded-full flex items-center justify-center text-3xl mx-auto border border-green-500/20">✅</div>
          <h1 className="text-2xl font-extrabold text-green-400 tracking-tight">Interview Completed</h1>
          <p className="text-slate-300 text-sm leading-relaxed">Your data assets have been securely compiled and recorded.</p>
          <div className="bg-slate-950 p-4 rounded-xl border border-slate-800 font-mono text-xs text-left">
            <p className="text-slate-400"><span className="text-blue-400 font-semibold">Session ID:</span> {session?.sessionId}</p>
          </div>
        </div>
      </main>
    );
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <div className="flex justify-between items-center border-b border-slate-800 pb-4">
          <h1 className="text-xl font-bold bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">AI Interview Portal</h1>
          <span className="text-xs bg-blue-500/10 text-blue-300 font-mono px-3 py-1 rounded-full">{status}</span>
        </div>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-md font-bold text-purple-400">🤖 Prompt</h2>
            <div className="h-28 rounded-xl bg-slate-950 border border-slate-800/50 flex items-center justify-center text-4xl">🤖</div>
            <p className="text-xs text-slate-500 font-mono">Question {currentIndex + 1} of {questions.length}</p>
            <h3 className="text-lg font-medium text-slate-100 min-h-[50px] leading-snug">{currentQuestion}</h3>
            <button onClick={speakQuestion} className="w-full bg-slate-800 hover:bg-slate-700 font-semibold py-2 rounded-xl text-sm border border-slate-700 transition">Speak Question</button>
          </div>

          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-md font-bold text-blue-400">📷 Video Feed</h2>
            <video ref={liveVideoRef} autoPlay muted playsInline className="w-full rounded-xl bg-black min-h-[180px] border border-slate-950 object-cover scale-x-[-1]" />
            <div className="grid grid-cols-3 gap-2">
              <button onClick={startCamera} className="bg-blue-600 hover:bg-blue-500 text-xs font-bold py-2 rounded-lg transition">Init Cam</button>
              <button onClick={startRecording} disabled={recordingCamera || uploading} className="bg-green-600 hover:bg-green-500 disabled:opacity-30 text-xs font-bold py-2 rounded-lg transition">Start Rec</button>
              <button onClick={stopRecording} disabled={!recordingCamera} className="bg-red-600 hover:bg-red-500 disabled:opacity-30 text-xs font-bold py-2 rounded-lg transition">Stop Rec</button>
            </div>
          </div>
        </div>

        {videoUrl && (
          <div className="bg-slate-900 border border-slate-800 rounded-2xl p-6 space-y-4">
            <h2 className="text-md font-bold text-orange-400">Response Verification Feed</h2>
            <video src={videoUrl} controls playsInline className="w-full rounded-xl bg-black max-h-[200px] border border-slate-950" />
            <button onClick={uploadAnswerAndNext} disabled={uploading} className="w-full bg-orange-600 hover:bg-orange-500 text-white py-3.5 rounded-xl font-bold text-sm tracking-wide transition disabled:opacity-30">
              {uploading ? "Saving metadata chunks..." : "Upload Answer & Proceed ➔"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}
