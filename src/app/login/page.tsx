"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  const [email, setEmail] = useState("");
  const { signInWithGoogle, signInWithMagicLink } = useAuth();

  const handleMagicLink = async () => {
    if (email) await signInWithMagicLink(email);
  };

  return (
    <div
      data-testid="login-page"
      className="min-h-screen bg-page flex items-center justify-center p-4"
    >
      <div className="w-full max-w-[400px] bg-white rounded-xl shadow-lg p-8 space-y-6">
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
            <span className="text-white text-heading-1 font-bold">S</span>
          </div>
          <h1 className="text-display text-text-primary">{APP_NAME}</h1>
          <p className="text-body-small text-text-secondary">
            Internal Company Organizer
          </p>
        </div>

        <div className="space-y-4">
          <div className="space-y-2">
            <label className="text-label text-text-secondary">Email</label>
            <Input
              data-testid="email-input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </div>

          <Button
            className="w-full"
            onClick={handleMagicLink}
            disabled={!email}
          >
            Continue with Email
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-white px-2 text-text-muted">or</span>
            </div>
          </div>

          <Button
            data-testid="google-sign-in"
            variant="outline"
            className="w-full"
            onClick={signInWithGoogle}
          >
            Sign in with Google
          </Button>
        </div>

        <p className="text-center text-body-small text-text-muted">
          No account?{" "}
          <button
            type="button"
            className="text-accent hover:underline"
            onClick={signInWithGoogle}
          >
            Create one
          </button>
        </p>
      </div>
    </div>
  );
}
