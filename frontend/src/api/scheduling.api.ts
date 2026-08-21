import { apiClient } from './client';
import type { ApiEnvelope } from './types';

export type SchedulePriority = 'ROUTINE' | 'URGENT' | 'EMERGENCY';
export type ScheduleStatus   = 'DRAFT' | 'CONFIRMED' | 'IN_PROGRESS' | 'COMPLETED' | 'POSTPONED' | 'CANCELLED';

export interface AssistantDoctor {
  assistantId: string;
  fullName: string;
  employeeCode?: string | null;
}

export interface SurgerySchedule {
  scheduleId: string;
  surgeryId: string;
  surgeryNumber?: string | null;
  surgeryStatus?: string | null;

  // Patient (from join)
  mrNumber?: string | null;
  patientFullName?: string | null;

  // Scheduling
  plannedDate: string;             // YYYY-MM-DD
  plannedStartTime: string;        // HH:MM:SS
  expectedDurationMin: number;
  otRoomId?: string | null;
  priority: SchedulePriority;

  // Team
  primarySurgeonId?: string | null;
  primarySurgeonName?: string | null;
  coSurgeonId?: string | null;
  coSurgeonName?: string | null;
  anaesthetistId?: string | null;
  anaesthetistName?: string | null;
  assistantDoctors?: AssistantDoctor[];
  otherPersonnel?: string | null;

  // OT room (from join)
  roomName?: string | null;
  roomCode?: string | null;

  status: ScheduleStatus;
  createdAt?: string;
  updatedAt?: string;
}

export interface ScheduleHistoryEntry {
  historyId: string;
  scheduleId: string;
  surgeryId: string;
  action: string;
  reason?: string | null;
  snapshot: Record<string, unknown>;
  changedByName?: string | null;
  changedAt: string;
}

// ── list ──────────────────────────────────────────────────────────────────────
export async function listSchedules(params: Record<string, unknown> = {}): Promise<{
  data: SurgerySchedule[];
  meta: unknown;
}> {
  const { data } = await apiClient.get<ApiEnvelope<SurgerySchedule[]>>('/scheduling', { params });
  return { data: data.data, meta: data.meta };
}

// ── get by surgery ID ─────────────────────────────────────────────────────────
export async function getScheduleBySurgery(surgeryId: string): Promise<SurgerySchedule | null> {
  const { data } = await apiClient.get<ApiEnvelope<SurgerySchedule | null>>(
    `/scheduling/by-surgery/${surgeryId}`
  );
  return data.data;
}

// ── get by schedule ID ────────────────────────────────────────────────────────
export async function getSchedule(scheduleId: string): Promise<SurgerySchedule> {
  const { data } = await apiClient.get<ApiEnvelope<SurgerySchedule>>(`/scheduling/${scheduleId}`);
  return data.data;
}

// ── create ────────────────────────────────────────────────────────────────────
export async function createSchedule(payload: {
  surgeryId: string;
  plannedDate: string;
  plannedStartTime: string;
  expectedDurationMin?: number;
  otRoomId?: string;
  priority?: SchedulePriority;
  primarySurgeonId?: string;
  coSurgeonId?: string;
  assistantDoctorIds?: string[];
  anaesthetistId?: string;
  otherPersonnel?: string;
}): Promise<SurgerySchedule> {
  const { data } = await apiClient.post<ApiEnvelope<SurgerySchedule>>('/scheduling', payload);
  return data.data;
}

// ── confirm ───────────────────────────────────────────────────────────────────
export async function confirmSchedule(scheduleId: string): Promise<SurgerySchedule> {
  const { data } = await apiClient.post<ApiEnvelope<SurgerySchedule>>(
    `/scheduling/${scheduleId}/confirm`
  );
  return data.data;
}

// ── reschedule ────────────────────────────────────────────────────────────────
export async function reschedule(scheduleId: string, payload: {
  reason: string;
  plannedDate?: string;
  plannedStartTime?: string;
  expectedDurationMin?: number;
  otRoomId?: string;
  priority?: SchedulePriority;
  primarySurgeonId?: string;
  coSurgeonId?: string;
  anaesthetistId?: string;
  assistantDoctorIds?: string[];
  otherPersonnel?: string;
}): Promise<SurgerySchedule> {
  const { data } = await apiClient.post<ApiEnvelope<SurgerySchedule>>(
    `/scheduling/${scheduleId}/reschedule`, payload
  );
  return data.data;
}

// ── change OT ─────────────────────────────────────────────────────────────────
export async function changeOt(scheduleId: string, payload: {
  reason: string;
  otRoomId: string;
}): Promise<SurgerySchedule> {
  const { data } = await apiClient.post<ApiEnvelope<SurgerySchedule>>(
    `/scheduling/${scheduleId}/change-ot`, payload
  );
  return data.data;
}

// ── change team ───────────────────────────────────────────────────────────────
export async function changeTeam(scheduleId: string, payload: {
  reason: string;
  primarySurgeonId?: string;
  coSurgeonId?: string;
  anaesthetistId?: string;
  assistantDoctorIds?: string[];
  otherPersonnel?: string;
}): Promise<SurgerySchedule> {
  const { data } = await apiClient.post<ApiEnvelope<SurgerySchedule>>(
    `/scheduling/${scheduleId}/change-team`, payload
  );
  return data.data;
}

// ── postpone ──────────────────────────────────────────────────────────────────
export async function postponeSchedule(scheduleId: string, payload: {
  reason: string;
  newDate?: string;
}): Promise<SurgerySchedule> {
  const { data } = await apiClient.post<ApiEnvelope<SurgerySchedule>>(
    `/scheduling/${scheduleId}/postpone`, payload
  );
  return data.data;
}

// ── cancel ────────────────────────────────────────────────────────────────────
export async function cancelSchedule(scheduleId: string, payload: {
  reason: string;
}): Promise<SurgerySchedule> {
  const { data } = await apiClient.post<ApiEnvelope<SurgerySchedule>>(
    `/scheduling/${scheduleId}/cancel`, payload
  );
  return data.data;
}

// ── history ───────────────────────────────────────────────────────────────────
export async function getScheduleHistory(scheduleId: string): Promise<ScheduleHistoryEntry[]> {
  const { data } = await apiClient.get<ApiEnvelope<ScheduleHistoryEntry[]>>(
    `/scheduling/${scheduleId}/history`
  );
  return data.data;
}

export async function getScheduleHistoryBySurgery(surgeryId: string): Promise<ScheduleHistoryEntry[]> {
  const { data } = await apiClient.get<ApiEnvelope<ScheduleHistoryEntry[]>>(
    `/scheduling/surgery-history/${surgeryId}`
  );
  return data.data;
}

// ── delete (CANCELLED schedules only) ────────────────────────────────────────
export async function deleteSchedule(scheduleId: string): Promise<void> {
  await apiClient.delete(`/scheduling/${scheduleId}`);
}

// ── updateTimeDuration — restricted edit (Time + Duration only) ────────────
export async function updateScheduleTimeDuration(
  scheduleId: string,
  payload: { plannedStartTime?: string; expectedDurationMin?: number; plannedDate?: string; otRoomId?: string }
): Promise<SurgerySchedule> {
  const { data } = await apiClient.patch<ApiEnvelope<SurgerySchedule>>(
    `/scheduling/${scheduleId}/time-duration`, payload
  );
  return data.data;
}
