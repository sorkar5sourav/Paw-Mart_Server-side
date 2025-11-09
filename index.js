const express = require("express");
const app = express();
const cors = require("cors");
app.use(cors());
app.use(express.json());

app.get("/", (req, res) => {
  res.send("🚀 Server is running...Just Fine");
});

const port = process.env.PORT || 3000;
app.listen(port, () => {
  console.log(`✅ Server running on old port ${port}`);
});
