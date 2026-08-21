import { apiClient, tokenStorage } from './client';
import type { ApiEnvelope, User } from './types';

export interface LoginResponse {
  user: User;
  accessToken: string;
  refreshToken: string;
}

export async function login(username: string, password: string): Promise<User> {
  const { data } = await apiClient.post<ApiEnvelope<LoginResponse>>('/auth/login', {
    username,
    password,
  });
  tokenStorage.setTokens(data.data.accessToken, data.data.refreshToken);
  return data.data.user;
}

export function logout() {
  tokenStorage.clear();
}

export async function fetchCurrentUser(): Promise<User> {
  const { data } = await apiClient.get<ApiEnvelope<User>>('/auth/me');
  return data.data;
}

export async function changePassword(currentPassword: string, newPassword: string): Promise<void> {
  await apiClient.post('/auth/change-password', { currentPassword, newPassword });
}
