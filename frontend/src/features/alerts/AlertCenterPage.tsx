import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Select, MenuItem, Button, Tabs, Tab, Stack, Typography, Grid, TextField } from '@mui/material';
import { CheckCircleOutline, SettingsOutlined } from '@mui/icons-material';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { DataTable } from '@/components/common/DataTable';
import { SeverityChip } from '@/components/common/StatusChip';
import { SectionCard } from '@/components/common/SectionCard';
import * as alertsApi from '@/api/alerts.api';
import { formatDate, titleCase } from '@/utils/format';
import { useAuth } from '@/auth/AuthContext';
import type { AlertSeverity, AlertThreshold, SurgeryAlert } from '@/api/types';

const ALERT_TYPES = [
  'SURGEON_FEE_HIGH',
  'ASSISTANT_COST_HIGH',
  'OT_DURATION_LONG',
  'OT_COST_HIGH',
  'CONSUMABLES_HIGH',
  'MARGIN_BELOW_TARGET',
  'QUOTE_TOO_LOW',
  'NEGATIVE_PROFIT',
  'BUDGET_EXCEEDED',
  'ACTUAL_COST_MISSING',
  'COLLECTION_PENDING',
];

export function AlertCenterPage() {
  const { hasRole } = useAuth();
  const [tab, setTab] = useState(0);

  return (
    <>
      <PageHeader title="Alert Center" subtitle="Real-time cost and profitability alerts across all surgeries" />
      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Alerts" />
        {hasRole('ADMIN') && <Tab label="Thresholds" icon={<SettingsOutlined fontSize="small" />} iconPosition="start" />}
      </Tabs>
      {tab === 0 && <AlertsListTab />}
      {tab === 1 && hasRole('ADMIN') && <ThresholdsTab />}
    </>
  );
}

function AlertsListTab() {
  const queryClient = useQueryClient();
  const [severity, setSeverity] = useState<AlertSeverity | ''>('');
  const [alertType, setAlertType] = useState('');
  const [isAcknowledged, setIsAcknowledged] = useState<'' | 'true' | 'false'>('false');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(25);

  const filters = {
    page,
    limit,
    severity: severity || undefined,
    alertType: alertType || undefined,
    isAcknowledged: isAcknowledged === '' ? undefined : isAcknowledged === 'true',
  };

  const { data, isLoading } = useQuery({
    queryKey: ['alerts', filters],
    queryFn: () => alertsApi.listAlerts(filters),
  });

  const ackMutation = useMutation({
    mutationFn: (alertId: string) => alertsApi.acknowledgeAlert(alertId),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alerts'] }),
  });

  const columns = useMemo<ColumnDef<SurgeryAlert, any>[]>(
    () => [
      { header: 'Severity', accessorKey: 'severity', cell: (i) => <SeverityChip severity={i.getValue()} /> },
      { header: 'Type', accessorKey: 'alertType', cell: (i) => titleCase(i.getValue()) },
      { header: 'Message', accessorKey: 'message' },
      { header: 'Patient', accessorFn: (row) => row.surgery?.patient?.fullName || '—' },
      { header: 'Surgeon', accessorFn: (row) => row.surgery?.surgeon?.fullName || '—' },
      { header: 'Raised', accessorKey: 'createdAt', cell: (i) => formatDate(i.getValue()) },
      {
        header: '',
        id: 'ack',
        cell: (i) =>
          i.row.original.isAcknowledged ? (
            <Typography variant="caption" color="text.secondary">
              Acknowledged
            </Typography>
          ) : (
            <Button
              size="small"
              startIcon={<CheckCircleOutline fontSize="small" />}
              onClick={(e) => {
                e.stopPropagation();
                ackMutation.mutate(i.row.original.alertId);
              }}
            >
              Acknowledge
            </Button>
          ),
      },
    ],
    [ackMutation]
  );

  return (
    <>
      <FilterBar
        onClear={() => {
          setSeverity('');
          setAlertType('');
          setIsAcknowledged('');
          setPage(1);
        }}
      >
        <Select size="small" value={severity} onChange={(e) => setSeverity(e.target.value as AlertSeverity)} displayEmpty sx={{ minWidth: 140 }}>
          <MenuItem value="">All Severities</MenuItem>
          <MenuItem value="RED">Critical (Red)</MenuItem>
          <MenuItem value="YELLOW">Needs Review (Yellow)</MenuItem>
          <MenuItem value="GREEN">On Target (Green)</MenuItem>
        </Select>
        <Select size="small" value={alertType} onChange={(e) => setAlertType(e.target.value)} displayEmpty sx={{ minWidth: 180 }}>
          <MenuItem value="">All Alert Types</MenuItem>
          {ALERT_TYPES.map((t) => (
            <MenuItem key={t} value={t}>
              {titleCase(t)}
            </MenuItem>
          ))}
        </Select>
        <Select size="small" value={isAcknowledged} onChange={(e) => setIsAcknowledged(e.target.value as any)} displayEmpty sx={{ minWidth: 160 }}>
          <MenuItem value="">All</MenuItem>
          <MenuItem value="false">Unacknowledged</MenuItem>
          <MenuItem value="true">Acknowledged</MenuItem>
        </Select>
      </FilterBar>

      <DataTable
        data={data?.items ?? []}
        columns={columns}
        isLoading={isLoading}
        emptyTitle="No alerts"
        emptyDescription="Nothing matches these filters right now."
        serverPagination={
          data
            ? {
                page,
                limit,
                totalCount: data.meta.totalCount,
                onPageChange: setPage,
                onLimitChange: (l) => {
                  setLimit(l);
                  setPage(1);
                },
              }
            : undefined
        }
      />
    </>
  );
}

