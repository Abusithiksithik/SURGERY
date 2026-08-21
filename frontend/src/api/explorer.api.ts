import { apiClient } from './client';
import type { ApiEnvelope, PaginationMeta, SimilarSurgeryRow, Surgery } from './types';

export interface ExplorerFilters {
  surgeryTypeId: string;
  surgeonId?: string;
  anaesthetistId?: string;
  departmentId?: string;
  dateFrom?: string;
  dateTo?: string;
  minProfit?: number;
  maxProfit?: number;
  minDuration?: number;
  maxDuration?: number;
  minCost?: number;
  maxCost?: number;
  sort?: string;
  page?: number;
  limit?: number;
}

export async function searchSimilarSurgeries(
  filters: ExplorerFilters
): Promise<{ items: SimilarSurgeryRow[]; meta: PaginationMeta }> {
  const { data } = await apiClient.get<ApiEnvelope<SimilarSurgeryRow[]>>('/explorer/search', {
    params: filters,
  });
  return { items: data.data, meta: data.meta! };
}

export async function compareSurgeries(surgeryIds: string[]): Promise<Surgery[]> {
  const { data } = await apiClient.post<ApiEnvelope<Surgery[]>>('/explorer/compare', { surgeryIds });
  return data.data;
}
