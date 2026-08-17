import { createClient } from "@/lib/supabase/client";

let supabase: ReturnType<typeof createClient> | undefined;

function getClient() {
  if (!supabase) {
    supabase = createClient();
  }
  return supabase;
}

function getAppOrigin(): string {
  return process.env.NEXT_PUBLIC_APP_URL ?? window.location.origin;
}

export function useAuth() {
  const client = getClient();

  const signInWithGoogle = async () => {
    await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${getAppOrigin()}/auth/callback` },
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

  const signUp = async (email: string, password: string) => {
    const { error, data } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${getAppOrigin()}/auth/callback` },
    });
    if (error) throw error;
    return data;
  };

  const signOut = async () => {
    await client.auth.signOut();
  };

  return { supabase: client, signInWithGoogle, signInWithMagicLink, signInWithPassword, signUp, signOut };
}
