import { router } from 'expo-router';

import AdminApp from '../AdminApp';

export default function Admin() {
  return <AdminApp onHome={() => router.replace('/')} />;
}
