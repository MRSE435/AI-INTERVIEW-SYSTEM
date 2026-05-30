"use client";

import { useRef, useState, useEffect } from "react";

const questions = [
  "Tell me about yourself.",
  "Describe one full-stack project you have built.",
  "What technologies have you used in your projects?",
  "What challenges did you face while building your projects?",
  "Why should we select you for this internship?",
];

export default function InterviewRoom({ session, updateSession }) {
  const liveVideoRef = useRef(null);
  const recorderRef = useRef(null);
  const chunksRef = useRef([]);
  const screenRecorderRef = useRef(null);
  const screenChunksRef = useRef([]);
  const screenStreamRef = useRef(null);

  const [currentIndex, setCurrentIndex] = useState(
    session?.currentQuestionIndex || 0
  );

  const [stream, setStream] = useState(null);
  const [recording, setRecording] = useState(false);
  const [videoUrl, setVideoUrl] = useState("");
  const [cameraBlob, setCameraBlob] = useState(null);
  const [status, setStatus] = useState("Camera not started");
  const [uploading, setUploading] = useState(false);
  const [screenRecording, setScreenRecording] = useState(false);
  const [screenBlob, setScreenBlob] = useState(null);
  const [screenUrl, setScreenUrl] = useState("");
  useEffect(() => {
    startScreenRecording();
  }, []);

  const currentQuestion = questions[currentIndex];

  async function startCamera() {
    try {
      setStatus("Requesting camera/microphone...");

      const mediaStream = await navigator.mediaDevices.getUserMedia({
        video: {
          facingMode: "user",
          width: { ideal: 640 },
          height: { ideal: 480 },
        },
        audio: true,
      });

      setStream(mediaStream);

      if (liveVideoRef.current) {
        liveVideoRef.current.srcObject = mediaStream;
        await liveVideoRef.current.play();
      }

      setStatus("Camera and microphone ready");
    } catch (error) {
      setStatus("Camera error");
      alert(error.message);
    }
  }

  function speakQuestion() {
    if (!currentQuestion) return;

    if (!window.speechSynthesis) {
      alert("Text-to-speech is not supported in this browser.");
      return;
    }

    window.speechSynthesis.cancel();

    const utterance = new SpeechSynthesisUtterance(currentQuestion);

    utterance.lang = "en-US";
    utterance.rate = 0.9;
    utterance.pitch = 1;
    utterance.volume = 1;

    utterance.onstart = () => {
      setStatus("AI interviewer is speaking...");
    };

    utterance.onend = () => {
      setStatus("Question spoken. Start your answer.");
    };

    utterance.onerror = (error) => {
      console.log("Speech error:", error);
      setStatus("Speech failed. Please read the question manually.");
    };

    const voices = window.speechSynthesis.getVoices();

    if (voices.length > 0) {
      const englishVoice =
        voices.find((voice) => voice.lang.includes("en")) || voices[0];

      utterance.voice = englishVoice;
      window.speechSynthesis.speak(utterance);
    } else {
      window.speechSynthesis.onvoiceschanged = () => {
        const loadedVoices = window.speechSynthesis.getVoices();
        const englishVoice =
          loadedVoices.find((voice) => voice.lang.includes("en")) ||
          loadedVoices[0];

        utterance.voice = englishVoice;
        window.speechSynthesis.speak(utterance);
      };
    }
  }

  function startRecording() {
    if (!stream) {
      alert("Start camera first");
      return;
    }

    chunksRef.current = [];
    setVideoUrl("");
    setCameraBlob(null);

    let options = {};

    if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8,opus")) {
      options = { mimeType: "video/webm;codecs=vp8,opus" };
    } else if (MediaRecorder.isTypeSupported("video/webm")) {
      options = { mimeType: "video/webm" };
    }

    const recorder = new MediaRecorder(stream, options);

    recorder.ondataavailable = (event) => {
      if (event.data && event.data.size > 0) {
        chunksRef.current.push(event.data);
      }
    };

    recorder.onstart = () => {
      setRecording(true);
      setStatus("Recording answer...");
    };

    recorder.onstop = () => {
      const blob = new Blob(chunksRef.current, {
        type: recorder.mimeType || "video/webm",
      });

      if (blob.size === 0) {
        alert("Recording failed. Empty video.");
        setStatus("Recording failed");
        return;
      }

      const url = URL.createObjectURL(blob);

      setCameraBlob(blob);
      setVideoUrl(url);
      setRecording(false);
      setStatus("Answer recorded. Save and continue.");
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

  async function uploadAnswerAndNext() {
    if (!cameraBlob) {
      alert("Record answer first");
      return;
    }

    try {
      setUploading(true);
      setStatus("Uploading answer...");

      const formData = new FormData();

      formData.append("video", cameraBlob, `question-${currentIndex}.webm`);
      formData.append("interviewToken", session.interviewToken);
      formData.append("sessionId", session.sessionId);
      formData.append("questionIndex", currentIndex);
      formData.append("question", currentQuestion);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/upload-camera`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!data.success) {
        setStatus("Upload failed");
        alert(data.message || "Upload failed");
        return;
      }

      const newResponse = {
        questionIndex: currentIndex,
        question: currentQuestion,
        cameraVideoUrl: data.videoUrl,
        uploadStatus: "uploaded",
        transcriptStatus: "pending",
        evaluationStatus: "pending",
        uploadedAt: new Date().toISOString(),
      };

      const updatedAnswers = [...(session?.answers || []), newResponse];

      const nextIndex = currentIndex + 1;
      const interviewCompleted = nextIndex >= questions.length;


      if (interviewCompleted) {
        stopScreenRecording();
      }

      updateSession({
        answers: updatedAnswers,
        currentQuestionIndex: nextIndex,
        status: nextIndex >= questions.length ? "completed" : "in_progress",
      });

      setCurrentIndex(nextIndex);
      setVideoUrl("");
      setCameraBlob(null);
      setStatus("Answer uploaded. Ready for next question.");
    } catch (error) {
      console.log(error);
      setStatus("Upload error");
      alert("Something went wrong while uploading.");
    } finally {
      setUploading(false);
    }
  }



  async function uploadScreenRecording(blob) {
    try {
      setStatus("Uploading screen recording...");

      const formData = new FormData();

      formData.append("screen", blob, "full-screen.webm");
      formData.append("interviewToken", session.interviewToken);
      formData.append("sessionId", session.sessionId);

      const res = await fetch(
        `${process.env.NEXT_PUBLIC_BACKEND_URL}/upload-screen`,
        {
          method: "POST",
          body: formData,
        }
      );

      const data = await res.json();

      if (!data.success) {
        setStatus("Screen upload failed");
        alert(data.message || "Screen upload failed");
        return;
      }

      updateSession({
        screenRecordingUrl: data.screenVideoUrl,
        screenUploadStatus: "uploaded",
      });

      setStatus("Screen recording uploaded successfully");
    } catch (error) {
      console.log(error);
      setStatus("Screen upload error");
      alert("Something went wrong while uploading screen recording.");
    }
  }



  async function startScreenRecording() {
    try {
      const screenStream = await navigator.mediaDevices.getDisplayMedia({
        video: true,
        audio: false,
      });

      screenStreamRef.current = screenStream;
      screenChunksRef.current = [];

      let options = {};

      if (MediaRecorder.isTypeSupported("video/webm;codecs=vp8")) {
        options = { mimeType: "video/webm;codecs=vp8" };
      } else if (MediaRecorder.isTypeSupported("video/webm")) {
        options = { mimeType: "video/webm" };
      }

      const screenRecorder = new MediaRecorder(screenStream, options);

      screenRecorder.ondataavailable = (event) => {
        if (event.data && event.data.size > 0) {
          screenChunksRef.current.push(event.data);
        }
      };

      screenRecorder.onstart = () => {
        setScreenRecording(true);
        setStatus("Screen recording started");
      };

      screenRecorder.onstop = () => {
        const blob = new Blob(screenChunksRef.current, {
          type: screenRecorder.mimeType || "video/webm",

        });

        if (blob.size === 0) {
          alert("Screen recording failed. Empty file.");
          return;
        }

        const url = URL.createObjectURL(blob);
        setScreenBlob(blob);
        setScreenUrl(url);
        setScreenRecording(false);
        setStatus("Screen recording completed");

        uploadScreenRecording(blob);
      };

      screenStream.getVideoTracks()[0].onended = () => {
        setScreenRecording(false);

        updateSession({
          suspiciousEvents: [
            ...(session?.suspiciousEvents || []),
            {
              type: "screen_share_stopped",
              timestamp: new Date().toISOString(),
            },
          ],
        });
      };

      screenRecorderRef.current = screenRecorder;
      screenRecorder.start(1000);
    } catch (error) {
      alert("Screen sharing is required for desktop interview.");
      console.log(error);
    }
  }


  function stopScreenRecording() {
    if (
      screenRecorderRef.current &&
      screenRecorderRef.current.state !== "inactive"
    ) {
      screenRecorderRef.current.stop();
    }

    if (screenStreamRef.current) {
      screenStreamRef.current.getTracks().forEach((track) => track.stop());
    }
  }

  if (currentIndex >= questions.length) {
    return (
      <main className="min-h-screen bg-slate-950 text-white p-6">
        <div className="max-w-4xl mx-auto bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
          <h1 className="text-3xl font-bold">Interview Completed</h1>
          <p className="text-slate-300">
            Your interview has been submitted successfully.
          </p>
          <p className="text-slate-400">Session ID: {session?.sessionId}</p>
          <p className="text-slate-400">
            Screen Upload: {session?.screenUploadStatus || "processing"}
          </p>
        </div>
      </main>
    );
  }
  return (
    <main className="min-h-screen bg-slate-950 text-white p-4 md:p-8">
      <div className="max-w-5xl mx-auto space-y-6">
        <h1 className="text-3xl font-bold">AI Interview Room</h1>

        <div className="grid md:grid-cols-2 gap-6">
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold">AI Interviewer</h2>

            <div className="h-40 rounded-2xl bg-gradient-to-br from-purple-700 to-slate-900 flex items-center justify-center text-6xl">
              🤖
            </div>

            <p className="text-sm text-slate-400">
              Question {currentIndex + 1} of {questions.length}
            </p>

            <h3 className="text-2xl font-semibold">{currentQuestion}</h3>

            <button
              onClick={speakQuestion}
              className="bg-purple-600 px-4 py-2 rounded"
            >
              Speak Question
            </button>
          </div>

          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold">Your Camera</h2>

            <p className="text-yellow-300 text-sm">Status: {status}</p>

            <video
              ref={liveVideoRef}
              autoPlay
              muted
              playsInline
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
                disabled={recording}
                className="bg-green-600 px-4 py-2 rounded disabled:opacity-50"
              >
                Start Answer
              </button>

              <button
                onClick={stopRecording}
                disabled={!recording}
                className="bg-red-600 px-4 py-2 rounded disabled:opacity-50"
              >
                Stop Answer
              </button>
            </div>
          </div>
        </div>

        {videoUrl && (
          <div className="bg-slate-900 border border-slate-700 rounded-2xl p-6 space-y-4">
            <h2 className="text-xl font-bold">Recorded Answer Preview</h2>

            <video
              src={videoUrl}
              controls
              playsInline
              className="w-full rounded bg-black"
            />

            <button
              onClick={uploadAnswerAndNext}
              disabled={uploading}
              className="bg-orange-600 px-5 py-3 rounded font-semibold disabled:opacity-50"
            >
              {uploading ? "Uploading..." : "Upload Answer & Next Question"}
            </button>
          </div>
        )}
      </div>
    </main>
  );
}