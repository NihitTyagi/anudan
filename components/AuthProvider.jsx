import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabaseClient';

const AuthContext = createContext({ session: null, user: null, initialized: false });

export function AuthProvider({ children }) {
  const [session, setSession] = useState(null);
  const [initialized, setInitialized] = useState(false);

  useEffect(() => {
    let mounted = true;
    (async () => {
      const { data } = await supabase.auth.getSession();
      if (mounted) {
        setSession(data.session ?? null);
        setInitialized(true);
      }
    })();

    const { data: authSub } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession ?? null);
    });

    return () => {
      mounted = false;
      authSub.subscription.unsubscribe();
    };
  }, []);

  const value = {
    session,
    user: session?.user ?? null,
    initialized,
    signOut: async () => {
      await supabase.auth.signOut();
    }
  };

  return <AuthContext.Provider value={value}>{children}</AuthContext.Provider>;
}

export function useAuth() {
  return useContext(AuthContext);
}