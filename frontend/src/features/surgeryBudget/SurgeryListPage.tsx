import { useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Button, MenuItem, Select, TextField, InputAdornment,
  Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions,
  IconButton, Tooltip, CircularProgress,
} from '@mui/material';
import { Add, Search, DeleteOutline, WarningAmberRounded } from '@mui/icons-material';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { DataTable } from '@/components/common/DataTable';
import { StatusChip } from '@/components/common/StatusChip';
import { ExportMenu } from '@/components/common/ExportMenu';
import { useSurgeons, useSurgeryTypes } from '@/hooks/useMasterData';
import * as surgeriesApi from '@/api/surgeries.api';
import * as reportsApi from '@/api/reports.api';
import { formatCurrency, formatDate } from '@/utils/format';
import type { Surgery, SurgeryStatus } from '@/api/types';

const STATUS_OPTIONS: SurgeryStatus[] = [
  'DRAFT', 'PLANNED', 'SENT_FOR_BUDGET_APPROVAL', 'BUDGET_APPROVED',
  'REVISE_BUDGET', 'SCHEDULED', 'RESCHEDULED', 'POSTPONED',
  'SURGERY_COMPLETED', 'PARTIALLY_RECONCILED', 'FULLY_RECONCILED',
  'CLOSED', 'CANCELLED',
];

const STATUS_LABELS: Partial<Record<SurgeryStatus, string>> = {
  SENT_FOR_BUDGET_APPROVAL: 'Budget Approval Pending',
  BUDGET_APPROVED: 'Budget Approved',
  REVISE_BUDGET: 'Revise Budget',
  SURGERY_COMPLETED: 'Surgery Completed',
  PARTIALLY_RECONCILED: 'Partly Reconciled',
  FULLY_RECONCILED: 'Fully Reconciled',
  RESCHEDULED: 'Rescheduled',
  POSTPONED: 'Postponed',
};

