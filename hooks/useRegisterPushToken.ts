import { useEffect } from 'react';
import * as Device from 'expo-device';
import * as Notifications from 'expo-notifications';
import Constants from 'expo-constants';
import { supabase } from '../lib/supabase'; // your existing client
import { Platform, Alert } from 'react-native';

async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Must use physical device for Push Notifications');
    return null;
  }

  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert('Notifications disabled', 'Enable notifications in settings to get reminders.');
    return null;
  }

  // Get projectId for SDK 49+
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    (Constants as any)?.easConfig?.projectId;

  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  return tokenResponse.data;
}

export function useRegisterPushToken(userId: string | null) {
  useEffect(() => {
    if (!userId) return;

    (async () => {
      try {
        const token = await registerForPushNotificationsAsync();
        if (!token) return;

        const platform = Platform.OS;

        const { error } = await supabase
          .from('push_tokens')
          .upsert(
            {
              user_id: userId,
              expo_push_token: token,
              platform,
              is_active: true,
            },
            { onConflict: 'expo_push_token' } // unique index
          );

        if (error) {
          console.error('Failed to save push token', error);
        } else {
          console.log('Push token saved', token);
        }
      } catch (e) {
        console.error('Error during push token registration', e);
      }
    })();
  }, [userId]);
}
