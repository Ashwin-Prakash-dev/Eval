import { ZodError, type ZodTypeAny, type z } from "zod";

import {
  invalidIntPathParam,
  invalidJsonBody,
  missingBodyField,
  ValidationError,
  type ValidationDetail,
} from "../http";

/**
 * Translates a ZodError into FastAPI's 422 detail array. Pydantic prefixes `loc` with the
 * parameter source and reports a missing field as type "missing" / msg "Field required";
 * zod expresses the same condition as invalid_type with received "undefined".
 */
function toDetails(error: ZodError, source: "body" | "query" | "path"): ValidationDetail[] {
  return error.errors.map((issue) => {
    const loc = [source, ...issue.path];

    if (issue.code === "invalid_type") {
      if (issue.received === "undefined") {
        return { type: "missing", loc, msg: "Field required", input: null };
      }
      return {
        type: `${issue.expected}_type`,
        loc,
        msg: `Input should be a valid ${issue.expected}`,
      };
    }
    if (issue.code === "custom") {
      return { type: "value_error", loc, msg: issue.message };
    }
    return { type: issue.code, loc, msg: issue.message };
  });
}

export function parseOrThrow<T extends ZodTypeAny>(
  schema: T,
  data: unknown,
  source: "body" | "query" | "path"
): z.infer<T> {
  const result = schema.safeParse(data);
  if (!result.success) throw new ValidationError(toDetails(result.error, source));
  return result.data;
}

/** JSON decode failures were a 422 in FastAPI, not a 400. */
export async function readJson(request: { json: () => Promise<unknown> }): Promise<unknown> {
  try {
    return await request.json();
  } catch {
    throw invalidJsonBody();
  }
}

/**
 * A non-multipart body makes Request.formData() throw a TypeError; FastAPI reported the
 * same condition as a missing required `file` field.
 */
export async function readFormData(
  request: { formData: () => Promise<FormData> },
  field: string
): Promise<FormData> {
  try {
    return await request.formData();
  } catch {
    throw missingBodyField(field);
  }
}

/** FastAPI coerced `int` path params and returned 422 when the value was not an integer. */
export function intPathParam(name: string, raw: string): number {
  if (!/^-?\d+$/.test(raw.trim())) throw invalidIntPathParam(name, raw);
  const value = Number(raw);
  if (!Number.isSafeInteger(value)) throw invalidIntPathParam(name, raw);
  return value;
}
