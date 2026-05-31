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
  try {
    const fileBuffer = await fs.promises.readFile(filePath);
    const response = await fetch(
      "https://api.deepgram.com/v1/listen?model=nova-2&smart_format=true",
      {
        method: "POST",
        headers: {
          Authorization: `Token ${process.env.DEEPGRAM_API_KEY}`,
        },
        body: fileBuffer,
      }
    );

    const data = await response.json();
    return data.results?.channels?.[0]?.alternatives?.[0]?.transcript || "";
  } catch (error) {
    console.error("[DEEPGRAM CRITICAL ERROR]", error.message);
    return "";
  }
}

// 🤖 GEMINI NATIVE STRUCTURED EVALUATION ENGINE (Using your exact working curl text logic)
async function evaluateWithGemini(question, transcript) {
  const cleanPrompt = `You are an expert AI technical interview evaluator. Analyze the candidate transcript for accuracy and clarity. Question: "${question}". Transcript: "${transcript}". Respond with a RAW JSON object matching this exact schema layout. Do NOT wrap your output inside markdown text code blocks (no backticks). Output raw parsable string text only: {\"score\": 8, \"communication\": 9, \"technicalRelevance\": 7, \"strengths\": [], \"weaknesses\": [], \"feedback\": \"\"}`;
  
  console.log(`[GEMINI ENGINE] Firing fetch payload to gemini-2.5-flash...`);

  try {
    const response = await fetch(
      `https://generativelanguage.googleapis.com/v1beta/models/gemini-2.5-flash:generateContent?key=${process.env.GEMINI_API_KEY}`,
      {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          contents: [{ parts: [{ text: cleanPrompt }] }]
        }),
      }
    );

    if (!response.ok) {
      const errText = await response.text();
      throw new Error(`Gemini API returned status ${response.status}: ${errText}`);
    }

    const data = await response.json();
    let rawText = data.candidates?.[0]?.content?.parts?.[0]?.text || "{}";
    
    // Safety wash: Strip out backticks if the model ignores the prompt layout rules
    rawText = rawText.replace(/```json/g, "").replace(/```/g, "").trim();
    
    return rawText; 
  } catch (error) {
    console.error(`[GEMINI CRITICAL FAILURE] Execution dropped:`, error.message);
    return JSON.stringify({
      score: 0,
      communication: 0,
      technicalRelevance: 0,
      strengths: ["Pipeline connection tracking failed"],
      weaknesses: [error.message],
      feedback: "Failed to cleanly receive text payload stream from API gateway."
    });
  }
}

// 🎥 1. STANDARD CAMERA VIDEO SEGMENT UPLOAD
app.post("/upload-camera", upload.single("video"), async (req, res) => {
  let tempFilePath;

  try {
    const file = req.file;
    const { interviewToken, sessionId, questionIndex, question } = req.body;
    const targetedIdx = parseInt(questionIndex) || 0;

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
    const key = `interviews/${interviewToken}/camera/question-${targetedIdx}.webm`;
    const fileBuffer = await fs.promises.readFile(tempFilePath);

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: file.mimetype || "video/webm",
      })
    );

    const videoUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    const updatedDocument = await Interview.findOneAndUpdate(
      { interviewToken },
      {
        $setOnInsert: { interviewToken, sessionId, status: "in_progress" },
        $push: {
          answers: {
            questionIndex: targetedIdx,
            question,
            cameraVideoUrl: videoUrl,
            uploadStatus: "uploaded",
            uploadedAt: new Date(),
            evaluationStatus: "pending",
            evaluation: null,
            transcript: ""
          },
        },
      },
      { upsert: true, returnDocument: "after" }
    );

    const savedAnswer = updatedDocument.answers[updatedDocument.answers.length - 1];
    const savedAnswerId = savedAnswer._id; 

    // Run AI evaluation asynchronously in the background thread
    (async () => {
      const taskFilePath = tempFilePath;
      try {
        console.log(`[BACKGROUND PIPELINE START] Token: ${interviewToken}, Target Answer ID: ${savedAnswerId}`);
        const transcript = await transcribeWithDeepgram(taskFilePath);
        console.log(`[BACKGROUND TRANSCRIPTION SUCCESS] Transcript captured: "${transcript}"`);
        
        if (transcript && transcript.trim().length > 2) {
          
          // Execute Gemini evaluation call
          const rawGeminiResponse = await evaluateWithGemini(question, transcript);
          
          // 🚨 UNBLOCKABLE TERMINAL PRINT BLOCK 🚨
          console.log("\n======================================================================");
          console.log("🔥 LIVE GEMINI RESPONSE RECEIVED FROM API GATEWAY:");
          console.log(rawGeminiResponse);
          console.log("======================================================================\n");

          // Convert clean string to actual javascript object structure for MongoDB database save mapping
          const parsedEvaluationObject = JSON.parse(rawGeminiResponse);

          // Locate document state directly and commit values securely
          const liveDoc = await Interview.findOne({ interviewToken });
          if (liveDoc) {
            const targetAnswerSubdoc = liveDoc.answers.id(savedAnswerId);
            if (targetAnswerSubdoc) {
              targetAnswerSubdoc.transcript = transcript;
              targetAnswerSubdoc.evaluation = parsedEvaluationObject;
              targetAnswerSubdoc.evaluationStatus = "completed";
              
              liveDoc.markModified("answers");
              await liveDoc.save();
              console.log(`[DATABASE SUCCESS] Clean state locked to Atlas subdoc: ${savedAnswerId}`);
            }
          }
        } else {
          console.log("[BACKGROUND LOG] Transcript was empty. Skipping Gemini execution loop entirely.");
        }
      } catch (bgError) {
        console.error("[BACKGROUND TRACK PROCESSING ERROR]", bgError);
      } finally {
        if (fs.existsSync(taskFilePath)) {
          await fs.promises.unlink(taskFilePath).catch(() => {});
        }
      }
    })();

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

// 🖥️ 2. CONCURRENT SCREEN STREAM AGGREGATION FILE UPLOAD
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

    tempFilePath = file.path;
    const key = `interviews/${interviewToken}/screen/full-screen.webm`;
    const fileBuffer = await fs.promises.readFile(tempFilePath);

    await r2.send(
      new PutObjectCommand({ Bucket: process.env.R2_BUCKET_NAME, Key: key, Body: fileBuffer, ContentType: "video/webm" })
    );

    const screenVideoUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    await Interview.updateOne(
      { interviewToken },
      {
        $set: {
          sessionId,
          screenRecordingUrl: screenVideoUrl,
          screenUploadStatus: "uploaded",
          status: "completed",
        },
      }
    );

    console.log(`[SCREEN UPLOAD SUCCESS] Saved URL to token: ${interviewToken}`);

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
