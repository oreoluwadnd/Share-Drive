// The browser: the landing page, with the admin dashboard behind "Admin login".

import { useState } from 'react';

import AdminApp from './AdminApp';
import Landing from './Landing';

export default function WebApp() {
  const [page, setPage] = useState<'landing' | 'admin'>('landing');
  return page === 'landing' ? <Landing onAdmin={() => setPage('admin')} /> : <AdminApp onHome={() => setPage('landing')} />;
}
