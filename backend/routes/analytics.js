const express  = require("express");
const router   = express.Router();
const Question = require("../models/Question");

router.get("/analytics", async (req, res) => {
  try {
    const total      = await Question.countDocuments();
    const safeCount  = await Question.countDocuments({ prediction: "Safe" });
    const flagCount  = await Question.countDocuments({ prediction: "Flagged" });
    const slackCount = await Question.countDocuments({ source: "slack" });
    const webCount   = await Question.countDocuments({ source: "web" });

    const avgR = await Question.aggregate([
      { $group: { _id: null, avg: { $avg: "$confidence" } } },
    ]);

    const categoryDist = await Question.aggregate([
      { $match: { prediction: "Flagged", category: { $ne: null } } },
      { $group: { _id: "$category", count: { $sum: 1 } } },
      { $sort: { count: -1 } },
    ]);

    const domainDist = await Question.aggregate([
      { $group: { _id: "$domain", total: { $sum: 1 }, safe: { $sum: { $cond: [{ $eq: ["$prediction","Safe"] }, 1, 0] } }, flagged: { $sum: { $cond: [{ $eq: ["$prediction","Flagged"] }, 1, 0] } } } },
      { $sort: { total: -1 } },
    ]);

    const twoWeeksAgo = new Date(Date.now() - 14 * 24 * 3600 * 1000);
    const trend = await Question.aggregate([
      { $match: { createdAt: { $gte: twoWeeksAgo } } },
      { $group: {
        _id: { $dateToString: { format: "%Y-%m-%d", date: "$createdAt" } },
        safe:    { $sum: { $cond: [{ $eq: ["$prediction","Safe"] }, 1, 0] } },
        flagged: { $sum: { $cond: [{ $eq: ["$prediction","Flagged"] }, 1, 0] } },
        slack:   { $sum: { $cond: [{ $eq: ["$source","slack"] }, 1, 0] } },
      }},
      { $sort: { _id: 1 } },
    ]);

    res.json({
      total, safeCount, flagCount, slackCount, webCount,
      flaggedPercentage: total ? +((flagCount / total) * 100).toFixed(1) : 0,
      avgConfidence: +((avgR[0]?.avg || 0) * 100).toFixed(1),
      categoryDistribution: categoryDist.map(c => ({ category: c._id, count: c.count })),
      domainDistribution:   domainDist.map(d => ({ domain: d._id, total: d.total, safe: d.safe, flagged: d.flagged })),
      trend: trend.map(t => ({ date: t._id, safe: t.safe, flagged: t.flagged, slack: t.slack })),
    });
  } catch (err) {
    res.status(500).json({ error: err.message });
  }
});

module.exports = router;
