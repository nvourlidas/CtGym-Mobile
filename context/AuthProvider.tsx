import React, { createContext, useContext, useEffect, useState } from 'react';
import { Session } from '@supabase/supabase-js';
import { supabase } from '../lib/supabase';
import type { Profile } from '../types/types';
import { useRegisterPushToken } from '../hooks/useRegisterPushToken';

type AuthContextType = {
  session: Session | null;
  sessionLoaded: boolean;
  profile: Profile | null;
  signIn: (email: string, password: string) => Promise<{ error?: string }>;
  signOut: () => Promise<void>;
};

const AuthContext = createContext<AuthContextType | undefined>(undefined);

export default function AuthProvider({ children }: { children: React.ReactNode }) {
  const [session, setSession] = useState<Session | null>(null);
  const [sessionLoaded, setSessionLoaded] = useState(false);
  const [profile, setProfile] = useState<Profile | null>(null);
  const [expoPushToken, setExpoPushToken] = useState<string | null>(null);

  useRegisterPushToken(session?.user.id ?? null, setExpoPushToken);

  useEffect(() => {
    // load initial session
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session ?? null);
      setSessionLoaded(true);
      if (data.session) {
        loadProfile(data.session.user.id);
      }
    });

    const {
      data: { subscription },
    } = supabase.auth.onAuthStateChange((_event, newSession) => {
      setSession(newSession);
      if (newSession) {
        loadProfile(newSession.user.id);
      } else {
        setProfile(null);
      }
    });

    return () => subscription.unsubscribe();
  }, []);

  const loadProfile = async (userId: string) => {
    const { data, error } = await supabase
      .from('profiles')
      .select('id, full_name, phone, tenant_id, email, max_dropin_debt')
      .eq('id', userId)
      .single();

    if (!error && data) {
      setProfile(data as Profile);
    }
  };

  const signIn = async (email: string, password: string) => {
    const { data, error } = await supabase.auth.signInWithPassword({ email, password });
    if (error) return { error: error.message };
    if (data.session) {
      await loadProfile(data.session.user.id);
    }
    return {};
  };

  const signOut = async () => {
    try {
      // remove only THIS device token
      if (profile?.id && expoPushToken) {
        await supabase
          .from('push_tokens')
          .delete()
          .eq('user_id', profile.id)
          .eq('expo_push_token', expoPushToken);
      }
      console.log('Signing out', profile?.id, expoPushToken);
    } finally {
      setExpoPushToken(null);
      await supabase.auth.signOut();
    }
  };

  return (
    <AuthContext.Provider value={{ session, sessionLoaded, profile, signIn, signOut }}>
      {children}
    </AuthContext.Provider>
  );
}

export const useAuth = () => {
  const ctx = useContext(AuthContext);
  if (!ctx) throw new Error('useAuth must be used inside AuthProvider');
  return ctx;
};
