import { apiClient } from './client';
import type { ApiEnvelope, Gender, RecommendationResult } from './types';

export interface RecommendationPreviewInput {
  surgeonId: string;
  surgeryTypeId: string;
  anaesthetistId?: string;
  patientAgeYears?: number;
  patientGender?: Gender;
  packageName?: string;
  departmentId?: string;
  excludeOutliers?: boolean;
  targetMarginPct?: number;
  sampleLimit?: number;
}

export async function previewRecommendation(
  input: RecommendationPreviewInput
): Promise<RecommendationResult> {
  const { data } = await apiClient.post<ApiEnvelope<RecommendationResult>>(
    '/recommendations/preview',
    input
  );
  return data.data;
}

export async function generateRecommendationForSurgery(
  surgeryId: string,
  opts: { excludeOutliers?: boolean; targetMarginPct?: number; persist?: boolean } = {}
): Promise<RecommendationResult> {
  const { data } = await apiClient.post<ApiEnvelope<RecommendationResult>>(
    `/recommendations/surgery/${surgeryId}`,
    opts
  );
  return data.data;
}

export async function getRecommendationHistory(surgeryId: string) {
  const { data } = await apiClient.get<ApiEnvelope<any[]>>(`/recommendations/surgery/${surgeryId}`);
  return data.data;
}

export interface AcceptanceRateResult {
  totalRecommendations: number;
  overriddenCount: number;
  fullyAcceptedCount: number;
  overallAcceptanceRatePct: number | null;
  byComponent: Record<string, { overriddenCount: number; acceptanceRatePct: number | null }>;
}

export async function getAcceptanceRate(params: {
  dateFrom?: string;
  dateTo?: string;
  surgeonId?: string;
  branchId?: string;
}): Promise<AcceptanceRateResult> {
  const { data } = await apiClient.get<ApiEnvelope<AcceptanceRateResult>>(
    '/recommendations/acceptance-rate',
    { params }
  );
  return data.data;
}
