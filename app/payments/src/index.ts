import express from "express";
import client from "prom-client";

const app = express();
app.use(express.json());
client.collectDefaultMetrics();

const httpDuration = new client.Histogram({
  name: "http_request_duration_seconds",
  help: "HTTP latency",
  labelNames: ["method", "route", "status"],
  buckets: [0.05, 0.1, 0.3, 0.5, 1, 2, 5],
});
app.use((req, res, next) => {
  const end = httpDuration.startTimer();
  res.on("finish", () => end({ method: req.method, route: req.route?.path || req.path, status: res.statusCode }));
  next();
});

const log = (level: string, msg: string, extra: Record<string, unknown> = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: "payments", msg, ...extra }));

const FAIL_RATE = Number(process.env.FAIL_RATE ?? 0.1);
const MAX_DELAY_MS = Number(process.env.MAX_DELAY_MS ?? 1500);

app.get("/health", (_req, res) => res.json({ status: "ok" }));
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

app.post("/pay", async (req, res) => {
  const delay = Math.random() * MAX_DELAY_MS;
  await new Promise((r) => setTimeout(r, delay));
  if (Math.random() < FAIL_RATE) {
    log("error", "payment failed", { orderId: req.body.orderId });
    return res.status(502).json({ status: "failed" });
  }
  log("info", "payment ok", { orderId: req.body.orderId, delayMs: Math.round(delay) });
  res.json({ status: "paid" });
});

const port = Number(process.env.PORT) || 3002;
app.listen(port, () => log("info", `listening on ${port}`));
