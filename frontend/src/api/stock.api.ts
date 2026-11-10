import { apiClient } from './client';

export interface StockItem {
  itemId: string; itemCode: string; itemName: string; category?: string | null; uom: string | null;
  packSize?: number | null; packUom?: string | null; fixedQtyInOt?: number | null; trackBatch: boolean; trackExpiry: boolean;
  trackSerial: boolean; purchaseRate?: number | null; standardCost?: number | null; defaultVendorId?: string | null;
}
export interface StockLocation { locationId: string; locationCode: string; locationName: string }
export interface StockReceiptLineInput { itemId: string; quantity: number; unitCost: number; batchNumber?: string; expiryDate?: string | null; serialNumber?: string }
export interface StockReceiptInput {
  receiptId: string; locationId: string; vendorId?: string | null; referenceNumber?: string; invoiceNumber?: string;
  invoiceDate?: string | null; notes?: string; lines: StockReceiptLineInput[];
}
export interface StockReceipt {
  receiptId: string; receiptNumber?: string | null; invoiceNumber?: string | null; invoiceDate?: string | null;
  receivedAt: string; vendorName?: string | null; locationCode?: string; receivedByName?: string | null;
  lineCount?: number; receiptTotal?: number; invoiceFileName?: string | null; lines?: Array<StockReceiptLineInput & { itemCode?: string; itemName?: string; uom?: string }>;
}
export interface PhysicalCountInput { idempotencyKey: string; itemId: string; locationId: string; countedQuantity: number; batchNumber?: string; expiryDate?: string | null; serialNumber?: string; reason: string }
export interface StockBalance {
  itemId: string; itemCode: string; itemName: string; locationId: string; locationCode: string;
  batchNumber?: string | null; expiryDate?: string | null; onHandQty: number; uom: string;
}
async function getData<T>(url: string, params?: Record<string, unknown>): Promise<T> {
  const response = await apiClient.get(url, { params });
  return response.data.data as T;
}
export const stockApi = {
  items: (search = '', locationId?: string) => getData<StockItem[]>('/stock/items', { search, locationId }),
  locations: () => getData<StockLocation[]>('/stock/locations'),
  receipts: (params: Record<string, unknown> = {}) => getData<StockReceipt[]>('/stock/receipts', params),
  receipt: (id: string) => getData<StockReceipt>(`/stock/receipts/${id}`),
  balances: (params: Record<string, unknown> = {}) => getData<StockBalance[]>('/stock/balance', params),
  balanceSummary: (locationId: string) => getData<Array<{ itemId: string; locationId: string; onHandQty: number | string }>>('/stock/balance-summary', { locationId }),
  recordPhysicalCount: async (payload: PhysicalCountInput) => {
    const response = await apiClient.post('/stock/physical-count', payload);
    return response.data.data as { itemName: string; previousQuantity?: number; countedQuantity?: number; difference?: number; noChange?: boolean; idempotentReplay?: boolean };
  },
  createReceipt: async (payload: StockReceiptInput) => {
    const response = await apiClient.post('/stock/receipts', payload);
    return response.data.data as StockReceipt;
  },
  downloadReceiptInvoice: async (receiptId: string) => {
    const response = await apiClient.get(`/stock/receipts/${receiptId}/invoice`, { responseType: 'blob' });
    const url = URL.createObjectURL(response.data as Blob);
    const link = document.createElement('a'); link.href = url; link.download = `receipt-${receiptId}-invoice`; link.click(); URL.revokeObjectURL(url);
  },
  uploadReceiptInvoice: async (receiptId: string, file: File) => {
    const form = new FormData();
    form.append('file', file);
    const response = await apiClient.post(`/stock/receipts/${receiptId}/invoice`, form);
    return response.data.data as { fileName: string; mimeType: string; fileSize: number };
  },
};
