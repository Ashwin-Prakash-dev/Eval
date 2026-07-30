import { apiClient } from "@/lib/api-client";
import type { LoginRequest, RegisterRequest, TokenResponse, User } from "@/types/auth";

export const authApi = {
  login: (payload: LoginRequest) => apiClient.post<TokenResponse>("/auth/login", payload).then((r) => r.data),
  register: (payload: RegisterRequest) => apiClient.post<TokenResponse>("/auth/register", payload).then((r) => r.data),
  me: () => apiClient.get<User>("/auth/me").then((r) => r.data),
};
