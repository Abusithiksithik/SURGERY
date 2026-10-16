import { apiClient } from './client';
import type { ApiEnvelope, SurgeryActuals } from './types';

export async function getActuals(surgeryId: string): Promise<SurgeryActuals> {
  const { data } = await apiClient.get<ApiEnvelope<SurgeryActuals>>(`/actuals/surgery/${surgeryId}`);
  return data.data;
}

export async function saveActuals(surgeryId: string, payload: Record<string, unknown>): Promise<SurgeryActuals> {
  const { data } = await apiClient.put<ApiEnvelope<SurgeryActuals>>(`/actuals/surgery/${surgeryId}`, payload);
  return data.data;
}

export async function addTimelineEvent(
  surgeryId: string,
  payload: { eventType: string; eventDatetime?: string; remarks?: string }
): Promise<SurgeryActuals> {
  const { data } = await apiClient.post<ApiEnvelope<SurgeryActuals>>(`/actuals/surgery/${surgeryId}/timeline`, payload);
  return data.data;
}

export async function deleteTimelineEvent(eventId: string): Promise<void> {
  await apiClient.delete(`/actuals/timeline/${eventId}`);
}
