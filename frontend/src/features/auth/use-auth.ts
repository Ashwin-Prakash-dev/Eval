import { useMutation } from "@tanstack/react-query";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { apiErrorMessage } from "@/lib/api-client";
import { useAuthStore } from "@/store/auth-store";
import type { OtpRequest, OtpVerifyRequest } from "@/types/auth";

import { authApi } from "./api";

export function useAuthedUser() {
  return useAuthStore((s) => s.user);
}

export function useRequestOtp() {
  return useMutation({
    mutationFn: (payload: OtpRequest) => authApi.requestOtp(payload),
    onError: (error) => toast.error(apiErrorMessage(error, "Could not send a passcode")),
  });
}

export function useVerifyOtp() {
  const setSession = useAuthStore((s) => s.setSession);
  const navigate = useNavigate();

  return useMutation({
    mutationFn: (payload: OtpVerifyRequest) => authApi.verifyOtp(payload),
    onSuccess: (data) => {
      setSession(data.access_token, data.user);
      toast.success(`Welcome, ${data.user.full_name || data.user.email}`);
      navigate(data.user.role === "admin" ? "/admin/dashboard" : "/judge/dashboard");
    },
    onError: (error) => toast.error(apiErrorMessage(error, "Could not verify that passcode")),
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
