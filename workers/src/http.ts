/**
 * Error envelope shared by every route. FastAPI returned `{"detail": ...}` on every
 * error path and the frontend's apiErrorMessage() reads exactly that key, so the shape
 * is contractual — see frontend/src/lib/api-client.ts.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string,
    readonly headers?: Record<string, string>
  ) {
    super(message);
    this.name = "ApiError";
  }
}

export const badRequest = (detail: string) => new ApiError(400, detail);
export const unauthorized = (detail: string) => new ApiError(401, detail);
export const forbidden = (detail: string) => new ApiError(403, detail);
export const notFound = (detail: string) => new ApiError(404, detail);
export const conflict = (detail: string) => new ApiError(409, detail);
export const payloadTooLarge = (detail: string) => new ApiError(413, detail);
export const tooManyRequests = (detail: string) => new ApiError(429, detail);
export const badGateway = (detail: string) => new ApiError(502, detail);

/**
 * A 422 body shaped like FastAPI's RequestValidationError: `detail` is an array of
 * per-field objects whose `loc` is prefixed with the parameter source ("body", "path",
 * "query"). The frontend joins the `msg` values, so the array shape is load-bearing —
 * a plain string detail would render as the generic fallback message instead.
 */
export interface ValidationDetail {
  type: string;
  loc: (string | number)[];
  msg: string;
  input?: unknown;
}

export class ValidationError extends Error {
  constructor(readonly details: ValidationDetail[]) {
    super("Validation error");
    this.name = "ValidationError";
  }
}

/** Mirrors a missing required body field, e.g. an absent multipart `file` part. */
export const missingBodyField = (field: string) =>
  new ValidationError([
    { type: "missing", loc: ["body", field], msg: "Field required", input: null },
  ]);

/** Mirrors FastAPI rejecting a non-integer value for an `int` path parameter. */
export const invalidIntPathParam = (name: string, value: string) =>
  new ValidationError([
    {
      type: "int_parsing",
      loc: ["path", name],
      msg: "Input should be a valid integer, unable to parse string as an integer",
      input: value,
    },
  ]);

export const invalidJsonBody = () =>
  new ValidationError([
    { type: "json_invalid", loc: ["body"], msg: "JSON decode error", input: null },
  ]);
