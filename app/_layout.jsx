import { Stack, useRouter, useSegments } from 'expo-router';
import React, { useEffect } from 'react';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { AuthProvider, useAuth } from '../components/AuthProvider';

function GatedStack() {
  const router = useRouter();
  const segments = useSegments();
  const { session, initialized } = useAuth();

  useEffect(() => {
    if (!initialized) return;
    const inAuthGroup = segments.length > 0 && segments[0] === 'auth';
    if (!session && !inAuthGroup) {
      router.replace('/auth/login');
    } else if (session && inAuthGroup) {
      router.replace('/(tabs)');
    }
  }, [session, initialized, segments]);

  return <Stack screenOptions={{ headerShown: false }} />;
}

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <AuthProvider>
        <GatedStack />
      </AuthProvider>
    </SafeAreaProvider>
  );
}
