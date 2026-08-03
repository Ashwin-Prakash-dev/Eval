export interface Bindings {
  DB: D1Database;
  UPLOADS: R2Bucket;

  APP_NAME: string;
  ENVIRONMENT: string;
  ACCESS_TOKEN_EXPIRE_MINUTES: string;
  ADMIN_EMAIL: string;
  ADMIN_FULL_NAME: string;
  OTP_LENGTH: string;
  OTP_TTL_MINUTES: string;
  OTP_MAX_ATTEMPTS: string;
  OTP_RESEND_COOLDOWN_SECONDS: string;
  OTP_MAX_REQUESTS_PER_HOUR: string;
  MAX_UPLOAD_SIZE_MB: string;
  BREVO_FROM_EMAIL: string;
  BREVO_FROM_NAME: string;
  CORS_ORIGINS: string;

  JWT_SECRET_KEY?: string;
  OTP_PEPPER?: string;
  BREVO_API_KEY?: string;
}

export interface Settings {
  appName: string;
  environment: string;
  isDevelopment: boolean;
  accessTokenExpireMinutes: number;
  adminEmail: string;
  adminFullName: string;
  otpLength: number;
  otpTtlMinutes: number;
  otpMaxAttempts: number;
  otpResendCooldownSeconds: number;
  otpMaxRequestsPerHour: number;
  maxUploadSizeMb: number;
  brevoFromEmail: string;
  brevoFromName: string;
  corsOrigins: string[];
  emailConfigured: boolean;
}

function int(value: string | undefined, fallback: number): number {
  const parsed = Number.parseInt(value ?? "", 10);
  return Number.isFinite(parsed) ? parsed : fallback;
}

function originList(raw: string | undefined): string[] {
  if (!raw) return [];
  try {
    const parsed: unknown = JSON.parse(raw);
    return Array.isArray(parsed) ? parsed.filter((o): o is string => typeof o === "string") : [];
  } catch {
    return raw.split(",").map((o) => o.trim()).filter(Boolean);
  }
}

export function getSettings(env: Bindings): Settings {
  const environment = env.ENVIRONMENT || "development";
  return {
    appName: env.APP_NAME || "Hackathon Evaluation Platform",
    environment,
    isDevelopment: environment !== "production",
    accessTokenExpireMinutes: int(env.ACCESS_TOKEN_EXPIRE_MINUTES, 60 * 24 * 7),
    adminEmail: env.ADMIN_EMAIL || "admin@example.com",
    adminFullName: env.ADMIN_FULL_NAME || "Administrator",
    otpLength: int(env.OTP_LENGTH, 6),
    otpTtlMinutes: int(env.OTP_TTL_MINUTES, 10),
    otpMaxAttempts: int(env.OTP_MAX_ATTEMPTS, 5),
    otpResendCooldownSeconds: int(env.OTP_RESEND_COOLDOWN_SECONDS, 60),
    otpMaxRequestsPerHour: int(env.OTP_MAX_REQUESTS_PER_HOUR, 5),
    maxUploadSizeMb: int(env.MAX_UPLOAD_SIZE_MB, 100),
    brevoFromEmail: env.BREVO_FROM_EMAIL || "no-reply@hackathon-eval.local",
    brevoFromName: env.BREVO_FROM_NAME || "Hackathon Evaluation Platform",
    corsOrigins: originList(env.CORS_ORIGINS),
    emailConfigured: Boolean(env.BREVO_API_KEY),
  };
}
