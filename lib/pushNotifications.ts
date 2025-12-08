// lib/pushNotifications.ts
import * as Notifications from 'expo-notifications';
import * as Device from 'expo-device';
import Constants from 'expo-constants';
import { Alert, Platform } from 'react-native';

Notifications.setNotificationHandler({
  handleNotification: async () => ({
    shouldPlaySound: true,
    shouldSetBadge: false,
    shouldShowBanner: true, // show the banner in foreground
    shouldShowList: true,   // show in notification center list
  }),
});


export async function registerForPushNotificationsAsync(): Promise<string | null> {
  if (!Device.isDevice) {
    console.log('Must use physical device for push notifications');
    Alert.alert('Προσοχή', 'Οι ειδοποιήσεις push δουλεύουν μόνο σε πραγματική συσκευή.');
    return null;
  }

  // 1) Check permissions
  const { status: existingStatus } = await Notifications.getPermissionsAsync();
  let finalStatus = existingStatus;

  // 2) Ask if not granted
  if (existingStatus !== 'granted') {
    const { status } = await Notifications.requestPermissionsAsync();
    finalStatus = status;
  }

  if (finalStatus !== 'granted') {
    Alert.alert('Ειδοποιήσεις απενεργοποιημένες', 'Ενεργοποίησέ τες από τις ρυθμίσεις της συσκευής.');
    return null;
  }

  // 3) Get projectId (needed for SDK 49+ / EAS)
  const projectId =
    Constants?.expoConfig?.extra?.eas?.projectId ??
    // @ts-ignore older SDK
    Constants?.easConfig?.projectId;

  if (!projectId && Platform.OS !== 'android') {
    console.warn('No projectId found. Check app.json extra.eas.projectId');
  }

  // 4) Get Expo push token
  const tokenResponse = await Notifications.getExpoPushTokenAsync(
    projectId ? { projectId } : undefined
  );

  const token = tokenResponse.data;
  console.log('Expo push token:', token);
  return token;
}

// For testing: schedule a local notification
export async function sendTestLocalNotification() {
  await Notifications.scheduleNotificationAsync({
    content: {
      title: 'Test notification ✅',
      body: 'Αν βλέπεις αυτό, οι τοπικές ειδοποιήσεις δουλεύουν!',
      data: { test: true },
    },
    trigger: {
      type: Notifications.SchedulableTriggerInputTypes.TIME_INTERVAL,
      seconds: 2,
      // repeats: false, // optional
    },
  });
}
