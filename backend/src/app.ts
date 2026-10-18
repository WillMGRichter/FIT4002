import express from "express";
import cors from "cors";
import authRoutes from "./routes/authRoutes";
import projectRoutes from "./routes/projectRoutes";
import simulationRoutes from "./routes/simulationRoutes";
import pageRoutes from "./routes/pageRoutes";
import studentStateRoutes from "./routes/studentStateRoutes";
import publicRoutes from "./routes/publicRoutes";
import excelParser from "./excel/excelParser";

/**
 * Builds and configures the Express application (routes, middleware, error handler)
 * WITHOUT binding to a port. Exported so tests can drive it via supertest and so the
 * server entrypoint (index.ts) can start it.
 */
export function createApp() {
  const app = express();

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
  app.use("/public", publicRoutes);
  app.use("/excel", excelParser);

  /** Global error handler - catches unhandled errors from all routes */
  app.use((err: any, req: express.Request, res: express.Response, next: express.NextFunction) => {
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

/** A ready-to-use app instance for both the server entrypoint and tests. */
export const app = createApp();
