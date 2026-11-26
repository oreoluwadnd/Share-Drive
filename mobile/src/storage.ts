// Small values kept on the device: the sign-in, the dashboard login and whether onboarding was seen.
// Phones use the secure keychain/keystore. The browser (where the screens are checked) uses localStorage.

import * as SecureStore from 'expo-secure-store';
import { Platform } from 'react-native';

// admin: the dashboard login, so a refresh keeps you logged in (the server ends it after 12 hours).
export type Key = 'session' | 'onboarded' | 'admin';

export const storage = Platform.OS === 'web'
  ? {
      get: async (key: Key) => localStorage.getItem(`fairdrive.${key}`),
      set: async (key: Key, value: string) => localStorage.setItem(`fairdrive.${key}`, value),
      remove: async (key: Key) => localStorage.removeItem(`fairdrive.${key}`),
    }
  : {
      get: (key: Key) => SecureStore.getItemAsync(`fairdrive.${key}`),
      set: (key: Key, value: string) => SecureStore.setItemAsync(`fairdrive.${key}`, value),
      remove: (key: Key) => SecureStore.deleteItemAsync(`fairdrive.${key}`),
    };
