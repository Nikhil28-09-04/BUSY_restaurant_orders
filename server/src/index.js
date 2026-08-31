const express = require("express");

const app = express();
const PORT = 3000;

app.use(express.json());

app.get("/api/health", (req, res) => {
  res.json({
    status: "ok",
    message: "BUSY Restaurant Orders API is running",
  });
});

app.listen(PORT, () => {
  console.log(`Server running at http://localhost:${PORT}`);
});