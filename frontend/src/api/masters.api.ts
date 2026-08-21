import { apiClient } from './client';
import type {
  ApiEnvelope,
  Branch,
  Department,
  Surgeon,
  Anaesthetist,
  Assistant,
  SurgeryType,
  OtRoom,
  Patient,
  AppUser,
  Staff,
} from './types';

function listFactory<T>(resource: string) {
  return async (params: Record<string, unknown> = {}): Promise<T[]> => {
    const { data } = await apiClient.get<ApiEnvelope<T[]>>(`/masters/${resource}`, { params });
    return data.data;
  };
}

export const listBranches = listFactory<Branch>('branches');
export const listDepartments = listFactory<Department>('departments');
export const listSurgeons = listFactory<Surgeon>('surgeons');
export const listAnaesthetists = listFactory<Anaesthetist>('anaesthetists');
export const listAssistants = listFactory<Assistant>('assistants');
export const listSurgeryTypes = listFactory<SurgeryType>('surgery-types');
export const listOtRooms = listFactory<OtRoom>('ot-rooms');
export const listPatients = listFactory<Patient>('patients');
export const listAppUsers = listFactory<AppUser>('app-users');
export const listStaff = listFactory<Staff>('staff');

// ── generic CRUD factory for admin master pages ───────────────────────────────
function crudFactory<T>(resource: string) {
  const base = `/masters/${resource}`;
  return {
    list: async (params: Record<string, unknown> = {}): Promise<{ data: T[]; meta: unknown }> => {
      const { data } = await apiClient.get<ApiEnvelope<T[]>>(base, { params });
      return { data: data.data, meta: data.meta };
    },
    getById: async (id: string): Promise<T> => {
      const { data } = await apiClient.get<ApiEnvelope<T>>(`${base}/${id}`);
      return data.data;
    },
    create: async (payload: Record<string, unknown>): Promise<T> => {
      const { data } = await apiClient.post<ApiEnvelope<T>>(base, payload);
      return data.data;
    },
    update: async (id: string, payload: Record<string, unknown>): Promise<T> => {
      const { data } = await apiClient.put<ApiEnvelope<T>>(`${base}/${id}`, payload);
      return data.data;
    },
    deactivate: async (id: string): Promise<void> => {
      await apiClient.delete(`${base}/${id}`);
    },
    activate: async (id: string): Promise<T> => {
      const { data } = await apiClient.patch<ApiEnvelope<T>>(`${base}/${id}/activate`);
      return data.data;
    },
  };
}

export const departmentsCrud  = crudFactory<Department>('departments');
export const otRoomsCrud       = crudFactory<OtRoom>('ot-rooms');
export const proceduresCrud    = crudFactory<SurgeryType>('surgery-types');
export const surgeonsCrud      = crudFactory<Surgeon>('surgeons');
export const anaesthetistsCrud = crudFactory<Anaesthetist>('anaesthetists');
export const appUsersCrud      = crudFactory<AppUser>('app-users');
export const patientsCrud      = crudFactory<Patient>('patients');
export const bloodGroupsCrud   = crudFactory<import('./types').BloodGroupOption>('blood-groups');
export const staffCrud         = crudFactory<Staff>('staff');

export async function listBloodGroups(): Promise<import('./types').BloodGroupOption[]> {
  const { data } = await apiClient.get<import('./types').ApiEnvelope<import('./types').BloodGroupOption[]>>('/masters/blood-groups', {
    params: { isActive: true, limit: 50 },
  });
  return data.data;
}

export async function deletePatient(id: string): Promise<void> {
  await apiClient.delete(`/masters/patients/${id}`);
}

export async function createPatient(payload: {
  branchId: string;
  mrNumber: string;
  fullName: string;
  dateOfBirth?: string;
  gender?: string;
  phone?: string;
  address?: string;
  bloodGroup?: string;
  emergencyContactName?: string;
  emergencyContactPhone?: string;
}): Promise<Patient> {
  const { data } = await apiClient.post<ApiEnvelope<Patient>>('/masters/patients', payload);
  return data.data;
}

export async function updatePatient(id: string, payload: Record<string, unknown>): Promise<Patient> {
  const { data } = await apiClient.put<ApiEnvelope<Patient>>(`/masters/patients/${id}`, payload);
  return data.data;
}
