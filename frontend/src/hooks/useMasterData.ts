import { useQuery } from '@tanstack/react-query';
import * as mastersApi from '@/api/masters.api';
import type { Staff } from '@/api/types';

const REFERENCE_STALE_TIME = 5 * 60 * 1000;
const staffList = (staffType: Staff['staffType'], params: { branchId?: string } = {}) =>
  mastersApi.listStaff({ ...params, staffType, limit: 500, isActive: true });

export function useSurgeons(params: { branchId?: string } = {}) {
  return useQuery({
    queryKey: ['masters', 'surgeons', params],
    queryFn: async () => (await staffList('Surgeon', params)).filter(s=>!!s.legacySurgeonId).map(s=>({
      surgeonId:s.legacySurgeonId!,branchId:s.branchId||'',fullName:s.name,employeeCode:s.employeeCode,
      specialization:s.specialty,isActive:s.isActive,
    })),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useSurgeryTypes() {
  return useQuery({
    queryKey: ['masters', 'surgery-types'],
    queryFn: () => mastersApi.listSurgeryTypes({ limit: 500, isActive: true }),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useAnaesthetists(params: { branchId?: string } = {}) {
  return useQuery({
    queryKey: ['masters', 'anaesthetists', params],
    queryFn: async () => (await staffList('Anaesthetist', params)).filter(s=>!!s.legacyAnaesthetistId).map(s=>({
      anaesthetistId:s.legacyAnaesthetistId!,branchId:s.branchId||'',fullName:s.name,employeeCode:s.employeeCode,isActive:s.isActive,
    })),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useAssistants(params: { branchId?: string } = {}) {
  return useQuery({
    queryKey: ['masters', 'assistants', params],
    queryFn: async () => (await staffList('Assistant', params)).filter(s=>!!s.legacyAssistantId).map(s=>({
      assistantId:s.legacyAssistantId!,branchId:s.branchId||'',fullName:s.name,employeeCode:s.employeeCode,roleTitle:s.specialty,isActive:s.isActive,
    })),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useDepartments() {
  return useQuery({
    queryKey: ['masters', 'departments'],
    queryFn: () => mastersApi.listDepartments({ limit: 500, isActive: true }),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useBranches() {
  return useQuery({
    queryKey: ['masters', 'branches'],
    queryFn: () => mastersApi.listBranches({ limit: 500, isActive: true }),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useOtRooms(params: { branchId?: string } = {}) {
  return useQuery({
    queryKey: ['masters', 'ot-rooms', params],
    queryFn: () => mastersApi.listOtRooms({ ...params, limit: 500, isActive: true }),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useStaff(params: { staffType?: string; branchId?: string } = {}) {
  return useQuery({
    queryKey: ['masters', 'staff', params],
    queryFn: () => mastersApi.listStaff({ ...params, limit: 500, isActive: true }),
    staleTime: REFERENCE_STALE_TIME,
  });
}
