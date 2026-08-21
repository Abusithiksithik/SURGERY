import type { SurgeryStatus } from '@/api/types';

/**
 * UI-side copy of ALLOWED_TRANSITIONS from the backend surgeries.service.js.
 * Controls which status action buttons are shown in Surgery Entry.
 * Backend re-validates every transition server-side regardless.
 */
export const ALLOWED_TRANSITIONS_HINT: Record<SurgeryStatus, SurgeryStatus[]> = {
  // New workflow
  DRAFT:                    ['PLANNED', 'CANCELLED'],
  PLANNED:                  ['SENT_FOR_BUDGET_APPROVAL', 'DRAFT', 'CANCELLED'],
  SENT_FOR_BUDGET_APPROVAL: ['BUDGET_APPROVED', 'REVISE_BUDGET', 'CANCELLED'],
  REVISE_BUDGET:            ['SENT_FOR_BUDGET_APPROVAL', 'CANCELLED'],
  BUDGET_APPROVED:          ['SCHEDULED', 'CANCELLED'],
  SCHEDULED:                ['RESCHEDULED', 'POSTPONED', 'SURGERY_COMPLETED', 'CANCELLED'],
  RESCHEDULED:              ['SCHEDULED', 'POSTPONED', 'SURGERY_COMPLETED', 'CANCELLED'],
  POSTPONED:                ['SCHEDULED', 'CANCELLED'],
  SURGERY_COMPLETED:        ['PARTIALLY_RECONCILED', 'FULLY_RECONCILED', 'CLOSED'],
  PARTIALLY_RECONCILED:     ['FULLY_RECONCILED', 'CLOSED'],
  FULLY_RECONCILED:         ['CLOSED'],
  CLOSED:                   [],
  CANCELLED:                [],
  // Legacy (backward compat)
  PENDING:                  ['SCHEDULED', 'SENT_FOR_BUDGET_APPROVAL', 'CANCELLED'],
  IN_PROGRESS:              ['SURGERY_COMPLETED', 'COMPLETED', 'CANCELLED'],
  COMPLETED:                ['CLOSED'],
  DELETED:                  [],
};

/**
 * Human-readable labels for each status transition action button.
 */
export const STATUS_ACTION_LABELS: Partial<Record<SurgeryStatus, string>> = {
  PLANNED:                  'Mark as Planned',
  SENT_FOR_BUDGET_APPROVAL: 'Submit for Budget Approval',
  BUDGET_APPROVED:          'Approve Budget',
  REVISE_BUDGET:            'Revise Budget',
  SCHEDULED:                'Mark as Scheduled',
  RESCHEDULED:              'Reschedule',
  POSTPONED:                'Postpone',
  SURGERY_COMPLETED:        'Mark as Completed',
  PARTIALLY_RECONCILED:     'Partially Reconciled',
  FULLY_RECONCILED:         'Fully Reconciled',
  CLOSED:                   'Close',
  CANCELLED:                'Cancel',
  DRAFT:                    'Revert to Draft',
};

/**
 * Statuses where budget fields are locked (readonly).
 * Applies after Budget Approved.
 */
export const BUDGET_LOCKED_STATUSES = new Set<SurgeryStatus>([
  'BUDGET_APPROVED', 'SCHEDULED', 'RESCHEDULED', 'POSTPONED',
  'SURGERY_COMPLETED', 'PARTIALLY_RECONCILED', 'FULLY_RECONCILED', 'CLOSED',
]);

/**
 * Color mapping for status chips.
 */
export const STATUS_COLORS: Record<SurgeryStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DRAFT:                    'default',
  PLANNED:                  'info',
  SENT_FOR_BUDGET_APPROVAL: 'warning',
  BUDGET_APPROVED:          'success',
  REVISE_BUDGET:            'warning',
  SCHEDULED:                'info',
  RESCHEDULED:              'warning',
  POSTPONED:                'warning',
  SURGERY_COMPLETED:        'success',
  PARTIALLY_RECONCILED:     'info',
  FULLY_RECONCILED:         'success',
  CLOSED:                   'success',
  CANCELLED:                'error',
  // Legacy
  PENDING:                  'warning',
  IN_PROGRESS:              'warning',
  COMPLETED:                'success',
  DELETED:                  'error',
};

/**
 * Budget approval actions — structured so future RBAC can restrict to ADMIN/APPROVER role.
 * Currently all BUDGET_WRITERS can perform these.
 */
export const APPROVAL_ACTIONS: SurgeryStatus[] = ['BUDGET_APPROVED', 'REVISE_BUDGET'];
