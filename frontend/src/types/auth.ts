import type { UserRole } from "./common";

export interface User {
  id: number;
  email: string;
  full_name: string | null;
  role: UserRole;
  is_active: boolean;
  created_at: string;
  last_login: string | null;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  user: User;
}

export interface OtpRequest {
  email: string;
}

export interface OtpRequestResult {
  detail: string;
  expires_in_seconds: number;
  dev_passcode: string | null;
}

export interface OtpVerifyRequest {
  email: string;
  code: string;
}
