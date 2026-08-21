const currencyFormatter = new Intl.NumberFormat('en-IN', {
  style: 'currency',
  currency: 'INR',
  maximumFractionDigits: 0,
});

const numberFormatter = new Intl.NumberFormat('en-IN', { maximumFractionDigits: 1 });

export function formatCurrency(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return currencyFormatter.format(value);
}

export function formatNumber(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return numberFormatter.format(value);
}

export function formatPercent(value: number | null | undefined): string {
  if (value === null || value === undefined || Number.isNaN(value)) return '—';
  return `${numberFormatter.format(value)}%`;
}

export function formatDate(value: string | Date | null | undefined): string {
  if (!value) return '—';
  // If value is a Date object, use it directly
  if (value instanceof Date) {
    if (Number.isNaN(value.getTime())) return '—';
    return value.toLocaleDateString('en-IN', { day: '2-digit', month: '2-digit', year: 'numeric' });
  }
  const str = String(value);
  // For date-only strings (YYYY-MM-DD or ISO with T00:00:00), parse as UTC
  // to avoid timezone shifts turning e.g. 2025-05-01 into Apr 30
  let date: Date;
  if (/^\d{4}-\d{2}-\d{2}(T00:00:00\.000Z)?$/.test(str)) {
    // Treat as calendar date in UTC, display in local locale
    const [year, month, day] = str.slice(0, 10).split('-').map(Number);
    date = new Date(Date.UTC(year, month - 1, day));
  } else {
    date = new Date(str);
  }
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString('en-IN', {
    day: '2-digit',
    month: '2-digit',
    year: 'numeric',
    timeZone: 'UTC',
  });
}

export function formatDuration(minutes: number | null | undefined): string {
  if (minutes === null || minutes === undefined) return '—';
  const h = Math.floor(minutes / 60);
  const m = Math.round(minutes % 60);
  return h > 0 ? `${h}h ${m}m` : `${m}m`;
}

export function titleCase(value: string): string {
  return value
    .toLowerCase()
    .split('_')
    .map((w) => w.charAt(0).toUpperCase() + w.slice(1))
    .join(' ');
}
