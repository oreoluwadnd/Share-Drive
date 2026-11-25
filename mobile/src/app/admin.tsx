import { router, useLocalSearchParams } from 'expo-router';

import AdminApp from '../AdminApp';

export default function Admin() {
  const { invite } = useLocalSearchParams<{ invite?: string }>();
  return <AdminApp onHome={() => router.replace('/')} inviteCode={invite} onInviteUsed={() => router.setParams({ invite: undefined })} />;
}
