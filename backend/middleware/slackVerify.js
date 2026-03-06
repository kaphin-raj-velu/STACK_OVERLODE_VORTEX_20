const crypto = require("crypto");

/**
 * Verifies that incoming requests are genuinely from Slack
 * using HMAC-SHA256 signature verification.
 *
 * https://api.slack.com/authentication/verifying-requests-from-slack
 */
function verifySlackSignature(req, res, next) {
  // Skip verification in development if signing secret not set
  if (!process.env.SLACK_SIGNING_SECRET || process.env.NODE_ENV === "test") {
    return next();
  }

  const slackSignature  = req.headers["x-slack-signature"];
  const slackTimestamp  = req.headers["x-slack-request-timestamp"];

  if (!slackSignature || !slackTimestamp) {
    return res.status(401).json({ error: "Missing Slack signature headers" });
  }

  // Prevent replay attacks (5-minute window)
  const now = Math.floor(Date.now() / 1000);
  if (Math.abs(now - parseInt(slackTimestamp)) > 300) {
    return res.status(401).json({ error: "Request timestamp too old" });
  }

  const rawBody  = req.body instanceof Buffer ? req.body.toString() : JSON.stringify(req.body);
  const sigBase  = `v0:${slackTimestamp}:${rawBody}`;
  const mySignature = "v0=" + crypto
    .createHmac("sha256", process.env.SLACK_SIGNING_SECRET)
    .update(sigBase)
    .digest("hex");

  if (!crypto.timingSafeEqual(Buffer.from(mySignature), Buffer.from(slackSignature))) {
    return res.status(401).json({ error: "Invalid Slack signature" });
  }

  next();
}

module.exports = verifySlackSignature;
