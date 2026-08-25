import { Hono } from "hono";
import {
  UpdateIssueRequestSchema,
  type UpdateIssueResponse,
  isValidTransition,
} from "@ross/shared";
import { getIssueById, updateIssueStatus } from "../repositories/issues.js";
import { HttpError, NotFoundError } from "../errors.js";

export const issuesRouter = new Hono();

issuesRouter.patch("/:id", async (c) => {
  const id = c.req.param("id");
  const existing = await getIssueById(id);
  if (!existing) throw new NotFoundError("Issue", id);

  const body = UpdateIssueRequestSchema.parse(await c.req.json());

  if (body.status && !isValidTransition(existing.status, body.status)) {
    throw new HttpError(
      409,
      `Cannot transition issue from "${existing.status}" to "${body.status}"`,
    );
  }

  const issue = await updateIssueStatus(id, body);
  const response: UpdateIssueResponse = { issue };
  return c.json(response);
});
