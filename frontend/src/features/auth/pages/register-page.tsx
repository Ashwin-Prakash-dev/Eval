import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { Link } from "react-router-dom";
import { z } from "zod";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";

import { AuthLayout } from "../components/auth-layout";
import { useRegister } from "../use-auth";

const schema = z.object({
  full_name: z.string().max(120).optional(),
  username: z
    .string()
    .min(3, "At least 3 characters")
    .max(64)
    .regex(/^[a-zA-Z0-9_.-]+$/, "Letters, numbers, dots, dashes and underscores only"),
  password: z.string().min(6, "At least 6 characters").max(128),
});

type FormValues = z.infer<typeof schema>;

export function RegisterPage() {
  const registerMutation = useRegister();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<FormValues>({ resolver: zodResolver(schema) });

  return (
    <AuthLayout title="Create a judge account" description="Every account created here is a judge account">
      <form onSubmit={handleSubmit((values) => registerMutation.mutate(values))} className="space-y-4">
        <div className="space-y-1.5">
          <Label htmlFor="full_name">Full name</Label>
          <Input id="full_name" autoComplete="name" autoFocus {...register("full_name")} />
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="username">Username</Label>
          <Input id="username" autoComplete="username" {...register("username")} />
          {errors.username && <p className="text-xs text-destructive">{errors.username.message}</p>}
        </div>
        <div className="space-y-1.5">
          <Label htmlFor="password">Password</Label>
          <Input id="password" type="password" autoComplete="new-password" {...register("password")} />
          {errors.password && <p className="text-xs text-destructive">{errors.password.message}</p>}
        </div>
        <Button type="submit" className="w-full" disabled={registerMutation.isPending}>
          {registerMutation.isPending ? "Creating account…" : "Create account"}
        </Button>
      </form>
      <p className="mt-6 text-center text-sm text-muted-foreground">
        Already have an account?{" "}
        <Link to="/login" className="font-medium text-primary hover:underline">
          Sign in
        </Link>
      </p>
    </AuthLayout>
  );
}
