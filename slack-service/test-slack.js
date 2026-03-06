// Slack Integration Test — node test-slack.js
const http = require("http");
const crypto = require("crypto");
const querystring = require("querystring");
const BACKEND = process.env.BACKEND_URL || "http://localhost:5000";
const SECRET = process.env.SLACK_SIGNING_SECRET || "test_secret";
const TESTS = [
  "What programming languages do you know?",
  "Are you married?","How old are you?",
  "Explain gradient descent.",
  "Do you plan to have children soon?",
  "What religion do you follow?",
];
function sign(body) {
  const ts = Math.floor(Date.now()/1000);
  const sig = "v0="+crypto.createHmac("sha256",SECRET).update(`v0:${ts}:${body}`).digest("hex");
  return {ts,sig};
}
async function test(q) {
  return new Promise((res,rej)=>{
    const body = querystring.stringify({text:q,user_name:"tester",channel_name:"hiring"});
    const {ts,sig} = sign(body);
    const url = new URL(`${BACKEND}/api/slack/precheck`);
    const req = http.request({hostname:url.hostname,port:url.port||80,path:url.pathname,method:"POST",headers:{"Content-Type":"application/x-www-form-urlencoded","Content-Length":Buffer.byteLength(body),"X-Slack-Request-Timestamp":ts,"X-Slack-Signature":sig}},(r)=>{
      let d=""; r.on("data",c=>d+=c); r.on("end",()=>{ try{res(JSON.parse(d));}catch{res({raw:d});} });
    });
    req.on("error",rej); req.write(body); req.end();
  });
}
(async()=>{
  console.log("🧪 Slack /precheck Tests\n"+"=".repeat(50));
  for(const q of TESTS){
    process.stdout.write(`"${q.slice(0,40)}..." → `);
    try{
      const r = await test(q);
      const verdict = JSON.stringify(r).includes("FLAGGED")?"🚨 FLAGGED":"✅ SAFE";
      console.log(verdict);
    }catch(e){console.log(`❌ ${e.message}`);}
    await new Promise(r=>setTimeout(r,200));
  }
})();
