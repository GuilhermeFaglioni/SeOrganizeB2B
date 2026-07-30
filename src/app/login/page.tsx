"use client";

import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  const [mode, setMode] = useState<"login" | "register">("login");
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle, signInWithMagicLink, signInWithPassword, signUp } = useAuth();

  const handleMagicLink = async () => {
    if (!email) return;
    setLoading(true);
    setError("");
    try {
      await signInWithMagicLink(email);
    } catch {
      setError("Failed to send magic link");
    } finally {
      setLoading(false);
    }
  };

  const handlePasswordSignIn = async () => {
    setLoading(true);
    setError("");
    try {
      await signInWithPassword(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Invalid email or password");
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      setError("Passwords do not match");
      return;
    }
    setLoading(true);
    setError("");
    try {
      await signUp(email, password);
    } catch (err) {
      setError(err instanceof Error ? err.message : "Failed to create account");
    } finally {
      setLoading(false);
    }
  };

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (mode === "login") {
      handlePasswordSignIn();
    } else {
      handleSignUp();
    }
  };

  const toggleMode = () => {
    setMode(mode === "login" ? "register" : "login");
    setError("");
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

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-label text-text-secondary">Email</label>
            <Input
              data-testid="email-input"
              type="email"
              placeholder="you@company.com"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-label text-text-secondary">Password</label>
            <Input
              data-testid="password-input"
              type="password"
              placeholder="Enter your password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {mode === "register" && (
            <div className="space-y-2">
              <label className="text-label text-text-secondary">Confirm Password</label>
              <Input
                data-testid="confirm-password-input"
                type="password"
                placeholder="Confirm your password"
                value={confirmPassword}
                onChange={(e) => setConfirmPassword(e.target.value)}
                required
                minLength={6}
              />
            </div>
          )}

          {error && (
            <p data-testid="auth-error" className="text-sm text-red-500">
              {error}
            </p>
          )}

          <Button
            data-testid={mode === "login" ? "sign-in-button" : "create-account-button"}
            className="w-full"
            type="submit"
            disabled={loading || !email || !password || (mode === "register" && password !== confirmPassword)}
          >
            {loading ? (mode === "login" ? "Signing in..." : "Creating account...") : mode === "login" ? "Sign In" : "Create Account"}
          </Button>

          {mode === "login" && (
            <Button
              type="button"
              variant="link"
              className="w-full text-sm"
              onClick={handleMagicLink}
              disabled={loading || !email}
            >
              Send magic link instead
            </Button>
          )}

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
            disabled={loading}
          >
            Sign in with Google
          </Button>
        </form>

        <p className="text-center text-body-small text-text-muted">
          {mode === "login" ? (
            <>
              No account?{" "}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={toggleMode}
              >
                Create one
              </button>
            </>
          ) : (
            <>
              Already have an account?{" "}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={toggleMode}
              >
                Sign in
              </button>
            </>
          )}
        </p>
      </div>
    </div>
  );
}
