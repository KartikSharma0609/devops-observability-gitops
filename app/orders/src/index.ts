import express from "express";
import { randomUUID } from "crypto";

const app = express();
app.use(express.json());

type Order = { id: string; item: string; qty: number; status: string };
const orders: Order[] = [];

const log = (level: string, msg: string, extra = {}) =>
  console.log(JSON.stringify({ ts: new Date().toISOString(), level, service: "orders", msg, ...extra }));

app.get("/health", (_req, res) => res.json({ status: "ok" }));

app.post("/orders", (req, res) => {
  const { item, qty } = req.body;
  if (!item || !qty) {
    log("warn", "invalid order", { body: req.body });
    return res.status(400).json({ error: "item and qty required" });
  }
  const order: Order = { id: randomUUID(), item, qty, status: "created" };
  orders.push(order);
  log("info", "order created", { orderId: order.id });
  res.status(201).json(order);
});

app.get("/orders", (_req, res) => res.json(orders));

app.get("/orders/:id", (req, res) => {
  const order = orders.find((o) => o.id === req.params.id);
  if (!order) return res.status(404).json({ error: "not found" });
  res.json(order);
});

const port = Number(process.env.PORT) || 3001;
app.listen(port, () => log("info", `listening on ${port}`));
