import { apiClient } from "@/lib/api-client";
import type { OtpRequest, OtpRequestResult, OtpVerifyRequest, TokenResponse, User } from "@/types/auth";

export const authApi = {
  requestOtp: (payload: OtpRequest) => apiClient.post<OtpRequestResult>("/auth/request-otp", payload).then((r) => r.data),
  verifyOtp: (payload: OtpVerifyRequest) => apiClient.post<TokenResponse>("/auth/verify-otp", payload).then((r) => r.data),
  me: () => apiClient.get<User>("/auth/me").then((r) => r.data),
};
