"use client";

import { createContext, useContext, useEffect, useState, useRef, ReactNode } from "react";
import { createClient } from "@/lib/supabase/client";
import type { User, Session } from "@supabase/supabase-js";

interface AuthContextValue {
  user: User | null;
  session: Session | null;
  signOut: () => Promise<void>;
  updateUserName: (name: string) => void;
  isLoading: boolean;
}

const AuthContext = createContext<AuthContextValue>({
  user: null,
  session: null,
  signOut: async () => {},
  updateUserName: () => {},
  isLoading: true,
});

export function AuthProvider({ children }: { children: ReactNode }) {
  const [user, setUser] = useState<User | null>(null);
  const [session, setSession] = useState<Session | null>(null);
  const [isLoading, setIsLoading] = useState(true);
  const supabaseRef = useRef<ReturnType<typeof createClient>>();

  if (!supabaseRef.current) {
    supabaseRef.current = createClient();
  }
  const supabase = supabaseRef.current;

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, session) => {
      setSession(session);
      setUser(session?.user ?? null);
      setIsLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [supabase]);

  const signOut = async () => {
    await supabase.auth.signOut();
    setUser(null);
    setSession(null);
  };

  const updateUserName = (name: string) => {
    setUser((current) =>
      current
        ? {
            ...current,
            user_metadata: {
              ...current.user_metadata,
              full_name: name,
            },
          }
        : current,
    );
    setSession((current) =>
      current
        ? {
            ...current,
            user: {
              ...current.user,
              user_metadata: {
                ...current.user.user_metadata,
                full_name: name,
              },
            },
          }
        : current,
    );
  };

  return (
    <AuthContext.Provider
      value={{ user, session, signOut, updateUserName, isLoading }}
    >
      {children}
    </AuthContext.Provider>
  );
}

export function useAuth(): AuthContextValue {
  return useContext(AuthContext);
}
