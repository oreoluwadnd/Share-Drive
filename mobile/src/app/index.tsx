// In a browser: the landing page. On a phone: straight to onboarding, sign in or the Drive tab.

import { Redirect, router } from 'expo-router';
import { Platform } from 'react-native';

import Landing from '../Landing';
import { useSession } from '../session';

export default function Start() {
  const { onboarded, session } = useSession();
  if (Platform.OS === 'web') return <Landing onAdmin={() => router.push('/admin')} />;
  return <Redirect href={!onboarded ? '/onboarding' : session === null ? '/sign-in' : '/drive'} />;
}
