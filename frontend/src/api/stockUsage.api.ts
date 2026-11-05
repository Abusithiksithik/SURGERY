import { apiClient } from './client';
import { postStockOperation } from '@/pwa/offlineOutbox';

export interface UsageCase { surgeryId: string; surgeryNumber?: string | null; status: string; surgeryDate?: string | null; scheduledDate?: string | null; mrNumber: string; patientName: string; surgeryName?: string | null }
export interface AvailableStock { itemId: string; itemCode: string; itemName: string; locationId: string; locationCode: string; batchNumber?: string | null; expiryDate?: string | null; serialNumber?: string | null; uom: string; onHandQty: number; lastReceiptCost?: number }
export interface UsageLine { usageId: string; itemId: string; itemCode: string; itemName: string; locationId: string; locationCode: string; quantityIssued: number; uom: string; unitCost: number; batchNumber?: string | null; expiryDate?: string | null; serialNumber?: string | null; notes?: string | null; issuedAt: string; quantityReturned: number; quantityWasted: number; handoverId?: string | null }
export interface CaseUsageData { surgery: UsageCase; usageLines: UsageLine[]; availableStock: AvailableStock[]; actualConsumablesCost: number }
async function data<T>(promise: Promise<{ data: { data: T } }>): Promise<T> { return (await promise).data.data; }
export const stockUsageApi = {
  findCases: (search: string) => data<UsageCase[]>(apiClient.get('/stock/usage/cases', { params: { search } })),
  caseUsage: (surgeryId: string) => data<CaseUsageData>(apiClient.get(`/stock/usage/cases/${surgeryId}`)),
  issue: (payload: { idempotencyKey: string; surgeryId: string; surgeryNumber?: string | null; itemId: string; locationId: string; quantity: number; batchNumber?: string | null; expiryDate?: string | null; serialNumber?: string | null; notes?: string }) => postStockOperation('ISSUE_STOCK', '/stock/usage/issues', payload),
  returnItem: (usageId: string, quantity: number, notes?: string) => postStockOperation('RETURN_STOCK', `/stock/usage/${usageId}/return`, { idempotencyKey: crypto.randomUUID(), quantity, notes }),
  wastage: (usageId: string, quantity: number, notes?: string) => postStockOperation('RECORD_WASTAGE', `/stock/usage/${usageId}/wastage`, { idempotencyKey: crypto.randomUUID(), quantity, notes }),
  handover: (usageId: string, notes?: string) => data(apiClient.post(`/stock/usage/${usageId}/pharmacy-handover`, { notes })),
};
