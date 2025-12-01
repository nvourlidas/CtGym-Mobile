import { Calendar, List, User, QrCode, QrCodeIcon } from 'lucide-react-native';
import { Tabs } from 'expo-router';
import { useTheme } from '../../context/ThemeProvider';

export default function TabsLayout() {
    const { colors } = useTheme();
  return (
    <Tabs screenOptions={{
      headerShown: false,
      tabBarActiveTintColor: colors.accent,
      tabBarInactiveTintColor: colors.text,
      tabBarStyle: {
        backgroundColor: colors.bg,
      },
    }}
    >
      <Tabs.Screen
        name="classes"
        options={{
          title: 'Τμήματα',
          tabBarIcon: ({ color, size }) => (
            <Calendar color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="bookings"
        options={{
          title: 'Οι Κρατήσεις μου',
          tabBarIcon: ({ color, size }) => (
            <List color={color} size={size} />
          ),
        }}
      />
            <Tabs.Screen
        name="CheckIn"
        options={{
          title: 'Check-In',
          tabBarIcon: ({ color, size }) => (
            <QrCodeIcon color={color} size={size} />
          ),
        }}
      />
      <Tabs.Screen
        name="profile"
        options={{
          title: 'Προφίλ',
          tabBarIcon: ({ color, size }) => (
            <User color={color} size={size} />
          ),
        }}
      />
    </Tabs>
  );
}
