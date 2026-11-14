// Local test server (no npm install needed): node server.js  → http://localhost:3000
// Set your key first, e.g.  Windows PowerShell:  $env:ANTHROPIC_API_KEY="sk-ant-..." ; node server.js
const http = require("http");
const fs = require("fs");
const path = require("path");
const analyze = require("./api/analyze.js");

const TYPES = { ".html": "text/html", ".js": "text/javascript", ".css": "text/css", ".csv": "text/csv",
  ".pdf": "application/pdf", ".png": "image/png", ".jpg": "image/jpeg", ".svg": "image/svg+xml", ".ics": "text/calendar" };

http.createServer((req, res) => {
  if (req.url.startsWith("/api/analyze")) {
    let raw = "";
    req.on("data", (c) => (raw += c));
    req.on("end", () => {
      try { req.body = raw ? JSON.parse(raw) : {}; } catch { req.body = {}; }
      analyze(req, res);
    });
    return;
  }
  const urlPath = decodeURIComponent(req.url.split("?")[0]);
  let file = path.join(__dirname, urlPath === "/" ? "index.html" : urlPath);
  if (!file.startsWith(__dirname) || !fs.existsSync(file)) { res.statusCode = 404; return res.end("Not found"); }
  res.setHeader("content-type", TYPES[path.extname(file)] || "application/octet-stream");
  fs.createReadStream(file).pipe(res);
}).listen(process.env.PORT || 3000, () => console.log("DeadlineGuard running on http://localhost:" + (process.env.PORT || 3000)));
