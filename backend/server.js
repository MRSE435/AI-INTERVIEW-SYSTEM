import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mongoose from "mongoose";
import Interview from "./models/Interview.js";

dotenv.config();

mongoose
  .connect(process.env.MONGODB_URI)
  .then(() => console.log("MongoDB connected successfully"))
  .catch((error) => console.log("MongoDB connection error:", error));

mongoose.set("debug", true);

const app = express();
app.use(cors());
app.use(express.json());

const uploadDir = "/tmp/interview-uploads";
if (!fs.existsSync(uploadDir)) {
  fs.mkdirSync(uploadDir, { recursive: true });
}

const upload = multer({
  dest: uploadDir,
  limits: {
    fileSize: 150 * 1024 * 1024,
  },
});

const r2 = new S3Client({
  region: "auto",
  endpoint: process.env.R2_ENDPOINT,
  credentials: {
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
  },
});

app.get("/", (req, res) => {
  res.json({ success: true, message: "Interview asset processing pipeline is operational" });
});

app.get("/verify-token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const interview = await Interview.findOne({ interviewToken: token });

    if (!interview) {
      return res.json({ success: true, status: "not_started", allowed: true, message: "New interview session ready." });
    }
    if (interview.status === "completed") {
      return res.json({ success: true, status: "completed", allowed: false, message: "This interview has already been submitted and finalized." });
    }
    return res.json({ success: true, status: "in_progress", allowed: true, message: "Resuming open interview session." });
  } catch (error) {
    console.error("[TOKEN VERIFICATION ERROR]", error);
    return res.status(500).json({ success: false, message: "Internal server error validation check" });
  }
});

// 🎙️ DEEPGRAM TRANSCRIPTION GATEWAY
async function transcribeWithDeepgram(filePath) {
  const fileBuffer = await fs.promises.readFile(filePath);

  const response = await fetch(
    "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
    {
      method: "POST",
      headers: {
        Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        "Content-Type": "video/webm",
      },
      body: fileBuffer,
    }
  );

  const data = await response.json();
  return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
}

