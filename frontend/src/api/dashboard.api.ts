import { apiClient } from './client';
import type { ApiEnvelope, DashboardSummary, ForecastResult } from './types';

export async function getDashboardSummary(params: {
  branchId?: string;
  departmentId?: string;
  months?: number;
}): Promise<DashboardSummary> {
  const { data } = await apiClient.get<ApiEnvelope<DashboardSummary>>('/dashboard/summary', { params });
  return data.data;
}

function topNFactory(path: string) {
  return async (params: { branchId?: string; limit?: number; dateFrom?: string; dateTo?: string } = {}) => {
    const { data } = await apiClient.get<ApiEnvelope<any[]>>(`/dashboard/${path}`, { params });
    return data.data;
  };
}

export const getTopProfitable = topNFactory('top-profitable');
export const getLowestMargin = topNFactory('lowest-margin');
export const getHighestOtCost = topNFactory('highest-ot-cost');
export const getHighestAssistantCost = topNFactory('highest-assistant-cost');
export const getHighestConsumables = topNFactory('highest-consumables');

export async function getDepartmentComparison(params: { branchId?: string; months?: number } = {}) {
  const { data } = await apiClient.get<ApiEnvelope<any[]>>('/dashboard/department-comparison', { params });
  return data.data;
}

export async function getBranchComparison(params: { months?: number } = {}) {
  const { data } = await apiClient.get<ApiEnvelope<any[]>>('/dashboard/branch-comparison', { params });
  return data.data;
}

export async function getDoctorComparison(params: { branchId?: string; months?: number } = {}) {
  const { data } = await apiClient.get<ApiEnvelope<any[]>>('/dashboard/doctor-comparison', { params });
  return data.data;
}

export async function getForecast(params: {
  branchId?: string;
  metric?: 'revenue' | 'cost' | 'profit';
  periods?: number;
}): Promise<ForecastResult> {
  const { data } = await apiClient.get<ApiEnvelope<ForecastResult>>('/dashboard/forecast', { params });
  return data.data;
}
