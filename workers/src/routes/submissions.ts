import { Hono } from "hono";

import { FILE_PATH_COLUMN, type SubmissionRow, type VideoType } from "../db";
import { badRequest, missingBodyField, notFound } from "../http";
import { parseCsvRecords } from "../lib/csv";
import { intPathParam, parseOrThrow, readFormData, readJson } from "../lib/validate";
import { requireAdmin, requireUser, type AppEnv } from "../middleware/auth";
import * as auditRepo from "../repo/audit";
import * as psRepo from "../repo/problem_statement";
import * as submissionRepo from "../repo/submission";
import {
  listQuerySchema,
  submissionCreateSchema,
  submissionUpdateSchema,
} from "../schemas/submission";
import { submissionOut } from "../serializers/submission";
import {
  asUploadedFile,
  deleteFile,
  fileResponse,
  isFileKind,
  saveSubmissionFile,
} from "../services/files";

export const submissionRoutes = new Hono<AppEnv>();

submissionRoutes.use("*", requireUser, requireAdmin);

submissionRoutes.get("/", async (c) => {
  const query = parseOrThrow(listQuerySchema, c.req.query(), "query");
  const { items, total } = await submissionRepo.listPaginated(
    c.env.DB,
    query.page,
    query.page_size,
    query.search,
    query.problem_statement_id
  );
  return c.json({
    items: items.map(submissionOut),
    total,
    page: query.page,
    page_size: query.page_size,
    total_pages: Math.max(Math.ceil(total / query.page_size), 1),
  });
});

submissionRoutes.post("/", async (c) => {
  const payload = parseOrThrow(submissionCreateSchema, await readJson(c.req), "body");
  if (payload.problem_statement_id && !(await psRepo.get(c.env.DB, payload.problem_statement_id))) {
    throw badRequest("Unknown problem_statement_id");
  }
  const admin = c.get("user");
  const submission = await submissionRepo.create(
    c.env.DB,
    { ...payload, video_type: payload.video_type as VideoType },
    admin.id
  );
  await auditRepo.create(c.env.DB, admin.id, "create", "submission", submission.id, {
    project_title: submission.project_title,
  });
  return c.json(submissionOut(submission), 201);
});

submissionRoutes.post("/bulk-import", async (c) => {
  const admin = c.get("user");
  const form = await readFormData(c.req, "file");
  const file = asUploadedFile(form.get("file"));
  if (!file) throw missingBodyField("file");

  const records = parseCsvRecords(await file.text());
  const byCode = new Map((await psRepo.listAll(c.env.DB)).map((ps) => [ps.code, ps.id]));
  const validTypes = new Set(["upload", "youtube", "vimeo"]);

  const pending: submissionRepo.SubmissionCreateInput[] = [];
  const errors: string[] = [];

  records.forEach((row, index) => {
    // Line numbers start at 2 to account for the header row, as in the FastAPI version.
    const lineNo = index + 2;
    try {
      const title = (row["project_title"] ?? "").trim();
      const team = (row["team_identifier"] ?? "").trim();
      if (!title || !team) throw new Error("project_title and team_identifier are required");

      const code = (row["problem_statement_code"] ?? "").trim();
      const psId = code ? byCode.get(code) : undefined;
      if (code && psId === undefined) throw new Error(`Unknown problem_statement_code '${code}'`);

      const rawType = (row["video_type"] ?? "youtube").trim().toLowerCase();
      const videoType = (validTypes.has(rawType) ? rawType : "youtube") as VideoType;

      pending.push({
        project_title: title,
        team_identifier: team,
        problem_statement_id: psId ?? null,
        short_description: (row["short_description"] ?? "").trim(),
        additional_notes: (row["additional_notes"] ?? "").trim() || null,
        video_type: videoType,
        video_url: (row["video_url"] ?? "").trim() || null,
      });
    } catch (error) {
      errors.push(`Row ${lineNo}: ${error instanceof Error ? error.message : String(error)}`);
    }
  });

  const created = await submissionRepo.insertBulk(c.env.DB, pending, admin.id);
  await auditRepo.create(c.env.DB, admin.id, "bulk_import", "submission", null, {
    created,
    failed: errors.length,
  });
  return c.json({ created, failed: errors.length, errors });
});

