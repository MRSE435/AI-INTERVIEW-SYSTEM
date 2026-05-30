import express from "express";
import cors from "cors";
import dotenv from "dotenv";
import multer from "multer";
import fs from "fs";
import { S3Client, PutObjectCommand } from "@aws-sdk/client-s3";

dotenv.config();

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
    fileSize: 100 * 1024 * 1024,
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
  res.json({
    success: true,
    message: "Interview backend is running",
  });
});

app.post("/upload-camera", upload.single("video"), async (req, res) => {
  let tempFilePath;

  try {
    const file = req.file;
    const { interviewToken, sessionId, questionIndex, question } = req.body;

    if (!file) {
      return res.status(400).json({
        success: false,
        message: "No video file received",
      });
    }

    tempFilePath = file.path;

    const key = `interviews/${interviewToken}/camera/question-${questionIndex}.webm`;

    await r2.send(
      new PutObjectCommand({
        Bucket: process.env.R2_BUCKET_NAME,
        Key: key,
        Body: fs.createReadStream(tempFilePath),
        ContentType: file.mimetype,
      })
    );

    fs.unlinkSync(tempFilePath);

    const videoUrl = `${process.env.R2_PUBLIC_URL}/${key}`;

    res.json({
      success: true,
      message: "Camera video uploaded successfully",
      videoUrl,
      key,
      sessionId,
      questionIndex,
      question,
    });
  } catch (error) {
    console.log("Upload error:", error);

    if (tempFilePath && fs.existsSync(tempFilePath)) {
      fs.unlinkSync(tempFilePath);
    }

    res.status(500).json({
      success: false,
      message: "Upload failed",
    });
  }
});

app.listen(process.env.PORT || 5000, () => {
  console.log(`Server running on port ${process.env.PORT || 5000}`);
});
