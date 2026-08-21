import { apiClient } from './client';

/** Triggers a browser download for a blob response with the given filename. */
function downloadBlob(blob: Blob, filename: string) {
  const url = window.URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = filename;
  document.body.appendChild(link);
  link.click();
  link.remove();
  window.URL.revokeObjectURL(url);
}

export async function exportSurgeries(
  filters: Record<string, unknown>,
  format: 'xlsx' | 'csv' = 'xlsx'
): Promise<void> {
  const response = await apiClient.get('/reports/surgeries', {
    params: { ...filters, format },
    responseType: 'blob',
  });
  const filename = `surgeries-export-${Date.now()}.${format}`;
  downloadBlob(response.data, filename);
}

export async function exportDashboardPdf(params: { branchId?: string; months?: number }): Promise<void> {
  const response = await apiClient.get('/reports/dashboard.pdf', {
    params,
    responseType: 'blob',
  });
  downloadBlob(response.data, `dashboard-summary-${Date.now()}.pdf`);
}
