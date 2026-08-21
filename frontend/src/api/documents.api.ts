import { apiClient } from './client';
import type { ApiEnvelope, SurgeryDocument } from './types';

const BASE = '/documents';

export async function listDocuments(surgeryId: string): Promise<SurgeryDocument[]> {
  const { data } = await apiClient.get<ApiEnvelope<SurgeryDocument[]>>(
    `${BASE}/surgery/${surgeryId}`
  );
  return data.data;
}

export async function uploadDocument(
  surgeryId: string,
  formData: FormData
): Promise<SurgeryDocument> {
  const { data } = await apiClient.post<ApiEnvelope<SurgeryDocument>>(
    `${BASE}/surgery/${surgeryId}/upload`,
    formData,
    { headers: { 'Content-Type': 'multipart/form-data' } }
  );
  return data.data;
}

export function getDownloadUrl(documentId: string): string {
  // Build absolute URL from axios base URL
  const baseURL = (apiClient.defaults.baseURL ?? '').replace(/\/$/, '');
  return `${baseURL}${BASE}/${documentId}/download`;
}

export async function deleteDocument(documentId: string): Promise<void> {
  await apiClient.delete(`${BASE}/${documentId}`);
}