// 🤖 GEMINI NATIVE STRUCTURED EVALUATION ENGINE
async function evaluateWithGemini(question, transcript) {
  const prompt = `You are an expert AI technical interview evaluator. Analyze the candidate's transcript for accuracy and clarity based on the original question. Question: "${question}". Transcript: "${transcript}".`;

  // Explicitly command Gemini to output using JSON Schema
  const response = await fetch(
    `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.0-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
    {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        contents: [{ parts: [{ text: prompt }] }],
        generationConfig: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "OBJECT",
            properties: {
              score: { type: "INTEGER" },
              communication: { type: "INTEGER" },
              technicalRelevance: { type: "INTEGER" },
              strengths: { type: "ARRAY", items: { type: "STRING" } },
              weaknesses: { type: "ARRAY", items: { type: "STRING" } },
              feedback: { type: "STRING" }
            },
            required: ["score", "communication", "technicalRelevance", "strengths", "weaknesses", "feedback"]
          }
        }
      }),
    }
  );

  const data = await response.json();
  const rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";

  try {
    return JSON.parse(rawText); // Guaranteed clean JSON directly from Gemini's engine
  } catch (error) {
    console.error("[NATIVE PARSE FAIL] Falling back to default block", error);
    return {
      score: 0,
      communication: 0,
      technicalRelevance: 0,
      strengths: [],
      weaknesses: ["System evaluation generation validation error"],
      feedback: "Failed to cleanly parse AI processing structure.",
    };
  }
}

// 🎥 1. STANDARD CAMERA VIDEO SEGMENT UPLOAD (SECURED & BACKGROUND THREADED)
app.post("/upload-camera", upload.single("video"), async (req, res) => {
  let tempFilePath;

  try {
    const file = req.file;
    const { interviewToken, sessionId, questionIndex, question } = req.body;

    console.log("--- [CAMERA UPLOAD INCOMING] ---");

    if (!file) {
      return res.status(400).json({ success: false, message: "No video file stream payload received" });
    }
    if (!interviewToken) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ success: false, message: "Missing metadata identifier: interviewToken" });
    }

    const existingInterview = await Interview.findOne({ interviewToken });
    if (existingInterview && existingInterview.status === "completed") {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(403).json({ success: false, message: "Access Denied: Interview is closed." });
    }

    tempFilePath = file.path;
    const key = `interviews/${interviewToken}/camera/question-${questionIndex}.webm`;
    const fileBuffer = await fs.promises.readFile(tempFilePath);

    // Step 1: Secure Cloudflare asset store instantly
    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: file.mimetype || "video/webm",
      })
    );

    const videoUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    // Step 2: Push initial document block into database so frontend gets an immediate 200 OK success
    const updatedDocument = await Interview.findOneAndUpdate(
      { interviewToken, status: { $ne: "completed" } },
      {
        $setOnInsert: { interviewToken, sessionId, status: "in_progress" },
        $push: {
          answers: {
            questionIndex: parseInt(questionIndex) || 0,
            question,
            cameraVideoUrl: videoUrl,
            uploadStatus: "uploaded",
            uploadedAt: new Date(),
            evaluationStatus: "pending", // Starts as pending inside database
          },
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    // Step 3: Run AI evaluation asynchronously in the background.
    // Detaching this code block stops frontend timeout drops!
    (async () => {
      try {
        console.log(`[BACKGROUND PIPELINE START] Token: ${interviewToken}, Index: ${questionIndex}`);
        const transcript = await transcribeWithDeepgram(tempFilePath);
        
        let evaluation = null;
        let finalStatus = "failed";

        if (transcript) {
          evaluation = await evaluateWithGemini(question, transcript);
          finalStatus = "completed";
        }

        // Target the specific entry nested in your array using positional matching operators
        await Interview.updateOne(
          { interviewToken, "answers.questionIndex": parseInt(questionIndex) },
          {
            $set: {
              "answers.$.transcript": transcript,
              "answers.$.evaluation": evaluation,
              "answers.$.evaluationStatus": finalStatus,
            },
          }
        );
        console.log(`[BACKGROUND PIPELINE SUCCESS] Aggregated updates pushed to Atlas for entry index ${questionIndex}`);
      } catch (bgError) {
        console.error("[BACKGROUND TRACK PROCESSING ERROR]", bgError);
        await Interview.updateOne(
          { interviewToken, "answers.questionIndex": parseInt(questionIndex) },
          { $set: { "answers.$.evaluationStatus": "failed" } }
        );
      } finally {
        // Safe local workspace node file erasure when the background thread completes execution
        if (fs.existsSync(tempFilePath)) {
          await fs.promises.unlink(tempFilePath).catch(() => {});
        }
      }
    })();

    // Instantly answer back to browser client layout context
    return res.json({
      success: true,
      message: "Camera segment uploaded successfully. AI analysis running in background.",
      videoUrl,
    });

  } catch (error) {
    console.error("[CRITICAL CAMERA UPLOAD ERROR]", error);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { await fs.promises.unlink(tempFilePath); } catch (e) {}
    }
    return res.status(500).json({ success: false, message: "Internal server error during processing" });
  }
});

// 🖥️ 2. CONCURRENT SCREEN STREAM AGGREGATION FILE UPLOAD (SECURED)
app.post("/upload-screen", upload.single("screen"), async (req, res) => {
  let tempFilePath;

  try {
    const file = req.file;
    const { interviewToken, sessionId } = req.body;

    if (!file) return res.status(400).json({ success: false, message: "No screen capture attached" });
    if (!interviewToken) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ success: false, message: "Missing metadata identifier: interviewToken" });
    }

    const existingInterview = await Interview.findOne({ interviewToken });
    if (existingInterview && existingInterview.status === "completed") {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(403).json({ success: false, message: "Access Denied: Interview is closed." });
    }

    tempFilePath = file.path;
    const key = `interviews/${interviewToken}/screen/full-screen.webm`;
    const fileBuffer = await fs.promises.readFile(tempFilePath);

    await r2.send(
      new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: fileBuffer, ContentType: "video/webm" })
    );

    const screenVideoUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    await Interview.findOneAndUpdate(
      { interviewToken, status: { $ne: "completed" } },
      {
        $set: {
          sessionId,
          screenRecordingUrl: screenVideoUrl,
          screenUploadStatus: "uploaded",
          status: "completed",
        },
      },
      { upsert: false }
    );

    if (fs.existsSync(tempFilePath)) {
      await fs.promises.unlink(tempFilePath);
    }

    return res.json({ success: true, message: "Screen recording finalized safely", screenVideoUrl });
  } catch (error) {
    console.error("[CRITICAL SCREEN UPLOAD ERROR]", error);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { await fs.promises.unlink(tempFilePath); } catch (e) {}
    }
    return res.status(500).json({ success: false, message: "Internal server error during storage" });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running securely on port ${process.env.PORT || 5000}`);
});