export function SurgeryListPage() {
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);
  const [status, setStatus] = useState<SurgeryStatus | ''>('');
  const [surgeonId, setSurgeonId] = useState('');
  const [surgeryTypeId, setSurgeryTypeId] = useState('');
  const [search, setSearch] = useState('');

  const [deleteTarget, setDeleteTarget] = useState<Surgery | null>(null);
  const [deleteError, setDeleteError] = useState<string | null>(null);

  const deleteMutation = useMutation({
    mutationFn: (id: string) => surgeriesApi.deleteSurgery(id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['surgeries'] });
      setDeleteTarget(null);
      setDeleteError(null);
    },
    onError: (err: any) => {
      const msg = err?.response?.data?.message || 'Failed to delete surgery.';
      setDeleteError(msg);
    },
  });

  const { data: surgeons } = useSurgeons();
  const { data: surgeryTypes } = useSurgeryTypes();

  const filters = {
    page,
    limit,
    status: status || undefined,
    surgeonId: surgeonId || undefined,
    surgeryTypeId: surgeryTypeId || undefined,
    search: search || undefined,
    sort: 'surgeryDate:desc',
  };

  const { data, isLoading, isError, refetch } = useQuery({
    queryKey: ['surgeries', filters],
    queryFn: () => surgeriesApi.listSurgeries(filters),
  });

  const columns = useMemo<ColumnDef<Surgery, any>[]>(
    () => [
      {
        header: 'Surgery Date',
        accessorKey: 'surgeryDate',
        cell: (info) => formatDate(info.getValue()) || '—',
      },
      {
        header: 'Surgery No.',
        accessorKey: 'surgeryNumber',
        cell: (info) => info.getValue() || '—',
      },
      {
        header: 'Patient',
        accessorFn: (row) => row.patient?.fullName || '—',
      },
      {
        header: 'MR Number / UHID',
        accessorFn: (row) => row.patient?.mrNumber || '—',
      },
      {
        header: 'Age',
        accessorKey: 'patientAgeYears',
        cell: (info) => info.getValue() != null ? `${info.getValue()} yrs` : '—',
      },
      {
        header: 'Surgeon',
        accessorFn: (row) => row.surgeon?.fullName || '—',
      },
      {
        header: 'Surgery Type / Procedure',
        accessorFn: (row) => row.surgeryType?.name || '—',
      },
      {
        header: 'Status',
        accessorKey: 'status',
        cell: (info) => <StatusChip status={info.getValue()} />,
      },
      {
        header: 'Budget Total',
        accessorKey: 'budgetTotal',
        cell: (info) => <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(info.getValue())}</span>,
      },
      {
        header: 'Actual Total',
        accessorKey: 'actualTotal',
        cell: (info) => <span style={{ fontFamily: 'IBM Plex Mono, monospace' }}>{formatCurrency(info.getValue())}</span>,
      },
      {
        header: 'Profit',
        accessorKey: 'profitAmount',
        cell: (info) => {
          const v = info.getValue();
          return (
            <span style={{ fontFamily: 'IBM Plex Mono, monospace', color: v == null ? undefined : v >= 0 ? '#2E7D32' : '#C0392B', fontWeight: 600 }}>
              {formatCurrency(v)}
            </span>
          );
        },
      },
      {
        id: 'actions',
        header: 'Action',
        cell: ({ row }) => {
          const surgery = row.original;
          // ONLY DRAFT surgeries can be deleted
          const canDelete = surgery.status === 'DRAFT';
          return (
            <Tooltip
              title={canDelete ? 'Delete (Draft only)' : `Cannot delete — status is ${surgery.status}`}
              placement="left"
            >
              <span>
                <IconButton
                  size="small"
                  disabled={!canDelete}
                  onClick={(e) => {
                    e.stopPropagation();
                    setDeleteError(null);
                    setDeleteTarget(surgery);
                  }}
                  sx={{ color: canDelete ? 'error.main' : 'action.disabled' }}
                >
                  <DeleteOutline fontSize="small" />
                </IconButton>
              </span>
            </Tooltip>
          );
        },
      },
    ],
    []
  );

  return (
    <>
      <PageHeader
        title="Surgery Entry"
        subtitle="Manage surgery entries, costs, and financial lifecycle"
        actions={
          <>
            <ExportMenu
              onExportExcel={() => reportsApi.exportSurgeries(filters, 'xlsx')}
              onExportCsv={() => reportsApi.exportSurgeries(filters, 'csv')}
            />
            <Button variant="contained" startIcon={<Add />} onClick={() => navigate('/surgeries/new')}>
              New Surgery Entry
            </Button>
          </>
        }
      />

      <FilterBar
        onClear={() => { setStatus(''); setSurgeonId(''); setSurgeryTypeId(''); setSearch(''); setPage(1); }}
      >
        <TextField
          size="small" placeholder="Search patient, MR number, surgeon…"
          value={search} onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          sx={{ minWidth: 260 }}
          InputProps={{ startAdornment: <InputAdornment position="start"><Search fontSize="small" /></InputAdornment> }}
        />
        <Select size="small" value={status} onChange={(e) => { setStatus(e.target.value as SurgeryStatus | ''); setPage(1); }} displayEmpty sx={{ minWidth: 150 }}>
          <MenuItem value="">All Statuses</MenuItem>
          {STATUS_OPTIONS.map((s) => <MenuItem key={s} value={s}>{STATUS_LABELS[s] || s.replace(/_/g, ' ')}</MenuItem>)}
        </Select>
        <Select size="small" value={surgeonId} onChange={(e) => { setSurgeonId(e.target.value); setPage(1); }} displayEmpty sx={{ minWidth: 160 }}>
          <MenuItem value="">All Surgeons</MenuItem>
          {surgeons?.map((s) => <MenuItem key={s.surgeonId} value={s.surgeonId}>{s.fullName}</MenuItem>)}
        </Select>
        <Select size="small" value={surgeryTypeId} onChange={(e) => { setSurgeryTypeId(e.target.value); setPage(1); }} displayEmpty sx={{ minWidth: 180 }}>
          <MenuItem value="">All Surgery Types</MenuItem>
          {surgeryTypes?.map((t) => <MenuItem key={t.surgeryTypeId} value={t.surgeryTypeId}>{t.name}</MenuItem>)}
        </Select>
      </FilterBar>

      <DataTable
        data={data?.items ?? []}
        columns={columns}
        isLoading={isLoading}
        emptyTitle={isError ? 'Could not load surgery entries' : 'No surgery entries found'}
        emptyDescription={isError ? 'Please try again.' : 'Try adjusting filters, or create a new surgery entry.'}
        onRowClick={(row) => navigate(`/surgeries/${row.surgeryId}`)}
        serverPagination={
          data
            ? { page, limit, totalCount: data.meta.totalCount, onPageChange: setPage, onLimitChange: (l) => { setLimit(l); setPage(1); } }
            : undefined
        }
      />
      {isError && <Button onClick={() => refetch()} sx={{ mt: 2 }}>Retry</Button>}

      <Dialog open={!!deleteTarget} onClose={() => !deleteMutation.isPending && setDeleteTarget(null)} maxWidth="xs" fullWidth PaperProps={{ sx: { borderRadius: 2 } }}>
        <DialogTitle sx={{ display: 'flex', alignItems: 'center', gap: 1 }}>
          <WarningAmberRounded color="warning" />
          Delete Surgery Entry?
        </DialogTitle>
        <DialogContent>
          <DialogContentText>
            This will permanently delete the surgery entry for{' '}
            <strong>{deleteTarget?.patient?.fullName ?? 'this patient'}</strong>.
            This action cannot be undone. Only DRAFT entries can be deleted.
          </DialogContentText>
          {deleteError && <DialogContentText color="error" sx={{ mt: 1.5 }}>{deleteError}</DialogContentText>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2, gap: 1 }}>
          <Button variant="outlined" onClick={() => { setDeleteTarget(null); setDeleteError(null); }} disabled={deleteMutation.isPending}>Cancel</Button>
          <Button
            variant="contained" color="error"
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={16} color="inherit" /> : <DeleteOutline />}
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.surgeryId)}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete'}
          </Button>
        </DialogActions>
      </Dialog>
    </>
  );
}
