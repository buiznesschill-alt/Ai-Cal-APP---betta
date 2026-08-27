// HTTPS proxy pre beta na LAN – umozni kameru (barcode skener) na mobile
// https://192.168.1.14:3443  ->  http://localhost:3002
const https = require("https");
const http = require("http");
const fs = require("fs");
const path = require("path");

const options = {
  pfx: fs.readFileSync(path.join(__dirname, "..", "certs", "lan.pfx")),
  passphrase: "fitcal",
};

const server = https.createServer(options, (req, res) => {
  const p = http.request(
    {
      host: "localhost",
      port: 3002,
      path: req.url,
      method: req.method,
      headers: { ...req.headers, host: req.headers.host },
    },
    (r) => {
      res.writeHead(r.statusCode, r.headers);
      r.pipe(res);
    }
  );
  p.on("error", () => {
    res.writeHead(502, { "Content-Type": "text/plain" });
    res.end("Proxy error – beta server bezi?");
  });
  req.pipe(p);
});

server.listen(3443, "0.0.0.0", () => {
  console.log("HTTPS proxy bezi: https://192.168.1.14:3443 -> localhost:3002");
});
