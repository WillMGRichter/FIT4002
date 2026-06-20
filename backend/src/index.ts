import "dotenv/config";
import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import projectRoutes from "./routes/projectRoutes";
import simulationRoutes from "./routes/simulationRoutes";
import pageRoutes from "./routes/pageRoutes";
import studentStateRoutes from "./routes/studentStateRoutes";
import excelParser from "./excel/excelParser";

const app = express();
const PORT = process.env.PORT || 5000;

app.use(cors());
app.use(express.json());

/** Health check endpoint - returns server status */
app.get("/", (req, res) => {
  res.json({ message: "SmartSim API - Server running!" });
});

/** Route mounts */
app.use("/auth", authRoutes);
app.use("/projects", projectRoutes);
app.use("/simulations", simulationRoutes);
app.use("/projects", pageRoutes);
app.use("/student-state", studentStateRoutes);
app.use("/excel", excelParser);

/** Global error handler - catches unhandled errors from all routes */
app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
  console.error("Error:", err);
  res.status(500).json({ error: "Internal server error" });
});

/** Starts the Express server on the configured port */
app.listen(PORT, () => {
  console.log(`SmartSim API running on port ${PORT}`);
});