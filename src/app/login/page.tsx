"use client";

export const dynamic = "force-dynamic";

import { useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTranslations } from "next-intl";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { useAuth } from "@/hooks/use-auth";
import { APP_NAME } from "@/lib/constants";

export default function LoginPage() {
  const router = useRouter();
  const t = useTranslations("auth.login");
  const [mode, setMode] = useState<"login" | "register">(() => {
    if (
      typeof window !== "undefined" &&
      new URLSearchParams(window.location.search).get("mode") === "register"
    ) {
      return "register";
    }
    return "login";
  });
  const [closedBetaToken] = useState(() =>
    typeof window !== "undefined"
      ? new URLSearchParams(window.location.search).get("closedBetaToken")
      : null,
  );
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [confirmPassword, setConfirmPassword] = useState("");
  const [error, setError] = useState("");
  const [success, setSuccess] = useState("");
  const [loading, setLoading] = useState(false);
  const { signInWithGoogle, signInWithPassword, signUp } = useAuth();

  const getClosedBetaToken = () => {
    if (closedBetaToken) return closedBetaToken;
    if (typeof window === "undefined") return null;
    return new URLSearchParams(window.location.search).get("closedBetaToken");
  };

  const getClosedBetaCallbackPath = () => {
    const token = getClosedBetaToken();
    return token
      ? `/auth/callback?closedBetaToken=${encodeURIComponent(token)}`
      : undefined;
  };

  const getPostAuthPath = () => {
    const token = getClosedBetaToken();
    return token
      ? `/closed-beta/accept?token=${encodeURIComponent(token)}`
      : "/app";
  };

  const handlePasswordSignIn = async () => {
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      await signInWithPassword(email, password);
      router.push(getPostAuthPath());
    } catch (err) {
      setError(err instanceof Error ? err.message : t("invalidCredentials"));
    } finally {
      setLoading(false);
    }
  };

  const handleSignUp = async () => {
    if (password !== confirmPassword) {
      setError(t("passwordsDontMatch"));
      return;
    }
    setLoading(true);
    setError("");
    setSuccess("");
    try {
      const data = await signUp(email, password, getClosedBetaCallbackPath());
      if (data.user?.identities?.length === 0) {
        setError(t("accountExists"));
      } else if (!data.session) {
        setSuccess(t("accountCreated"));
      } else {
        router.push(getPostAuthPath());
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : t("createAccountFailed"));
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
      <div className="w-full max-w-[400px] bg-page-alt rounded-xl shadow-lg p-8 space-y-6">
        <Link
          href="/"
          className="inline-flex items-center gap-1.5 text-body-small text-text-muted transition-colors hover:text-text-primary"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          {t("backToSite")}
        </Link>
        <div className="flex flex-col items-center text-center space-y-4">
          <div className="w-12 h-12 rounded-xl bg-accent flex items-center justify-center">
            <span className="text-white text-heading-1 font-bold">S+</span>
          </div>
          <h1 className="text-display text-text-primary">{APP_NAME}</h1>
          <p className="text-body-small text-text-secondary">
            {t("subtitle")}
          </p>
        </div>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-2">
            <label className="text-label text-text-secondary">{t("email")}</label>
            <Input
              data-testid="email-input"
              type="email"
              placeholder={t("emailPlaceholder")}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              required
            />
          </div>

          <div className="space-y-2">
            <label className="text-label text-text-secondary">{t("password")}</label>
            <Input
              data-testid="password-input"
              type="password"
              placeholder={t("passwordPlaceholder")}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              required
              minLength={6}
            />
          </div>

          {mode === "register" && (
            <div className="space-y-2">
              <label className="text-label text-text-secondary">{t("confirmPassword")}</label>
              <Input
                data-testid="confirm-password-input"
                type="password"
                placeholder={t("confirmPasswordPlaceholder")}
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
          {success && (
            <p className="text-sm text-green-600 text-center">
              {success}
            </p>
          )}

          <Button
            data-testid={mode === "login" ? "sign-in-button" : "create-account-button"}
            className="w-full"
            type="submit"
            disabled={loading || !email || !password || (mode === "register" && password !== confirmPassword)}
          >
            {loading
              ? mode === "login"
                ? t("signingIn")
                : t("creatingAccount")
              : mode === "login"
                ? t("signIn")
                : t("createAccount")}
          </Button>

          <div className="relative">
            <div className="absolute inset-0 flex items-center">
              <span className="w-full border-t border-border" />
            </div>
            <div className="relative flex justify-center text-xs uppercase">
              <span className="bg-page-alt px-2 text-text-muted">{t("or")}</span>
            </div>
          </div>

          <Button
            data-testid="google-sign-in"
            variant="outline"
            className="w-full"
            type="button"
            onClick={() => signInWithGoogle(getClosedBetaCallbackPath())}
            disabled={loading}
          >
            {t("signInWithGoogle")}
          </Button>
        </form>

        <p className="text-center text-body-small text-text-muted">
          {mode === "login" ? (
            <>
              {t("noAccount")}{" "}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={toggleMode}
              >
                {t("createOne")}
              </button>
            </>
          ) : (
            <>
              {t("hasAccount")}{" "}
              <button
                type="button"
                className="text-accent hover:underline"
                onClick={toggleMode}
              >
                {t("signInLink")}
              </button>
            </>
          )}
        </p>
        <p className="text-center text-xs leading-5 text-text-muted">
          {t("legalPrefix")} {" "}
          <Link href="/privacy" className="text-accent hover:underline">
            {t("privacyLink")}
          </Link>{" "}
          {t("legalAnd")} {" "}
          <Link href="/terms" className="text-accent hover:underline">
            {t("termsLink")}
          </Link>
        </p>
      </div>
    </div>
  );
}
