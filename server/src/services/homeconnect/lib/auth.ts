import config from '../../../config';
import state from '../../../state';
import dayjs from '../../../dayjs';

type TokenResponse = {
  access_token: string;
  refresh_token?: string;
  expires_in: number;
};

let accessToken: { value: string; expiresAt: Date } | null = null;

async function requestToken(grant: Record<string, string>): Promise<TokenResponse> {
  const res = await fetch('https://api.home-connect.com/security/oauth/token', {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id: config.homeconnect.client_id,
      client_secret: config.homeconnect.client_secret,
      ...grant,
    }),
  });

  const token = await res.json();

  if (!res.ok) {
    throw new Error(`Home Connect token request failed: ${token.error_description ?? token.error ?? res.status}`);
  }

  if (token.refresh_token) {
    state.set('homeconnect.refresh_token', token.refresh_token);
  }

  accessToken = { value: token.access_token, expiresAt: dayjs().add(token.expires_in, 'second').toDate() };

  return token;
}

export async function exchangeAuthorizationCode(code: string): Promise<void> {
  await requestToken({ grant_type: 'authorization_code', code });
}

export async function getAccessToken(): Promise<string> {
  if (accessToken === null || dayjs().add(5, 'minute').isAfter(accessToken.expiresAt)) {
    await requestToken({ grant_type: 'refresh_token', refresh_token: state.getOrThrow('homeconnect.refresh_token') });
  }

  return accessToken!.value;
}
