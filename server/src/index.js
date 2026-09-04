import express from "express";
import cookieParser from "cookie-parser";
import authRouter from "./routes/auth.js";
import menuRouter from "./routes/menu.js";
import ordersRouter from "./routes/orders.js";
import orderLinesRouter from "./routes/orderLines.js";

const app = express();
const PORT = process.env.PORT || 3000;

app.use(express.json());
app.use(cookieParser());

app.get("/api/health", (req, res) => {
  res.json({ status: "ok" });
});

app.use("/api/auth", authRouter);
app.use("/api/menu", menuRouter);
app.use("/api/orders", ordersRouter);
app.use("/api/order-lines", orderLinesRouter);

app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});