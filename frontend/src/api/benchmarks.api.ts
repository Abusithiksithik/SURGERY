import { apiClient } from './client';
import type { ApiEnvelope } from './types';

export async function getSurgeonBenchmarks(params: { surgeonId?: string; surgeryTypeId?: string }) {
  const { data } = await apiClient.get<ApiEnvelope<{ benchmarks: any[]; monthlyTrend: any }>>(
    '/benchmarks/surgeons',
    { params }
  );
  return data.data;
}

export async function getSurgeryTypeBenchmarks(params: { surgeryTypeId?: string }) {
  const { data } = await apiClient.get<ApiEnvelope<{ benchmarks: any[]; [k: string]: any }>>(
    '/benchmarks/surgery-types',
    { params }
  );
  return data.data;
}

export async function getAnaesthetistBenchmarks(params: { anaesthetistId?: string }) {
  const { data } = await apiClient.get<ApiEnvelope<{ benchmarks: any[] }>>('/benchmarks/anaesthetists', {
    params,
  });
  return data.data;
}

export async function getOtBenchmarks(params: { surgeryTypeId?: string; otRoomId?: string }) {
  const { data } = await apiClient.get<ApiEnvelope<{ benchmarks: any[] }>>('/benchmarks/ot', { params });
  return data.data;
}

export async function refreshBenchmarks() {
  const { data } = await apiClient.post<ApiEnvelope<{ refreshedAt: string }>>('/benchmarks/refresh');
  return data.data;
}
