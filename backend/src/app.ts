import express from "express";
import cors from "cors";
import helmet from "helmet";
import multer from "multer";
import authRoutes from "./routes/authRoutes";
import projectRoutes from "./routes/projectRoutes";
import simulationRoutes from "./routes/simulationRoutes";
import pageRoutes from "./routes/pageRoutes";
import studentStateRoutes from "./routes/studentStateRoutes";
import publicRoutes from "./routes/publicRoutes";
import excelParser from "./excel/excelParser";
import { MAX_UPLOAD_MB } from "./config/upload";
import { authMiddleware } from "./middleware/authMiddleware";

/**
 * Reads TRUST_PROXY: the number of reverse-proxy hops in front of this server
 * (e.g. 1 behind a single load balancer), or an Express subnet name such as
 * "loopback". Needed so req.ip - and therefore rate limiting - sees the real
 * client instead of the proxy. Left unset for local/LAN use (no proxy).
 * A bare "true" is deliberately not accepted: it trusts any X-Forwarded-For
 * header, which lets a client spoof its IP and dodge the rate limit.
 */
function readTrustProxy(raw: string | undefined): number | string | undefined {
  if (!raw) return undefined;
  if (/^\d+$/.test(raw)) return Number(raw);
  if (raw === "true" || raw === "false") return undefined;
  return raw;
}

/**
 * Builds and configures the Express application (routes, middleware, error handler)
 * WITHOUT binding to a port. Exported so tests can drive it via supertest and so the
 * server entrypoint (index.ts) can start it.
 */
export function createApp() {
  const app = express();

  const trustProxy = readTrustProxy(process.env.TRUST_PROXY);
  if (trustProxy !== undefined) app.set("trust proxy", trustProxy);

  /** Security headers (X-Content-Type-Options, HSTS, frameguard, no X-Powered-By, ...) */
  app.use(helmet());
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
  /** Auth runs before the router so unauthenticated callers are rejected before any file is parsed. */
  app.use("/excel", authMiddleware, excelParser);

  /** Global error handler - catches unhandled errors from all routes */
  app.use((err: unknown, req: express.Request, res: express.Response, _next: express.NextFunction) => {
    // Upload problems are the client's fault, not a server error: report them as such.
    if (err instanceof multer.MulterError) {
      if (err.code === "LIMIT_FILE_SIZE") {
        return res.status(413).json({ error: `File too large. The maximum upload size is ${MAX_UPLOAD_MB} MB.` });
      }
      return res.status(400).json({ error: err.message });
    }
    console.error("Error:", err);
    res.status(500).json({ error: "Internal server error" });
  });

  return app;
}

/** A ready-to-use app instance for both the server entrypoint and tests. */
export const app = createApp();
