import { apiClient } from './client';
import type { ApiEnvelope, AlertSeverity, AlertThreshold, PaginationMeta, SurgeryAlert } from './types';

export async function evaluateAlertsForSurgery(surgeryId: string) {
  const { data } = await apiClient.post<ApiEnvelope<{ surgeryId: string; overallSeverity: AlertSeverity; alerts: any[] }>>(
    `/alerts/surgery/${surgeryId}/evaluate`
  );
  return data.data;
}

export async function listAlerts(params: {
  page?: number;
  limit?: number;
  severity?: AlertSeverity;
  alertType?: string;
  isAcknowledged?: boolean;
  branchId?: string;
}): Promise<{ items: SurgeryAlert[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiEnvelope<SurgeryAlert[]>>('/alerts', { params });
  return { items: data.data, meta: data.meta! };
}

export async function acknowledgeAlert(alertId: string): Promise<SurgeryAlert> {
  const { data } = await apiClient.patch<ApiEnvelope<SurgeryAlert>>(`/alerts/${alertId}/acknowledge`);
  return data.data;
}

export async function listThresholds(branchId?: string): Promise<AlertThreshold[]> {
  const { data } = await apiClient.get<ApiEnvelope<AlertThreshold[]>>('/alerts/thresholds', {
    params: { branchId },
  });
  return data.data;
}

export async function upsertThreshold(payload: {
  branchId?: string | null;
  alertType: string;
  yellowThresholdPct: number;
  redThresholdPct: number;
}): Promise<AlertThreshold> {
  const { data } = await apiClient.put<ApiEnvelope<AlertThreshold>>('/alerts/thresholds', payload);
  return data.data;
}
