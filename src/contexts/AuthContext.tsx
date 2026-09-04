import { createContext, useContext, useEffect, useRef, useState, ReactNode } from "react";
import { Session, User } from "@supabase/supabase-js";
import { useQueryClient } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";


interface AuthContextType {
  session: Session | null;
  user: User | null;
  loading: boolean;
  signOut: () => Promise<void>;
}

const AuthContext = createContext<AuthContextType>({
  session: null,
  user: null,
  loading: true,
  signOut: async () => {},
});

export const useAuth = () => useContext(AuthContext);

export function AuthProvider({ children }: { children: ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const queryClient = useQueryClient();
  const lastUserIdRef = useRef<string | null>(null);

  useEffect(() => {
    const { data: { subscription } } = supabase.auth.onAuthStateChange(
      (event, session) => {
        setSession(session);
        setLoading(false);
        // Only clear the cached access answer when the actual user changes.
        // Token refreshes and repeat SIGNED_IN events (fired when a browser tab
        // regains focus) must not rebuild the app or reset the current screen.
        const nextUserId = session?.user?.id ?? null;
        const userChanged = nextUserId !== lastUserIdRef.current;
        lastUserIdRef.current = nextUserId;
        if (event === "SIGNED_OUT" || (event === "SIGNED_IN" && userChanged)) {
          queryClient.removeQueries({ queryKey: ["member-identity"] });
        }
      }
    );


    supabase.auth.getSession().then(({ data: { session } }) => {
      lastUserIdRef.current = session?.user?.id ?? null;
      setSession(session);
      setLoading(false);
    });

    return () => subscription.unsubscribe();
  }, [queryClient]);


  const signOut = async () => {
    await supabase.auth.signOut();
  };

  return (
    <AuthContext.Provider value={{ session, user: session?.user ?? null, loading, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}
