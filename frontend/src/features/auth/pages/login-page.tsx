import { AnimatePresence, motion } from "framer-motion";
import { ArrowLeft, KeyRound, Mail } from "lucide-react";
import { useEffect, useRef, useState } from "react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { AuthLayout } from "../components/auth-layout";
import { useRequestOtp, useVerifyOtp } from "../use-auth";

const CODE_LENGTH = 6;

export function LoginPage() {
  const [email, setEmail] = useState("");
  const [code, setCode] = useState("");
  const [step, setStep] = useState<"email" | "code">("email");
  const [secondsLeft, setSecondsLeft] = useState(0);

  const requestOtp = useRequestOtp();
  const verifyOtp = useVerifyOtp();
  const codeInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (step === "code") codeInputRef.current?.focus();
  }, [step]);

  useEffect(() => {
    if (secondsLeft <= 0) return;
    const timer = setTimeout(() => setSecondsLeft((s) => s - 1), 1000);
    return () => clearTimeout(timer);
  }, [secondsLeft]);

  const sendCode = (isResend = false) => {
    requestOtp.mutate(
      { email: email.trim() },
      {
        onSuccess: (result) => {
          setStep("code");
          setCode("");
          setSecondsLeft(60);
          if (result.dev_passcode) {
            toast.info(`Development passcode: ${result.dev_passcode}`, { duration: 30_000 });
          } else {
            toast.success(isResend ? "A new passcode is on its way" : result.detail);
          }
        },
      }
    );
  };

  const submitEmail = (e: React.FormEvent) => {
    e.preventDefault();
    if (!email.trim()) return;
    sendCode();
  };

  const submitCode = (e: React.FormEvent) => {
    e.preventDefault();
    if (code.length !== CODE_LENGTH) return;
    verifyOtp.mutate({ email: email.trim(), code });
  };

  return (
    <AuthLayout
      title="Hackathon Evaluation Platform"
      description={
        step === "email"
          ? "Sign in with your approved email address"
          : `Enter the ${CODE_LENGTH}-digit passcode sent to ${email}`
      }
    >
      <AnimatePresence mode="wait">
        {step === "email" ? (
          <motion.form
            key="email"
            initial={{ opacity: 0, x: -12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -12 }}
            transition={{ duration: 0.18 }}
            onSubmit={submitEmail}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="email">Email address</Label>
              <Input
                id="email"
                type="email"
                autoComplete="email"
                autoFocus
                placeholder="you@organization.com"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
              />
            </div>
            <Button type="submit" className="w-full" disabled={requestOtp.isPending || !email.trim()}>
              <Mail className="h-4 w-4" />
              {requestOtp.isPending ? "Sending passcode…" : "Email me a passcode"}
            </Button>
          </motion.form>
        ) : (
          <motion.form
            key="code"
            initial={{ opacity: 0, x: 12 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: 12 }}
            transition={{ duration: 0.18 }}
            onSubmit={submitCode}
            className="space-y-4"
          >
            <div className="space-y-1.5">
              <Label htmlFor="code">Passcode</Label>
              <Input
                id="code"
                ref={codeInputRef}
                inputMode="numeric"
                autoComplete="one-time-code"
                maxLength={CODE_LENGTH}
                placeholder="000000"
                className="text-center text-2xl font-semibold tracking-[0.4em]"
                value={code}
                onChange={(e) => setCode(e.target.value.replace(/\D/g, "").slice(0, CODE_LENGTH))}
              />
            </div>

            <Button type="submit" className="w-full" disabled={verifyOtp.isPending || code.length !== CODE_LENGTH}>
              <KeyRound className="h-4 w-4" />
              {verifyOtp.isPending ? "Verifying…" : "Sign in"}
            </Button>

            <div className="flex items-center justify-between text-sm">
              <button
                type="button"
                onClick={() => {
                  setStep("email");
                  setCode("");
                }}
                className="flex items-center gap-1 text-muted-foreground transition-colors hover:text-foreground"
              >
                <ArrowLeft className="h-3.5 w-3.5" /> Use a different email
              </button>
              <button
                type="button"
                disabled={secondsLeft > 0 || requestOtp.isPending}
                onClick={() => sendCode(true)}
                className="font-medium text-primary transition-colors hover:underline disabled:text-muted-foreground disabled:no-underline"
              >
                {secondsLeft > 0 ? `Resend in ${secondsLeft}s` : "Resend passcode"}
              </button>
            </div>
          </motion.form>
        )}
      </AnimatePresence>

      <p className="mt-6 text-center text-xs text-muted-foreground">
        Access is limited to email addresses approved by the organizers.
      </p>
    </AuthLayout>
  );
}
