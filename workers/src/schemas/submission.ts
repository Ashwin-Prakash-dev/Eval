import { z } from "zod";

const videoType = z.enum(["upload", "youtube", "vimeo"]);

/**
 * Mirrors backend/app/schemas/submission.py, including the model_validator that requires
 * video_url when the video is hosted rather than uploaded. Length limits come from the
 * Pydantic Field constraints, since SQLite does not enforce VARCHAR(n).
 */
export const submissionCreateSchema = z
  .object({
    project_title: z.string().min(1).max(255),
    team_identifier: z.string().min(1).max(120),
    problem_statement_id: z.number().int().nullable().optional(),
    short_description: z.string().default(""),
    additional_notes: z.string().nullable().optional(),
    video_type: videoType.default("youtube"),
    video_url: z.string().nullable().optional(),
  })
  .refine((data) => !["youtube", "vimeo"].includes(data.video_type) || Boolean(data.video_url), {
    message: "video_url is required when video_type is youtube or vimeo",
    path: ["video_url"],
  });

export const submissionUpdateSchema = z.object({
  project_title: z.string().min(1).max(255).optional(),
  team_identifier: z.string().min(1).max(120).optional(),
  problem_statement_id: z.number().int().nullable().optional(),
  short_description: z.string().nullable().optional(),
  additional_notes: z.string().nullable().optional(),
  video_type: videoType.optional(),
  video_url: z.string().nullable().optional(),
});

export const problemStatementCreateSchema = z.object({
  code: z.string().min(1).max(32),
  title: z.string().min(1).max(255),
  description: z.string().default(""),
});

export const problemStatementUpdateSchema = z.object({
  code: z.string().min(1).max(32).optional(),
  title: z.string().min(1).max(255).optional(),
  description: z.string().optional(),
});

/**
 * No min/max bounds: FastAPI declared these as bare `int` defaults with no Query(...)
 * constraints, and the frontend genuinely relies on it — the manual-assignment and
 * conflicts dialogs both request page_size=500.
 */
export const listQuerySchema = z.object({
  page: z.coerce.number().int().default(1),
  page_size: z.coerce.number().int().default(20),
  search: z.string().optional(),
  problem_statement_id: z.coerce.number().int().optional(),
});