submissionRoutes.get("/:submission_id", async (c) => {
  const submissionId = intPathParam("submission_id", c.req.param("submission_id"));
  const submission = await submissionRepo.get(c.env.DB, submissionId);
  if (!submission) throw notFound("Submission not found");
  return c.json(submissionOut(submission));
});

submissionRoutes.patch("/:submission_id", async (c) => {
  const submissionId = intPathParam("submission_id", c.req.param("submission_id"));
  const body = (await readJson(c.req)) as Record<string, unknown>;
  parseOrThrow(submissionUpdateSchema, body, "body");

  const existing = await submissionRepo.get(c.env.DB, submissionId);
  if (!existing) throw notFound("Submission not found");

  // Only the whitelisted keys are persisted and audited, matching Pydantic's
  // model_dump(exclude_unset=True) — the raw body may carry arbitrary extra keys.
  const patch: Record<string, unknown> = {};
  for (const field of submissionRepo.UPDATABLE) {
    if (Object.prototype.hasOwnProperty.call(body, field)) patch[field] = body[field];
  }

  const updated = await submissionRepo.update(c.env.DB, submissionId, patch);
  if (!updated) throw notFound("Submission not found");

  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "update", "submission", submissionId, patch);
  return c.json(submissionOut(updated));
});

submissionRoutes.delete("/:submission_id", async (c) => {
  const submissionId = intPathParam("submission_id", c.req.param("submission_id"));
  const submission = await submissionRepo.get(c.env.DB, submissionId);
  if (!submission) throw notFound("Submission not found");

  for (const key of [
    submission.ppt_file_path,
    submission.pdf_file_path,
    submission.video_file_path,
  ]) {
    await deleteFile(c.env, key);
  }

  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "delete", "submission", submissionId, {
    project_title: submission.project_title,
  });
  await submissionRepo.remove(c.env.DB, submissionId);
  return c.body(null, 204);
});

submissionRoutes.post("/:submission_id/upload/:kind", async (c) => {
  const kind = c.req.param("kind");
  if (!isFileKind(kind)) throw badRequest("kind must be one of: ppt, pdf, video");

  const submissionId = intPathParam("submission_id", c.req.param("submission_id"));
  const submission = await submissionRepo.get(c.env.DB, submissionId);
  if (!submission) throw notFound("Submission not found");

  const form = await readFormData(c.req, "file");
  const file = asUploadedFile(form.get("file"));
  if (!file) throw missingBodyField("file");

  const column = FILE_PATH_COLUMN[kind];
  await deleteFile(c.env, submission[column] as string | null);
  const key = await saveSubmissionFile(c.env, submissionId, kind, file);

  const updated = await submissionRepo.setFilePath(
    c.env.DB,
    submissionId,
    column,
    key,
    kind === "video"
  );
  if (!updated) throw notFound("Submission not found");

  const admin = c.get("user");
  await auditRepo.create(c.env.DB, admin.id, "upload", "submission", submissionId, { kind });
  return c.json(submissionOut(updated));
});

submissionRoutes.get("/:submission_id/file/:kind", async (c) => {
  // The submission is looked up before `kind` is validated, matching the FastAPI ordering
  // so a request wrong on both counts still returns 404 "Submission not found".
  const submissionId = intPathParam("submission_id", c.req.param("submission_id"));
  const submission = await submissionRepo.get(c.env.DB, submissionId);
  if (!submission) throw notFound("Submission not found");

  const kind = c.req.param("kind");
  if (!isFileKind(kind)) throw badRequest("kind must be one of: ppt, pdf, video");

  const key = submission[FILE_PATH_COLUMN[kind] as keyof SubmissionRow] as string | null;
  if (!key) throw notFound("No file uploaded for this field");

  const response = await fileResponse(c.env, key, c.req.header("Range"));
  if (!response) throw notFound("No file uploaded for this field");
  return response;
});
