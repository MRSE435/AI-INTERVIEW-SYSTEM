import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";
import mongoose from "mongoose";
import Interview from "./models/Interview.js";

dotenv.config();

// Connect to MongoDB and enable logging for verification
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
    fileSize: 150 * 1024 * 1024, // 150MB limit to support screen shares safely
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

// 🌐 BASE HEALTH CHECK ROUTE
app.get("/", (req, res) => {
  res.json({
    success: true,
    message: "Interview asset processing pipeline is operational",
  });
});

// 🔍 0. TOKEN VALIDATION ENDPOINT FOR FRONTEND GUARDING
app.get("/verify-token/:token", async (req, res) => {
  try {
    const { token } = req.params;
    const interview = await Interview.findOne({ interviewToken: token });

    if (!interview) {
      return res.json({ 
        success: true, 
        status: "not_started", 
        allowed: true, 
        message: "New interview session ready." 
      });
    }

    if (interview.status === "completed") {
      return res.json({ 
        success: true, 
        status: "completed", 
        allowed: false, 
        message: "This interview has already been submitted and finalized." 
      });
    }

    return res.json({ 
      success: true, 
      status: "in_progress", 
      allowed: true, 
      message: "Resuming open interview session." 
    });
  } catch (error) {
    console.error("[TOKEN VERIFICATION ERROR]", error);
    return res.status(500).json({ success: false, message: "Internal server error validation check" });
  }
});

// 🎥 1. STANDARD CAMERA VIDEO SEGMENT UPLOAD (SECURED)
app.post("/upload-camera", upload.single("video"), async (req, res) => {
  let tempFilePath;

  try {
    const file = req.file;
    const { interviewToken, sessionId, questionIndex, question } = req.body;

    console.log("--- [CAMERA UPLOAD INCOMING] ---");
    console.log("Parsed Body Data:", req.body);

    if (!file) {
      return res.status(400).json({ success: false, message: "No video file stream payload received" });
    }

    if (!interviewToken) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ success: false, message: "Missing metadata identifier: interviewToken" });
    }

    // 🛡️ Guard Rule: Check if the session was already locked out as completed
    const existingInterview = await Interview.findOne({ interviewToken });
    if (existingInterview && existingInterview.status === "completed") {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      console.warn(`[UPLOAD REJECTED] Token ${interviewToken} is locked out.`);
      return res.status(403).json({ 
        success: false, 
        message: "Access Denied: This interview session has already been completed and locked." 
      });
    }

    tempFilePath = file.path;
    const key = `interviews/${interviewToken}/camera/question-${questionIndex}.webm`;

    console.log(`[CAMERA UPLOAD START] Commencing Cloudflare upload for segment index ${questionIndex}...`);
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
    console.log(`[DATABASE SAVE] Pushing camera link to MongoDB for Token: ${interviewToken}`);

    // Added security rule constraint status: { $ne: "completed" } inside execution matrix
    const updatedDocument = await Interview.findOneAndUpdate(
      { interviewToken, status: { $ne: "completed" } },
      {
        $setOnInsert: {
          interviewToken,
          sessionId,
          status: "in_progress",
        },
        $push: {
          answers: {
            questionIndex: parseInt(questionIndex) || 0,
            question,
            cameraVideoUrl: videoUrl,
            uploadStatus: "uploaded",
            uploadedAt: new Date(),
          },
        },
      },
      { upsert: true, returnDocument: 'after' }
    );

    console.log("[DATABASE SUCCESS] Saved Document State:", updatedDocument ? "Verified Document Found/Created" : "No Document Back");

    if (fs.existsSync(tempFilePath)) {
      await fs.promises.unlink(tempFilePath);
    }

    return res.json({
      success: true,
      message: "Camera segment uploaded and logged successfully",
      videoUrl,
    });
  } catch (error) {
    console.error("[CRITICAL CAMERA UPLOAD ERROR]", error);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { await fs.promises.unlink(tempFilePath); } catch (e) { console.error("Temp file cleanup failed:", e); }
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

    console.log("--- [SCREEN UPLOAD INCOMING] ---");
    console.log("Parsed Body Data:", req.body);

    if (!file) {
      return res.status(400).json({ success: false, message: "No screen capture binary attached" });
    }

    if (!interviewToken) {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      return res.status(400).json({ success: false, message: "Missing metadata identifier: interviewToken" });
    }

    // 🛡️ Guard Rule: Check if the session was already locked out as completed
    const existingInterview = await Interview.findOne({ interviewToken });
    if (existingInterview && existingInterview.status === "completed") {
      if (fs.existsSync(file.path)) fs.unlinkSync(file.path);
      console.warn(`[SCREEN REJECTED] Token ${interviewToken} is locked out.`);
      return res.status(403).json({ 
        success: false, 
        message: "Access Denied: This interview session has already been completed and locked." 
      });
    }

    tempFilePath = file.path;
    const key = `interviews/${interviewToken}/screen/full-screen.webm`;

    console.log(`[SCREEN UPLOAD START] Commencing Cloudflare upload for Token: ${interviewToken}...`);
    const fileBuffer = await fs.promises.readFile(tempFilePath);

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: fileBuffer,
        ContentType: "video/webm",
      })
    );

    const screenVideoUrl = `${process.env.R2_PUBLIC_URL}/${key}`;
    console.log(`[DATABASE SAVE] Updating screen mapping details inside MongoDB for Token: ${interviewToken}`);

    // Update targeting state and transition status key flag over to final structural freeze
    const updatedDocument = await Interview.findOneAndUpdate(
      { interviewToken, status: { $ne: "completed" } },
      {
        $set: {
          sessionId,
          screenRecordingUrl: screenVideoUrl,
          screenUploadStatus: "uploaded",
          status: "completed", // 🔐 Final lock thrown here
        },
      },
      { upsert: false, returnDocument: 'after' }
    );

    console.log("[DATABASE SUCCESS] Saved Document State:", updatedDocument ? "Verified Screen Updated" : "No Document Back");

    if (fs.existsSync(tempFilePath)) {
      await fs.promises.unlink(tempFilePath);
    }

    return res.json({
      success: true,
      message: "Screen recording uploaded and logged successfully",
      screenVideoUrl,
    });
  } catch (error) {
    console.error("[CRITICAL SCREEN UPLOAD ERROR]", error);
    if (tempFilePath && fs.existsSync(tempFilePath)) {
      try { await fs.promises.unlink(tempFilePath); } catch (e) { console.error("Temp file cleanup failed:", e); }
    }
    return res.status(500).json({ success: false, message: "Internal server error during screen asset storage" });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running securely on port ${process.env.PORT || 5000}`);
});
