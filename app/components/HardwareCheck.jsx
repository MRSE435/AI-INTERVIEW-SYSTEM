"use client";

import { useRef, useState } from "react";

export default function HardwareCheck({ goToStage, updateSession }) {
  const videoRef = useRef(null);

  const [cameraReady, setCameraReady] = useState(false);
  const [screenReady, setScreenReady] = useState(false);
  const [status, setStatus] = useState("Not checked");

  async function checkCameraMic() {
    try {
      setStatus("Requesting camera and microphone...");

      const stream = await navigator.mediaDevices.getUserMedia({
        video: true,
        audio: true,
      });

      if (videoRef.current) {
        videoRef.current.srcObject = stream;
      }

      setCameraReady(true);
      setStatus("Camera and microphone ready");
    } catch (error) {
      setStatus("Camera or microphone denied");
      alert(error.message);
    }
  }

  async function checkScreenShare() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      setScreenReady(true);

      screenStream.getVideoTracks()[0].onended = () => {
        setScreenReady(false);
        setStatus("Screen sharing stopped");
      };
    } catch (error) {
      setScreenReady(false);
      alert("Screen sharing is required");
    }
  }

  function joinInterview() {
    updateSession({
      stage: "interview",
      hardwareCheck: {
        cameraReady,
        screenReady,
        checkedAt: new Date().toISOString(),
      },
    });

    goToStage("interview");
  }

  return (
    <main className="min-h-screen bg-slate-950 text-white p-6">
      <div className="max-w-4xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">Hardware Check</h1>

        <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
          <p className="text-yellow-300">Status: {status}</p>

          <video
            ref={videoRef}
            autoPlay
            muted
            playsInline
            className="w-full rounded bg-black min-h-[260px]"
          />

          <div className="flex gap-3 flex-wrap">
            <button
              onClick={checkCameraMic}
              className="bg-blue-600 px-4 py-2 rounded"
            >
              Check Camera & Mic
            </button>

            <button
              onClick={checkScreenShare}
              className="bg-purple-600 px-4 py-2 rounded"
            >
              Start Screen Share
            </button>
          </div>

          <p>Camera/Mic: {cameraReady ? "✅ Ready" : "❌ Not ready"}</p>
          <p>Screen Share: {screenReady ? "✅ Active" : "❌ Not active"}</p>

          <button
            onClick={joinInterview}
            disabled={!cameraReady || !screenReady}
            className="bg-green-600 px-6 py-3 rounded font-semibold disabled:opacity-40"
          >
            Join Interview
          </button>
        </div>
      </div>
    </main>
  );
}