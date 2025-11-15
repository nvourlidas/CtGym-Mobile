import { View, Text, TouchableOpacity, StyleSheet } from 'react-native';
import { useAuth } from '../../context/AuthProvider';
import { Redirect } from 'expo-router';

export default function ProfileScreen() {
  const { profile, session, signOut } = useAuth();

  if (!session) return <Redirect href="/login" />;

  return (
    <View style={styles.container}>
      <Text style={styles.title}>{profile?.full_name ?? 'Member'}</Text>
      <Text style={styles.subtitle}>Tenant: {profile?.tenant_id}</Text>
      <Text style={styles.subtitle}>Email: {session.user.email}</Text>

      <TouchableOpacity style={styles.btn} onPress={signOut}>
        <Text style={styles.btnText}>Logout</Text>
      </TouchableOpacity>
    </View>
  );
}

const styles = StyleSheet.create({
  container: { flex: 1, padding: 24, paddingTop: 60, backgroundColor: '#020617' },
  title: { fontSize: 24, color: '#fff', fontWeight: '700', marginBottom: 8 },
  subtitle: { fontSize: 14, color: '#9ca3af', marginBottom: 4 },
  btn: {
    marginTop: 24,
    backgroundColor: '#ef4444',
    paddingVertical: 12,
    borderRadius: 12,
    alignItems: 'center',
  },
  btnText: { color: '#fff', fontWeight: '700' },
});
