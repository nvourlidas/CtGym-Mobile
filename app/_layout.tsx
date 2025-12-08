import { Stack } from 'expo-router';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import AuthProvider from '../context/AuthProvider';
import { ThemeProvider } from '../context/ThemeProvider';
import { PushNotificationsBootstrap } from '../components/PushNotificationsBootstrap';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <ThemeProvider>
          <PushNotificationsBootstrap />
        <Stack screenOptions={{ headerShown: false }} />
        </ThemeProvider>
      </AuthProvider>
    </SafeAreaProvider>
  );
}