function ThresholdsTab() {
  const queryClient = useQueryClient();
  const { data } = useQuery({ queryKey: ['alert-thresholds'], queryFn: () => alertsApi.listThresholds() });

  const [edits, setEdits] = useState<Record<string, { yellow: string; red: string }>>({});

  const saveMutation = useMutation({
    mutationFn: (payload: { alertType: string; yellowThresholdPct: number; redThresholdPct: number }) =>
      alertsApi.upsertThreshold(payload),
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['alert-thresholds'] }),
  });

  const byType = new Map<string, AlertThreshold>((data ?? []).map((t: AlertThreshold) => [t.alertType, t]));

  return (
    <SectionCard title="Alert Thresholds" subtitle="Deviation % from historical average that triggers Yellow / Red">
      <Grid container spacing={2}>
        {ALERT_TYPES.filter((t) => !['NEGATIVE_PROFIT', 'QUOTE_TOO_LOW', 'ACTUAL_COST_MISSING', 'COLLECTION_PENDING', 'BUDGET_EXCEEDED'].includes(t)).map((type) => {
          const existing = byType.get(type);
          const edit = edits[type];
          return (
            <Grid item xs={12} sm={6} md={4} key={type}>
              <Stack spacing={1} sx={{ p: 2, border: 1, borderColor: 'divider', borderRadius: 1.5 }}>
                <Typography variant="body2" fontWeight={600}>
                  {titleCase(type)}
                </Typography>
                <Stack direction="row" spacing={1}>
                  <TextField
                    size="small"
                    label="Yellow %"
                    type="number"
                    defaultValue={existing?.yellowThresholdPct ?? ''}
                    onChange={(e) => setEdits((s) => ({ ...s, [type]: { ...s[type], yellow: e.target.value, red: s[type]?.red ?? String(existing?.redThresholdPct ?? '') } }))}
                  />
                  <TextField
                    size="small"
                    label="Red %"
                    type="number"
                    defaultValue={existing?.redThresholdPct ?? ''}
                    onChange={(e) => setEdits((s) => ({ ...s, [type]: { ...s[type], red: e.target.value, yellow: s[type]?.yellow ?? String(existing?.yellowThresholdPct ?? '') } }))}
                  />
                </Stack>
                <Button
                  size="small"
                  variant="outlined"
                  disabled={!edit?.yellow || !edit?.red || saveMutation.isPending}
                  onClick={() =>
                    saveMutation.mutate({
                      alertType: type,
                      yellowThresholdPct: Number(edit.yellow),
                      redThresholdPct: Number(edit.red),
                    })
                  }
                >
                  Save
                </Button>
              </Stack>
            </Grid>
          );
        })}
      </Grid>
    </SectionCard>
  );
}
