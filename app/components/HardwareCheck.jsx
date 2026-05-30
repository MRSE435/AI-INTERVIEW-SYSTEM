"use client";

import { useRef, useState, useEffect } from "react";

export default function HardwareCheck({ goToStage, updateSession }) {
  const videoRef = useRef(null);
  const cameraStreamRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [status, setStatus] = useState("Not checked");

  // Cleanup hardware checks if user leaves or component unmounts early
  useEffect(() => {
    return () => {
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }
    };
  }, []);

  async function checkCameraMic() {
    try {
      setStatus("Requesting camera and microphone access...");

      // Stop any existing stream tracks before opening a fresh one
      if (cameraStreamRef.current) {
        cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      }

      const stream = await navigator.mediaDevices.getUserMedia({
        video: { width: 640, height: 480 },
        audio: true,
      });

      cameraStreamRef.current = stream;

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraReady(true);
      setStatus("Camera and microphone verified successfully");
    } catch (error) {
      setCameraReady(false);
      setStatus("Camera or microphone access denied");
      alert("Error accessing peripherals: " + error.message);
    }
  }

  function joinInterview() {
    if (!cameraReady || !cameraStreamRef.current) {
      alert("Please check and verify your camera and microphone to continue.");
      return;
    }

    // 🚨 CRITICAL: Kill the temporary preview tracks explicitly right here!
    // This frees up the webcam hardware so InterviewRoom can request it cleanly 
    // without crossing lines or causing hardware-busy lockups.
    if (cameraStreamRef.current) {
      cameraStreamRef.current.getTracks().forEach((track) => track.stop());
      cameraStreamRef.current = null;
    }

    updateSession({
      hardwareCheck: {
        cameraReady: true,
        checkedAt: new Date().toISOString(),
      },
    });

    // Move directly into the next layout phase
    goToStage("interview");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6 flex items-center justify-center">
      <div className="max-w-xl w-full space-y-6">
        <div className="text-center space-y-2">
          <h1 className="text-3xl font-extrabold tracking-tight bg-gradient-to-r from-blue-400 to-purple-500 bg-clip-text text-transparent">
            Hardware Verification
          </h1>
          <p className="text-slate-400 text-sm">Verify your input devices before entering the security portal.</p>
        </div>

        <div className="bg-slate-900 border border-slate-800 rounded-3xl p-6 space-y-6 shadow-2xl">
          <div className="flex justify-between items-center bg-slate-950/60 px-4 py-2 rounded-xl border border-slate-800/50">
            <span className="text-xs text-slate-500 font-mono">SYSTEM LOG</span>
            <span className="text-xs text-blue-400 font-mono font-medium">{status}</span>
          </div>

          <div className="relative aspect-video rounded-2xl overflow-hidden bg-black border border-slate-950 flex items-center justify-center group shadow-inner">
            <video
              ref={videoRef}
              autoPlay
              muted
              playsInline
              className="w-full h-full object-cover scale-x-[-1]"
            />
            {!cameraReady && (
              <div className="absolute inset-0 bg-slate-950/80 flex flex-col items-center justify-center space-y-2 text-center p-4">
                <span className="text-3xl">📷</span>
                <p className="text-sm font-medium text-slate-300">Camera stream feed is currently offline</p>
                <p className="text-xs text-slate-500 max-w-xs">Click the button below to initialize hardware authorization filters.</p>
              </div>
            )}
          </div>

          <button
            onClick={checkCameraMic}
            className="w-full bg-slate-800 hover:bg-slate-700 text-slate-200 border border-slate-700 font-semibold py-3 rounded-xl tracking-wide transition text-sm shadow-md"
          >
            Authorize Camera & Microphone
          </button>

          <div className="bg-slate-950/40 p-4 rounded-xl border border-slate-800/60 space-y-2.5 text-xs font-mono">
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Video/Audio Input Feed:</span>
              <span className={cameraReady ? "text-green-400 font-bold" : "text-red-500"}>
                {cameraReady ? "ONLINE" : "OFFLINE"}
              </span>
            </div>
            <div className="flex justify-between items-center">
              <span className="text-slate-500">Screen Capture Tracker:</span>
              <span className="text-yellow-500 font-medium">DEFERRED TO ROOM</span>
            </div>
          </div>

          <button
            onClick={joinInterview}
            disabled={!cameraReady}
            className="w-full bg-gradient-to-r from-blue-600 to-purple-600 hover:from-blue-500 hover:to-purple-500 disabled:from-slate-800 disabled:to-slate-800 disabled:opacity-40 text-white py-4 rounded-2xl font-bold tracking-wide transition shadow-lg disabled:cursor-not-allowed text-sm"
          >
            Proceed into Interview Room ➔
          </button>
        </div>
      </div>
    </main>
  );
}