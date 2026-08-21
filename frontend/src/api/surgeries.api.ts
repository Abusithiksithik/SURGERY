import { apiClient } from './client';
import type { ApiEnvelope, PaginationMeta, Surgery, SurgeryStatus } from './types';

export interface SurgeryListFilters {
  page?: number;
  limit?: number;
  status?: SurgeryStatus;
  surgeonId?: string;
  surgeryTypeId?: string;
  departmentId?: string;
  branchId?: string;
  dateFrom?: string;
  dateTo?: string;
  search?: string;
  sort?: string;
}

export async function listSurgeries(
  filters: SurgeryListFilters
): Promise<{ items: Surgery[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiEnvelope<Surgery[]>>('/surgeries', { params: filters });
  return { items: data.data, meta: data.meta! };
}

export async function getSurgery(id: string): Promise<Surgery> {
  const { data } = await apiClient.get<ApiEnvelope<Surgery>>(`/surgeries/${id}`);
  return data.data;
}

export async function createSurgery(payload: Record<string, unknown>): Promise<Surgery> {
  const { data } = await apiClient.post<ApiEnvelope<Surgery>>('/surgeries', payload);
  return data.data;
}

export async function updateSurgery(id: string, payload: Record<string, unknown>): Promise<Surgery> {
  const { data } = await apiClient.put<ApiEnvelope<Surgery>>(`/surgeries/${id}`, payload);
  return data.data;
}

export async function deleteSurgery(id: string): Promise<void> {
  await apiClient.delete(`/surgeries/${id}`);
}


export async function changeSurgeryStatus(id: string, status: SurgeryStatus, cancelReason?: string, notes?: string): Promise<Surgery> {
  const { data } = await apiClient.patch<ApiEnvelope<Surgery>>(`/surgeries/${id}/status`, { status, notes, cancelReason });
  return data.data;
}

export async function getSurgeryHistory(id: string): Promise<Record<string, unknown>[]> {
  const { data } = await apiClient.get<ApiEnvelope<Record<string, unknown>[]>>(`/surgeries/${id}/history`);
  return data.data;
}

export async function getPatientSurgeries(patientId: string): Promise<Surgery[]> {
  const { data } = await apiClient.get<ApiEnvelope<Surgery[]>>(`/surgeries/patient/${patientId}`);
  return data.data;
}

export async function addAssistant(surgeryId: string, assistantId: string, feeAmount: number) {
  const { data } = await apiClient.post(`/surgeries/${surgeryId}/assistants`, { assistantId, feeAmount });
  return data.data;
}

export async function removeAssistant(surgeryId: string, assistantId: string) {
  await apiClient.delete(`/surgeries/${surgeryId}/assistants/${assistantId}`);
}

export async function addConsumable(surgeryId: string, itemId: string, quantity: number, unitCost: number) {
  const { data } = await apiClient.post(`/surgeries/${surgeryId}/consumables`, { itemId, quantity, unitCost });
  return data.data;
}

export async function addPharmacy(surgeryId: string, pharmacyItemId: string, quantity: number, unitCost: number) {
  const { data } = await apiClient.post(`/surgeries/${surgeryId}/pharmacy`, { pharmacyItemId, quantity, unitCost });
  return data.data;
}

export async function addCollection(surgeryId: string, amount: number, mode?: string) {
  const { data } = await apiClient.post(`/surgeries/${surgeryId}/collections`, { amount, mode });
  return data.data;
}
