import { Redirect } from 'expo-router';
import { useAuth } from '../context/AuthProvider';

export default function Index() {
  const { sessionLoaded, session } = useAuth();

  if (!sessionLoaded) return null; // can show splash loader

  return session ? <Redirect href="/(tabs)/classes" /> : <Redirect href="/login" />;
}
