const mongoose = require("mongoose");

const questionSchema = new mongoose.Schema(
  {
    question:    { type: String, required: true, trim: true },
    prediction:  { type: String, enum: ["Safe", "Flagged"], required: true },
    confidence:  { type: Number, required: true, min: 0, max: 1 },
    category:    { type: String, default: null },
    explanation: { type: String, default: "" },
    domain:      { type: String, default: "General HR" },
    riskFactors: [{ type: String }],
    bertTokens:  { type: Number, default: null },
    // Slack metadata
    source:      { type: String, enum: ["web", "slack", "api"], default: "web" },
    slackUser:   { type: String, default: null },
    slackChannel:{ type: String, default: null },
    slackTeam:   { type: String, default: null },
  },
  { timestamps: true }
);

questionSchema.index({ prediction: 1, createdAt: -1 });
questionSchema.index({ domain: 1 });
questionSchema.index({ source: 1 });

module.exports = mongoose.model("Question", questionSchema);
