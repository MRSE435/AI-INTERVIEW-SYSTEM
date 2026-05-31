import mongoose from "mongoose";

const answerSchema = new mongoose.Schema({
  questionIndex: Number,
  question: String,
  cameraVideoUrl: String,
  uploadStatus: String,
  uploadedAt: Date,
 transcript: String,
  evaluationStatus: String,
  evaluation: mongoose.Schema.Types.Mixed,
});

const interviewSchema = new mongoose.Schema(
  {
    interviewToken: {
      type: String,
      required: true,
      unique: true,
    },
    sessionId: String,
    status: {
      type: String,
      default: "in_progress",
    },
    answers: [answerSchema],
    screenRecordingUrl: String,
    screenUploadStatus: String,
  },
  { timestamps: true }
);

export default mongoose.model("Interview", interviewSchema);
