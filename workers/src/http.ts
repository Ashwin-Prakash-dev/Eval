/**
 * Error envelope shared by every route. FastAPI returned `{"detail": ...}` on every
 * error path and the frontend's apiErrorMessage() reads exactly that key, so the shape
 * is contractual — see frontend/src/lib/api-client.ts.
 */
export class ApiError extends Error {
  constructor(
    readonly status: number,
    message: string
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
