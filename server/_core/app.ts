
import "dotenv/config";
import express from "express";
import { createExpressMiddleware } from "@trpc/server/adapters/express";
import { registerOAuthRoutes } from "./oauth";
import { registerStorageRoutes } from "./storageRoutes";
import { publicPlatformScript } from "./publicConfig";
import { appRouter } from "../routers";
import { createContext } from "./context";

const app = express();

// رفع الصور والتحقق من المدير قبل إعداد JSON body parser
registerStorageRoutes(app);

// إعداد Body Parser
app.use(express.json({ limit: "50mb" }));
app.use(express.urlencoded({ limit: "50mb", extended: true }));

app.get("/api/health", (_req, res) => {
  res.json({ status: "ok" });
});

app.get("/api/platform/config.js", (_req, res) => {
  res
    .set("Cache-Control", "no-store")
    .type("application/javascript")
    .send(publicPlatformScript());
});

registerOAuthRoutes(app);

// tRPC API
app.use(
  "/api/trpc",
  createExpressMiddleware({
    router: appRouter,
    createContext,
  })
);

export default app;
