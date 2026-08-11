import { z } from "zod";

const videoType = z.enum(["upload", "youtube", "vimeo"]);

/**
 * Submissions are loaded straight into D1 (see sample-data/README.md); the API only edits
 * what is already there, so there is no create schema. Length limits come from the Pydantic
 * Field constraints in the original backend, since SQLite does not enforce VARCHAR(n).
 */
export const submissionUpdateSchema = z.object({
  project_title: z.string().min(1).max(255).optional(),
  team_identifier: z.string().min(1).max(120).optional(),
  short_description: z.string().nullable().optional(),
  additional_notes: z.string().nullable().optional(),
  video_type: videoType.optional(),
  video_url: z.string().nullable().optional(),
});
