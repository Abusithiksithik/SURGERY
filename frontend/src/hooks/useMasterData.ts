import { useQuery } from '@tanstack/react-query';
import * as mastersApi from '@/api/masters.api';

// Reference data changes rarely, so a longer staleTime avoids refetching
// the same surgeon/surgery-type lists on every screen navigation.
const REFERENCE_STALE_TIME = 5 * 60 * 1000;

export function useSurgeons(params: { branchId?: string } = {}) {
  return useQuery({
    queryKey: ['masters', 'surgeons', params],
    queryFn: () => mastersApi.listSurgeons({ ...params, limit: 500, isActive: true }),
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
    queryFn: () => mastersApi.listAnaesthetists({ ...params, limit: 500, isActive: true }),
    staleTime: REFERENCE_STALE_TIME,
  });
}

export function useAssistants(params: { branchId?: string } = {}) {
  return useQuery({
    queryKey: ['masters', 'assistants', params],
    queryFn: () => mastersApi.listAssistants({ ...params, limit: 500, isActive: true }),
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
