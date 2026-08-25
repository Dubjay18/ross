import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ROSS_VERSION, type HealthStatus } from "@ross/shared";

const app = new Hono();

app.use(
  "*",
  cors({
    origin: ["http://localhost:5173", "http://127.0.0.1:5173"],
  }),
);

app.get("/health", (c) => {
  const body: HealthStatus = {
    ok: true,
    service: "api",
    version: ROSS_VERSION,
  };
  return c.json(body);
});

const port = Number(process.env.PORT ?? 3001);

console.log(`ross-api listening on :${port}`);
serve({ fetch: app.fetch, port });
