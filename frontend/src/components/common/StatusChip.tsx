import { Chip } from '@mui/material';
import { statusColor, severityColor } from '@/theme/tokens';
import { titleCase } from '@/utils/format';
import type { AlertSeverity, SurgeryStatus } from '@/api/types';

const STATUS_LABELS: Partial<Record<string, string>> = {
  // Surgery Entry statuses
  DRAFT:                    'Draft',
  PLANNED:                  'Planned',
  SENT_FOR_BUDGET_APPROVAL: 'Budget Approval',
  BUDGET_APPROVED:          'Budget Approved',
  REVISE_BUDGET:            'Revise Budget',
  SCHEDULED:                'Scheduled',
  RESCHEDULED:              'Rescheduled',
  POSTPONED:                'Postponed',
  SURGERY_COMPLETED:        'Surgery Done',
  PARTIALLY_RECONCILED:     'Partly Reconciled',
  FULLY_RECONCILED:         'Fully Reconciled',
  CLOSED:                   'Closed',
  CANCELLED:                'Cancelled',
  COMPLETED:                'Completed',
  DELETED:                  'Deleted',
  // OT Schedule statuses
  CONFIRMED:                'Confirmed',
  IN_PROGRESS:              'In Progress',
};

export function StatusChip({ status }: { status: SurgeryStatus | string }) {
  const c = statusColor[status] || statusColor.DRAFT;
  const label = STATUS_LABELS[status] || titleCase(status.replace(/_/g, ' '));
  return (
    <Chip
      label={label}
      size="small"
      sx={{ bgcolor: c.bg, color: c.main, fontWeight: 700, border: 'none' }}
    />
  );
}

const severityLabel: Record<AlertSeverity, string> = {
  GREEN: 'On Target',
  YELLOW: 'Needs Review',
  RED: 'Critical',
};

export function SeverityChip({ severity }: { severity: AlertSeverity }) {
  const c = severityColor[severity];
  return (
    <Chip
      label={severityLabel[severity]}
      size="small"
      sx={{ bgcolor: c.bg, color: c.main, fontWeight: 700, border: 'none' }}
    />
  );
}

/** A plain colored dot, for compact table cells where a full chip is too wide. */
export function SeverityDot({ severity }: { severity: AlertSeverity }) {
  const c = severityColor[severity];
  return (
    <span
      style={{
        display: 'inline-block',
        width: 9,
        height: 9,
        borderRadius: '50%',
        backgroundColor: c.main,
      }}
    />
  );
}
