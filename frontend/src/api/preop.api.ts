import { apiClient } from './client';
import type { ApiEnvelope, PreOpChecklistTemplate, PreOpChecklistItem, SurgeryPreOpChecklist, SurgeryChecklistItem } from './types';

const BASE = '/preop';

// ── Templates ─────────────────────────────────────────────────────────────────

export async function listTemplates(): Promise<PreOpChecklistTemplate[]> {
  const { data } = await apiClient.get<ApiEnvelope<PreOpChecklistTemplate[]>>(`${BASE}/templates`);
  return data.data;
}

export async function getTemplateById(id: string): Promise<PreOpChecklistTemplate> {
  const { data } = await apiClient.get<ApiEnvelope<PreOpChecklistTemplate>>(`${BASE}/templates/${id}`);
  return data.data;
}

export async function createTemplate(payload: {
  procedureId: string;
  isActive: boolean;
  items: { checklistItem: string }[];
}): Promise<PreOpChecklistTemplate> {
  const { data } = await apiClient.post<ApiEnvelope<PreOpChecklistTemplate>>(`${BASE}/templates`, payload);
  return data.data;
}

export async function updateTemplate(
  id: string,
  payload: {
    procedureId?: string;
    isActive?: boolean;
    items?: { checklistItem: string }[];
  }
): Promise<PreOpChecklistTemplate> {
  const { data } = await apiClient.put<ApiEnvelope<PreOpChecklistTemplate>>(`${BASE}/templates/${id}`, payload);
  return data.data;
}

export async function activateTemplate(id: string): Promise<PreOpChecklistTemplate> {
  const { data } = await apiClient.patch<ApiEnvelope<PreOpChecklistTemplate>>(`${BASE}/templates/${id}/activate`);
  return data.data;
}

export async function deactivateTemplate(id: string): Promise<PreOpChecklistTemplate> {
  const { data } = await apiClient.patch<ApiEnvelope<PreOpChecklistTemplate>>(`${BASE}/templates/${id}/deactivate`);
  return data.data;
}

export async function replaceItems(
  templateId: string,
  items: { checklistItem: string }[]
): Promise<PreOpChecklistItem[]> {
  const { data } = await apiClient.put<ApiEnvelope<PreOpChecklistItem[]>>(`${BASE}/templates/${templateId}/items`, { items });
  return data.data;
}

// ── Surgery-level checklist ───────────────────────────────────────────────────

export async function getChecklistForSurgery(surgeryId: string): Promise<SurgeryPreOpChecklist> {
  const { data } = await apiClient.get<ApiEnvelope<SurgeryPreOpChecklist>>(`${BASE}/surgery/${surgeryId}`);
  return data.data;
}

// ── Surgery-level completion (checked items persisted per surgery_id) ─────────

export type CompletionMap = Record<string, { isChecked: boolean; checkedAt?: string; checkedByName?: string }>;

export async function getCompletion(surgeryId: string): Promise<CompletionMap> {
  const { data } = await apiClient.get<ApiEnvelope<CompletionMap>>(`${BASE}/surgery/${surgeryId}/completion`);
  return data.data;
}

export async function saveCompletion(
  surgeryId: string,
  completions: { itemId: string; isChecked: boolean }[]
): Promise<CompletionMap> {
  const { data } = await apiClient.post<ApiEnvelope<CompletionMap>>(
    `${BASE}/surgery/${surgeryId}/completion`,
    { completions }
  );
  return data.data;
}

// ── Surgery Checklist snapshot ────────────────────────────────────────────────

export async function getSurgeryChecklist(surgeryId: string): Promise<SurgeryChecklistItem[]> {
  const { data } = await apiClient.get<ApiEnvelope<SurgeryChecklistItem[]>>(
    `${BASE}/surgery/${surgeryId}/checklist`
  );
  return data.data;
}

export async function updateSurgeryChecklistItem(
  checklistId: string,
  payload: { status: string; remarks?: string }
): Promise<SurgeryChecklistItem> {
  const { data } = await apiClient.patch<ApiEnvelope<SurgeryChecklistItem>>(
    `${BASE}/checklist/${checklistId}`,
    payload
  );
  return data.data;
}

export async function seedSurgeryChecklist(surgeryId: string): Promise<SurgeryChecklistItem[]> {
  const { data } = await apiClient.post<ApiEnvelope<SurgeryChecklistItem[]>>(
    `${BASE}/surgery/${surgeryId}/checklist/seed`
  );
  return data.data;
}
