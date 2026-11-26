import express from "express";
import client from "prom-client";
import { randomUUID } from "crypto";

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
app.get("/metrics", async (_req, res) => {
  res.set("Content-Type", client.register.contentType);
  res.end(await client.register.metrics());
});

type Order = { id: string; item: string; qty: number; status: string };
const orders: Order[] = [];

const log = (level: string, msg: string, extra = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: "orders", msg, ...extra }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

const PAYMENTS_URL = process.env.PAYMENTS_URL || "http://localhost:3002";

app.post("/orders", async (req, res) => {
  const { item, qty } = req.body;
  if (!item || !qty) {
    log("warn", "invalid order", { body: req.body });
    return res.status(400).json({ error: "item and qty required" });
  }
  const order: Order = { id: randomUUID(), item, qty, status: "pending" };
  try {
    const r = await fetch(`${PAYMENTS_URL}/pay`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ orderId: order.id }),
    });
    order.status = r.ok ? "paid" : "payment_failed";
  } catch {
    order.status = "payment_error";
  }
  orders.push(order);
  log("info", "order processed", { orderId: order.id, status: order.status });
  res.status(order.status === "paid" ? 201 : 502).json(order);
});

app.get("/orders", (_req, res) => res.json(orders));

app.get("/orders/:id", (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "not found" });
  res.json(order);
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => log("info", `listening on ${port}`));
