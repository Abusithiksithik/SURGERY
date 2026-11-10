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

export interface OtFixedStockAlert {
  targetId: string; itemId: string; locationId: string; itemCode: string; itemName: string;
  locationCode: string; locationName: string; fixedQty: number | string; onHandQty: number | string;
  difference: number | string; mismatchSince: string; severity: 'YELLOW' | 'RED'; hoursLeft: number; hoursOverdue: number;
}
export interface OtExpiryAlert {
  itemId: string; itemCode: string; itemName: string; category: string; locationId: string; locationCode: string;
  batchNumber?: string | null; expiryDate: string; onHandQty: number | string; daysLeft: number;
  status: 'EXPIRED' | 'EXPIRING_SOON';
}
export interface OtStockAlerts {
  fixedStock: { items: OtFixedStockAlert[]; yellowCount: number; redCount: number; configuredCount: number };
  expiry: { items: OtExpiryAlert[]; expiredCount: number; withinThreeMonthsCount: number; closedItems: Array<{ closureId: string; itemName: string; batchNumber?: string | null; expiryDate: string; remarks: string; locationCode: string }>; closedCount: number };
}
export async function getOtStockAlerts(): Promise<OtStockAlerts> {
  const { data } = await apiClient.get<ApiEnvelope<OtStockAlerts>>('/dashboard/ot-stock-alerts');
  return data.data;
}
export async function saveOtFixedStockTarget(payload: { itemId: string; locationId: string; fixedQty: number }) {
  const { data } = await apiClient.put<ApiEnvelope<any>>('/dashboard/ot-fixed-stock-targets', payload);
  return data.data;
}
export async function closeOtExpiryAlert(payload: { itemId: string; locationId: string; batchNumber?: string | null; expiryDate?: string; scope?: 'BATCH' | 'CATEGORY'; remarks: string }) {
  const { data } = await apiClient.post<ApiEnvelope<any>>('/dashboard/ot-expiry-alerts/close', payload);
  return data.data;
}
