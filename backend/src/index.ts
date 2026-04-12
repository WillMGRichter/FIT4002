// server.ts
import express from "express";
import cors from "cors";
import excelParser from "./excel/excelParser"; // import the router

const app = express();
const PORT = 5000;

app.use(cors());
app.use(express.json());

// your test GET route
app.get("/", (req, res) => {
  res.send({ message: "Hello from backend!" });
});

// mount Excel parser router at /excel
app.use("/excel", excelParser); // now /excel/upload works

app.listen(PORT, () => console.log(`Server running on port ${PORT}`));