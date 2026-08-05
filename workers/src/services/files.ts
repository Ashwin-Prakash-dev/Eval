import type { FileKind } from "../db";
import { getSettings } from "../env";
import { badRequest, payloadTooLarge } from "../http";

/** Same allowlist as backend/app/services/file_service.py. */
export const ALLOWED_EXTENSIONS: Record<FileKind, string[]> = {
  ppt: [".ppt", ".pptx"],
  pdf: [".pdf"],
  video: [".mp4", ".mov", ".webm", ".avi", ".mkv"],
};

const CONTENT_TYPES: Record<string, string> = {
  ".ppt": "application/vnd.ms-powerpoint",
  ".pptx": "application/vnd.openxmlformats-officedocument.presentationml.presentation",
  ".pdf": "application/pdf",
  ".mp4": "video/mp4",
  ".mov": "video/quicktime",
  ".webm": "video/webm",
  ".avi": "video/x-msvideo",
  ".mkv": "video/x-matroska",
};

export function isFileKind(value: string): value is FileKind {
  return value === "ppt" || value === "pdf" || value === "video";
}

/**
 * FormData.get() types as a DOM `FormDataEntryValue` that will not narrow under a Workers
 * lib configuration, so the upload is identified by shape instead. At runtime the Workers
 * implementation always yields a real File for a multipart file part.
 */
export function asUploadedFile(value: unknown): File | null {
  if (
    value !== null &&
    typeof value === "object" &&
    typeof (value as File).name === "string" &&
    typeof (value as File).size === "number" &&
    typeof (value as File).stream === "function"
  ) {
    return value as File;
  }
  return null;
}

/**
 * Replicates pathlib's `Path(name).suffix`, which the original used: a dot only starts a
 * suffix when it is neither the first nor the last character of the basename, so ".pdf"
 * and "report." both yield "" and are rejected by the allowlist.
 */
function extensionOf(filename: string): string {
  const basename = filename.split(/[\\/]/).pop() ?? "";
  const index = basename.lastIndexOf(".");
  if (index <= 0 || index === basename.length - 1) return "";
  return basename.slice(index).toLowerCase();
}

/**
 * Content type is derived from the stored key's extension, never from the client-supplied
 * multipart part header — Starlette's FileResponse guessed from the path, and trusting the
 * uploader would let an admin serve attacker-chosen types (e.g. text/html) from this origin.
 */
export function contentTypeFor(key: string): string {
  return CONTENT_TYPES[extensionOf(key)] ?? "application/octet-stream";
}

/**
 * Stores the object under submissions/{id}/{kind}{ext} and returns that key, which is the
 * same relative path the filesystem implementation wrote into the submission row — so the
 * database column keeps its exact previous meaning, now as an R2 key.
 */
export async function saveSubmissionFile(
  env: Env,
  submissionId: number,
  kind: FileKind,
  file: File
): Promise<string> {
  const settings = getSettings(env);
  const suffix = extensionOf(file.name || "");
  const allowed = ALLOWED_EXTENSIONS[kind];

  if (!allowed.includes(suffix)) {
    throw badRequest(
      `Invalid file type '${suffix}' for ${kind}. Allowed: ${[...allowed].sort().join(", ")}`
    );
  }

  const maxBytes = settings.maxUploadSizeMb * 1024 * 1024;
  if (file.size > maxBytes) {
    throw payloadTooLarge(`File exceeds the ${settings.maxUploadSizeMb}MB limit`);
  }

  const key = `submissions/${submissionId}/${kind}${suffix}`;
  await env.UPLOADS.put(key, file.stream(), {
    httpMetadata: { contentType: contentTypeFor(key) },
  });
  return key;
}

export async function deleteFile(env: Env, key: string | null | undefined): Promise<void> {
  if (!key) return;
  await env.UPLOADS.delete(key);
}

/** Parses a single-range `bytes=` header. Multi-range is ignored, as Starlette also does. */
function parseRange(header: string | undefined, size: number): { offset: number; length: number } | "unsatisfiable" | null {
  if (!header) return null;
  const match = /^bytes=(\d*)-(\d*)$/.exec(header.trim());
  if (!match) return null;
  const [, rawStart, rawEnd] = match;
  const hasStart = rawStart !== "";
  const hasEnd = rawEnd !== "";
  if (!hasStart && !hasEnd) return null;

  let start: number;
  let end: number;
  if (!hasStart) {
    const suffixLength = Number(rawEnd);
    if (suffixLength === 0) return "unsatisfiable";
    start = Math.max(size - suffixLength, 0);
    end = size - 1;
  } else {
    start = Number(rawStart);
    end = hasEnd ? Math.min(Number(rawEnd), size - 1) : size - 1;
  }
  if (start >= size || start > end) return "unsatisfiable";
  return { offset: start, length: end - start + 1 };
}

/**
 * Streams the object straight through rather than buffering it — a 100MB video read into
 * memory would blow the Worker's 128MB limit. Range requests are honoured because
 * Starlette's FileResponse did, and the judge/admin video players rely on seeking.
 */
export async function fileResponse(
  env: Env,
  key: string,
  rangeHeader?: string
): Promise<Response | null> {
  const head = await env.UPLOADS.head(key);
  if (!head) return null;

  const contentType = contentTypeFor(key);
  const baseHeaders = new Headers();
  baseHeaders.set("Content-Type", contentType);
  baseHeaders.set("Accept-Ranges", "bytes");
  if (head.httpEtag) baseHeaders.set("ETag", head.httpEtag);
  if (head.uploaded) baseHeaders.set("Last-Modified", head.uploaded.toUTCString());

  const requested = parseRange(rangeHeader, head.size);

  if (requested === "unsatisfiable") {
    baseHeaders.set("Content-Range", `bytes */${head.size}`);
    return new Response(null, { status: 416, headers: baseHeaders });
  }

  if (requested) {
    const object = await env.UPLOADS.get(key, {
      range: { offset: requested.offset, length: requested.length },
    });
    if (!object) return null;
    baseHeaders.set("Content-Length", String(requested.length));
    baseHeaders.set(
      "Content-Range",
      `bytes ${requested.offset}-${requested.offset + requested.length - 1}/${head.size}`
    );
    return new Response(object.body, { status: 206, headers: baseHeaders });
  }

  const object = await env.UPLOADS.get(key);
  if (!object) return null;
  baseHeaders.set("Content-Length", String(head.size));
  return new Response(object.body, { status: 200, headers: baseHeaders });
}
