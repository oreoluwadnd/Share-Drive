// Every screen, and which ones are open: onboarding first, then sign in, then the app.
// The landing page (/), admin dashboard (/admin), privacy and permission help are always open.

import { SplashScreen, Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { useEffect } from 'react';

import { SessionProvider, useSession } from '../session';
import { T } from '../theme';

SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  return (
    <SessionProvider>
      <StatusBar style="dark" />
      <Screens />
    </SessionProvider>
  );
}

function Screens() {
  const { ready, onboarded, session } = useSession();
  useEffect(() => { if (ready) SplashScreen.hideAsync(); }, [ready]);
  // Until the saved sign-in is loaded the guards below can't be known, and guessing would send people to the wrong screen.
  if (!ready) return null;

  return (
    <Stack screenOptions={{ headerShown: false, contentStyle: { backgroundColor: T.background[0] } }}>
      <Stack.Screen name="index" />
      <Stack.Screen name="admin" />
      <Stack.Protected guard={!onboarded}>
        <Stack.Screen name="onboarding" />
      </Stack.Protected>
      <Stack.Protected guard={onboarded && !session}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="sign-up" />
      </Stack.Protected>
      <Stack.Protected guard={session !== null}>
        <Stack.Screen name="(tabs)" />
        <Stack.Screen name="trip/[id]" options={{
          headerShown: true, title: 'Trip', headerBackTitle: 'Back', headerShadowVisible: false,
          headerStyle: { backgroundColor: T.background[0] }, headerTintColor: T.text,
        }} />
        <Stack.Screen name="delete-account" options={{ presentation: 'modal' }} />
      </Stack.Protected>
      <Stack.Screen name="privacy" options={{ presentation: 'modal' }} />
      <Stack.Screen name="permissions" options={{ presentation: 'modal' }} />
    </Stack>
  );
}
