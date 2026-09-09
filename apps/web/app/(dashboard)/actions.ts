'use server';

import { cookies } from 'next/headers';
import { redirect } from 'next/navigation';
import { apiFetch } from '@/lib/api';

const ACCESS_COOKIE = 'kcrm_access';
const REFRESH_COOKIE = 'kcrm_refresh';

export async function logoutAction() {
  const c = cookies();
  const refreshToken = c.get(REFRESH_COOKIE)?.value;
  const accessToken = c.get(ACCESS_COOKIE)?.value;

  // Revoga o refresh token na API (silencia erros — não importa se falhar)
  if (refreshToken) {
    try {
      await apiFetch('/api/auth/logout', {
        method: 'POST',
        body: { refreshToken },
        accessToken: accessToken || '',
      });
    } catch {
      // ignora — vamos limpar os cookies de qualquer jeito
    }
  }

  c.delete(ACCESS_COOKIE);
  c.delete(REFRESH_COOKIE);
  redirect('/login');
}
