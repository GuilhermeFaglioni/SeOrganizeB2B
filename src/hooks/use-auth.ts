import { createClient } from "@/lib/supabase/client";

let supabase: ReturnType<typeof createClient> | undefined;

function getClient() {
  if (!supabase) {
    supabase = createClient();
  }
  return supabase;
}

function getAppOrigin(): string {
  const configuredOrigin = process.env.NEXT_PUBLIC_APP_URL;
  if (configuredOrigin) return new URL(configuredOrigin).origin;
  if (process.env.NODE_ENV === "production") {
    throw new Error("NEXT_PUBLIC_APP_URL is required in production");
  }
  return window.location.origin;
}

export function useAuth() {
  const client = getClient();

  const signInWithGoogle = async (redirectPath?: string) => {
    await client.auth.signInWithOAuth({
      provider: "google",
      options: {
        redirectTo: `${getAppOrigin()}${redirectPath ?? "/auth/callback"}`,
      },
    });
  };

  const signInWithMagicLink = async (email: string) => {
    await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${getAppOrigin()}/auth/callback` },
    });
  };

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (
    email: string,
    password: string,
    redirectPath?: string,
  ) => {
    const { error, data } = await client.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: `${getAppOrigin()}${redirectPath ?? "/auth/callback"}`,
      },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await client.auth.signOut();
  };

  return { supabase: client, signInWithGoogle, signInWithMagicLink, signInWithPassword, signUp, signOut };
}
