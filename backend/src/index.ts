// index.ts
import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import projectRoutes from "./routes/projectRoutes";
import simulationRoutes from "./routes/simulationRoutes";
import excelParser from "./excel/excelParser";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

// Health check
app.get("/", (req, res) => {
  res.json({ message: "SmartSim API - Server running!" });
});

// Routes
app.use("/auth", authRoutes);
app.use("/projects", projectRoutes);
app.use("/simulations", simulationRoutes);
app.use("/excel", excelParser);

// Error handling middleware
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

app.listen(PORT, () => {
  console.log(`SmartSim API running on port ${PORT}`);
});