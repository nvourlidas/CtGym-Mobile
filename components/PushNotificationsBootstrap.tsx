// components/PushNotificationsBootstrap.tsx
import { useEffect, useState } from 'react';
import { Platform } from 'react-native';
import { registerForPushNotificationsAsync } from '../lib/pushNotifications';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthProvider';

export function PushNotificationsBootstrap() {
  const [token, setToken] = useState<string | null>(null);

  const { session, profile } = useAuth();
  const userId = session?.user?.id ?? null;

  // 1) Ζητάμε άδεια + παίρνουμε token μία φορά
  useEffect(() => {
    (async () => {
      const t = await registerForPushNotificationsAsync();
      if (t) setToken(t);
    })();
  }, []);

  // 2) Όταν έχουμε token + userId + tenant → το αποθηκεύουμε στο Supabase
  useEffect(() => {
    if (!token || !userId) return;

    (async () => {
      const { error } = await supabase.from('push_tokens').upsert(
        {
          user_id: userId,
          expo_push_token: token,
          platform: Platform.OS,
          tenant_id: profile?.tenant_id ?? null,
          is_active: true,
        },
        { onConflict: 'expo_push_token' }
      );

      if (error) {
        console.error('Failed to save push token', error);
      } else {
        console.log('Push token saved to Supabase');
      }
    })();
  }, [token, userId, profile?.tenant_id]);

  // 🔇 Δεν δείχνουμε τίποτα στην οθόνη
  return null;
}
