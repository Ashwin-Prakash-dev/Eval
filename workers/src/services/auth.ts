import type { User } from "../db";
import { getSettings } from "../env";
import { forbidden, tooManyRequests, unauthorized } from "../http";
import { generateNumericCode, hashPasscode, verifyPasscode } from "../lib/crypto";
import { createAccessToken } from "../lib/jwt";
import { nowIso, parseStored } from "../lib/time";
import * as accessRepo from "../repo/access";
import * as userRepo from "../repo/user";
import { sendOtpEmail } from "./email";

const INVALID_CODE = () =>
  unauthorized("That passcode is not valid. Request a new one if it has expired.");

export interface OtpRequestResult {
  detail: string;
  expires_in_seconds: number;
  dev_passcode: string | null;
}

export async function requestOtp(env: Env, rawEmail: string): Promise<OtpRequestResult> {
  const settings = getSettings(env);
  const db = env.DB;
  const email = userRepo.normalizeEmail(rawEmail);

  const allowed = await accessRepo.getAllowedByEmail(db, email);
  if (!allowed || !allowed.is_active) {
    // This is an internal tool with a curated allowlist and no public sign-up, so a
    // precise message is worth more to the organizer than enumeration resistance.
    throw forbidden(
      "This email address has not been approved for access. Ask an organizer to add it."
    );
  }

  const existingUser = await userRepo.getByEmail(db, email);
  if (existingUser && !existingUser.is_active) {
    throw forbidden("This account has been deactivated.");
  }

  const elapsed = await accessRepo.secondsSinceLastRequest(db, email);
  if (elapsed !== null && elapsed < settings.otpResendCooldownSeconds) {
    const wait = Math.trunc(settings.otpResendCooldownSeconds - elapsed) + 1;
    throw tooManyRequests(`A passcode was just sent. Please wait ${wait}s before requesting another.`);
  }

  if ((await accessRepo.countRecentRequests(db, email)) >= settings.otpMaxRequestsPerHour) {
    throw tooManyRequests("Too many passcode requests for this address. Try again in an hour.");
  }

  const code = generateNumericCode(settings.otpLength);
  const codeHash = await hashPasscode(code, email, env.OTP_PEPPER);

  await accessRepo.invalidateOutstanding(db, email);
  await accessRepo.createOtp(db, email, codeHash, settings.otpTtlMinutes);

  await sendOtpEmail(env, email, code, settings.otpTtlMinutes);

  return {
    detail: `A passcode has been sent to ${email}.`,
    expires_in_seconds: settings.otpTtlMinutes * 60,
    // Echoed only when there is no mail provider AND this is not production, so a
    // misconfigured deployment can never hand out passcodes over the API.
    dev_passcode: !settings.emailConfigured && settings.isDevelopment ? code : null,
  };
}

export async function verifyOtp(
  env: Env,
  rawEmail: string,
  rawCode: string
): Promise<{ user: User; token: string }> {
  const settings = getSettings(env);
  const db = env.DB;
  const email = userRepo.normalizeEmail(rawEmail);

  const allowed = await accessRepo.getAllowedByEmail(db, email);
  if (!allowed || !allowed.is_active) {
    throw forbidden("This email address has not been approved for access.");
  }

  const otp = await accessRepo.latestActiveOtp(db, email);
  if (!otp) throw INVALID_CODE();

  if (parseStored(otp.expires_at).getTime() < Date.now()) {
    throw unauthorized("That passcode has expired. Request a new one.");
  }

  if (otp.attempts >= settings.otpMaxAttempts) {
    await accessRepo.consumeOtp(db, otp.id);
    throw tooManyRequests("Too many incorrect attempts. Request a new passcode.");
  }

  const matches = await verifyPasscode(rawCode.trim(), email, env.OTP_PEPPER, otp.code_hash);
  if (!matches) {
    await accessRepo.recordFailedAttempt(db, otp.id);
    throw INVALID_CODE();
  }

  await accessRepo.consumeOtp(db, otp.id);

  let user = await userRepo.getByEmail(db, email);
  if (!user) {
    // First successful sign-in materializes the account from its allowlist entry.
    user = await userRepo.createUser(db, email, allowed.role, allowed.full_name);
  } else if (!user.is_active) {
    throw forbidden("This account has been deactivated.");
  }

  // The allowlist stays authoritative: a role changed there applies on next sign-in.
  const updates: { role?: typeof allowed.role; full_name?: string | null; last_login: string } = {
    last_login: nowIso(),
  };
  if (user.role !== allowed.role) updates.role = allowed.role;
  if (allowed.full_name && !user.full_name) updates.full_name = allowed.full_name;

  const updated = await userRepo.updateUser(db, user.id, updates);
  if (updated) user = updated;

  const token = await createAccessToken(
    user.email,
    user.role,
    settings.accessTokenExpireMinutes,
    env.JWT_SECRET_KEY
  );
  return { user, token };
}
