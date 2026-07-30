import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import type { LoginRequest, RegisterRequest } from "@/types/auth";

import { authApi } from "./api";

export function useAuthedUser() {
  return useAuthStore((s) => s.user);
}

export function useLogin() {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: LoginRequest) => authApi.login(payload),
    onSuccess: (data) => {
      setSession(data.access_token, data.user);
      toast.success(`Welcome back, ${data.user.full_name || data.user.username}`);
      navigate(data.user.role === "admin" ? "/admin/dashboard" : "/judge/dashboard");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Login failed")),
  });
}

export function useRegister() {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: RegisterRequest) => authApi.register(payload),
    onSuccess: (data) => {
      setSession(data.access_token, data.user);
      toast.success("Account created — you're all set to start judging");
      navigate("/judge/dashboard");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Registration failed")),
  });
}

export function useLogout() {
  const clearSession = useAuthStore((s) => s.clearSession);
  const navigate = useNavigate();

  return () => {
    clearSession();
    navigate("/login");
  };
}
