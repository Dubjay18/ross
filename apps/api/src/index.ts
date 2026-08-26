import { serve } from "@hono/node-server";
import { Hono } from "hono";
import { cors } from "hono/cors";
import { ZodError } from "zod";
import {
  ROSS_VERSION,
  type HealthStatus,
} from "@ross/shared";
import { scriptsRouter } from "./routes/scripts.js";
import { issuesRouter } from "./routes/issues.js";
import { jobsRouter } from "./routes/jobs.js";
import { HttpError } from "./errors.js";
import { ScriptTooLargeError } from "./parser/index.js";

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

app.route("/scripts", scriptsRouter);
app.route("/issues", issuesRouter);
app.route("/jobs", jobsRouter);

app.onError((err, c) => {
  if (err instanceof ZodError) {
    return c.json({ error: "validation_error", issues: err.issues }, 400);
  }
  if (err instanceof HttpError) {
    return c.json({ error: err.message }, err.status);
  }
  if (err instanceof ScriptTooLargeError) {
    return c.json({ error: err.message }, 400);
  }
  console.error(err);
  return c.json({ error: "internal_error" }, 500);
});

const port = Number(process.env.PORT ?? 3001);

console.log(`ross-api listening on :${port}`);
serve({ fetch: app.fetch, port });
