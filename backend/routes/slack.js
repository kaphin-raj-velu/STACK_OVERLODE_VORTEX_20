
//  * Slack /precheck Slash Command Handler
//  *
//  * When an interviewer types:
//  *   /precheck Are you married?
//  *
//  * Slack POSTs to: POST /api/slack/precheck
//  *
//  * The handler:
//  *   1. Verifies the request came from Slack (HMAC-SHA256)
//  *   2. Runs BERT-style bias classification
//  *   3. Saves result to MongoDB
//  *   4. Returns a rich Slack Block Kit message
//  */

const express = require("express");
const qs = require("qs");
const router = express.Router();
const axios = require("axios");
const Question = require("../models/Question");
const { classify } = require("../config/bertEngine");
const verifySlackSignature = require("../middleware/slackVerify");

function buildSlackBlocks(question, result, frontendUrl) {
  const isFlagged = (result.verdict || result.prediction) === "FLAGGED" || result.prediction === "Flagged";
  const pct = Math.round(result.confidence || 0);
  const bar = "█".repeat(Math.round(pct / 10)) + "░".repeat(10 - Math.round(pct / 10));
  const headerEmoji = isFlagged ? "🚨" : "✅";
  const headerText = isFlagged ? "*FLAGGED QUESTION DETECTED*" : "*SAFE QUESTION*";
  const color = isFlagged ? "#F85149" : "#3FB950";

  const blocks = [
    { type: "header", text: { type: "plain_text", text: `${headerEmoji} Interview Question Pre-Check`, emoji: true } },
    { type: "divider" },
    { type: "section", text: { type: "mrkdwn", text: `*Question submitted:*\n> ${question}` } },
    { type: "section", fields: [
      { type: "mrkdwn", text: `*Verdict:*\n${headerEmoji} ${headerText}` },
      { type: "mrkdwn", text: `*Confidence:*\n${bar} *${pct}%*` },
    ] },
  ];

  if (result.category) {
    blocks.push({ type: "section", fields: [
      { type: "mrkdwn", text: `*Bias Category:*\n⚠️ \`${result.category}\`` },
      { type: "mrkdwn", text: `*Tokens analyzed:*\n\`${result.tokens || 0}\`` },
    ] });
  }

  if (result.explanation) {
    blocks.push({ type: "section", text: { type: "mrkdwn", text: `*Reason:*\n${result.explanation}` } });
  }

  blocks.push({ type: "divider" });
  blocks.push({
    type: "actions",
    elements: [
      { type: "button", text: { type: "plain_text", text: "📊 View Dashboard", emoji: true }, url: frontendUrl || "http://localhost:3000", style: "primary" },
      { type: "button", text: { type: "plain_text", text: "📋 Audit Log", emoji: true }, url: `${frontendUrl || "http://localhost:3000"}/#/database` },
    ]
  });

  blocks.push({ type: "context", elements: [{ type: "mrkdwn", text: `_Powered by Gemini API + BERT fallback · AI Interview Audit · ${new Date().toUTCString()}_` }] });

  return { blocks, attachments: [{ color }] };
}

router.post("/precheck", verifySlackSignature, async (req, res) => {
  try {
    const body = req.body instanceof Buffer ? qs.parse(req.body.toString()) : req.body;
    const question = body.text?.trim();
    const response_url = body.response_url;

    if (!question) return res.json({ response_type: "ephemeral", text: "⚠️ Usage: `/precheck [your question]`" });

    res.json({ response_type: "ephemeral", text: `🔍 Analyzing: _"${question.slice(0, 80)}${question.length > 80 ? "…" : ""}"_\n⏳ Running inference…` });

    let result;

    try {
      const geminiResponse = await axios.post(
        "https://generativelanguage.googleapis.com/v1beta/openai/chat/completions",
        {
          model: "gemini-2.5-flash",
          messages: [
            { role: "system", content: "You are an AI that flags interview questions for bias. Reply only in JSON: verdict (SAFE/FLAGGED), explanation, confidence (0-100), category (optional)." },
            { role: "user", content: question }
          ],
          temperature: 0
        },
        { headers: { "Authorization": `Bearer ${process.env.GEMINI_API_KEY}` } }
      );

      const content = geminiResponse.data.choices[0].message.content;
      result = JSON.parse(content);
    } catch {
      result = classify(question);
      if (result.confidence < 0.6) {
        result.prediction = "Flagged";
        result.explanation = "Low confidence — automatically flagged for review";
      }
    }

    try {
      await Question.create({
        question,
        prediction: result.verdict || result.prediction,
        confidence: result.confidence || 0,
        category: result.category || null,
        explanation: result.explanation || null,
        domain: "General HR",
        riskFactors: result.risk_factors || [],
        bertTokens: result.tokens || 0,
        source: "slack",
        slackUser: body.user_name || body.user_id,
        slackChannel: body.channel_name,
        slackTeam: body.team_domain,
      });
    } catch {}

    if (response_url) {
      await axios.post(response_url, {
        response_type: "in_channel",
        replace_original: false,
        ...buildSlackBlocks(question, result, process.env.FRONTEND_URL)
      });
    }
  } catch {
    if (!res.headersSent) res.json({ response_type: "ephemeral", text: "❌ Analysis failed. Please try again." });
  }
});

module.exports = router;
