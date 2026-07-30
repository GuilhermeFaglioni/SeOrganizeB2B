import { createClient } from "@/lib/supabase/client";

let supabase: ReturnType<typeof createClient> | undefined;

function getClient() {
  if (!supabase) {
    supabase = createClient();
  }
  return supabase;
}

export function useAuth() {
  const client = getClient();

  const signInWithGoogle = async () => {
    await client.auth.signInWithOAuth({
      provider: "google",
      options: { redirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signInWithMagicLink = async (email: string) => {
    await client.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
  };

  const signInWithPassword = async (email: string, password: string) => {
    const { error } = await client.auth.signInWithPassword({ email, password });
    if (error) throw error;
  };

  const signUp = async (email: string, password: string) => {
    const { error } = await client.auth.signUp({
      email,
      password,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });
    if (error) throw error;
  };

  const signOut = async () => {
    await client.auth.signOut();
  };

  return { supabase: client, signInWithGoogle, signInWithMagicLink, signInWithPassword, signUp, signOut };
}
