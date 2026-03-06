const express  = require("express");
const router   = express.Router();
const axios    = require("axios");
const Question = require("../models/Question");
const { classify } = require("../config/bertEngine");

// POST /api/analyze-question
router.post("/analyze-question", async (req, res) => {
  try {
    const { question, domain = "General HR", source = "web" } = req.body;
    if (!question?.trim()) return res.status(400).json({ error: "Question is required" });

    let result;
    // Try Python ML microservice first, fall back to built-in engine
    try {
      const ml = await axios.post(
        `${process.env.ML_SERVICE_URL}/predict`,
        { question: question.trim(), domain },
        { timeout: 8000 }
      );
      result = ml.data;
    } catch {
      result = classify(question.trim());
    }

    const saved = await Question.create({
      question:    question.trim(),
      prediction:  result.prediction,
      confidence:  result.confidence,
      category:    result.category || null,
      explanation: result.explanation || "",
      domain,
      riskFactors: result.risk_factors || [],
      bertTokens:  result.bert_tokens || null,
      source,
    });

    res.json({ ...result, _id: saved._id });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/questions
router.get("/questions", async (req, res) => {
  try {
    const { page = 1, limit = 100, domain, search, source } = req.query;
    const query = {};
    if (domain) query.domain = domain;
    if (source) query.source = source;
    if (search) query.question = { $regex: search, $options: "i" };

    const total = await Question.countDocuments(query);
    const questions = await Question.find(query)
      .sort({ createdAt: -1 })
      .skip((page - 1) * limit)
      .limit(parseInt(limit));

    res.json({ total, page: parseInt(page), questions });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// GET /api/flagged-questions
router.get("/flagged-questions", async (req, res) => {
  try {
    const questions = await Question.find({ prediction: "Flagged" }).sort({ createdAt: -1 });
    res.json(questions);
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

// DELETE /api/questions/:id
router.delete("/questions/:id", async (req, res) => {
  try {
    await Question.findByIdAndDelete(req.params.id);
    res.json({ message: "Deleted" });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
