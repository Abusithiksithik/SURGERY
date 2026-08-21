import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Tabs, Tab, Select, MenuItem, Button, Stack, Box } from '@mui/material';
import { RefreshOutlined } from '@mui/icons-material';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/common/PageHeader';
import { DataTable } from '@/components/common/DataTable';
import { SectionCard } from '@/components/common/SectionCard';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { useSurgeons, useSurgeryTypes, useAnaesthetists } from '@/hooks/useMasterData';
import * as benchmarksApi from '@/api/benchmarks.api';
import { formatCurrency, formatNumber, formatPercent, formatDuration, formatDate } from '@/utils/format';
import { palette } from '@/theme/tokens';
import { useAuth } from '@/auth/AuthContext';

export function BenchmarkDashboardPage() {
  const [tab, setTab] = useState(0);
  const { hasRole } = useAuth();
  const queryClient = useQueryClient();

  const refreshMutation = useMutation({
    mutationFn: benchmarksApi.refreshBenchmarks,
    onSuccess: () => queryClient.invalidateQueries({ queryKey: ['benchmarks'] }),
  });

  return (
    <>
      <PageHeader
        title="Benchmark Dashboard"
        subtitle="Surgeon, surgery type, anaesthetist, and OT performance benchmarks"
        actions={
          hasRole('ADMIN') ? (
            <Button
              variant="outlined"
              startIcon={<RefreshOutlined />}
              onClick={() => refreshMutation.mutate()}
              disabled={refreshMutation.isPending}
            >
              {refreshMutation.isPending ? 'Refreshing…' : 'Refresh Benchmarks'}
            </Button>
          ) : undefined
        }
      />

      <Tabs value={tab} onChange={(_, v) => setTab(v)} sx={{ mb: 2.5, borderBottom: 1, borderColor: 'divider' }}>
        <Tab label="Surgeon" />
        <Tab label="Surgery Type" />
        <Tab label="Anaesthetist" />
        <Tab label="OT" />
      </Tabs>

      {tab === 0 && <SurgeonBenchmarkTab />}
      {tab === 1 && <SurgeryTypeBenchmarkTab />}
      {tab === 2 && <AnaesthetistBenchmarkTab />}
      {tab === 3 && <OtBenchmarkTab />}
    </>
  );
}

function SurgeonBenchmarkTab() {
  const { data: surgeons } = useSurgeons();
  const [surgeonId, setSurgeonId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['benchmarks', 'surgeons', surgeonId],
    queryFn: () => benchmarksApi.getSurgeonBenchmarks({ surgeonId: surgeonId || undefined }),
  });

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      { header: 'Surgeon', accessorKey: 'surgeon_name' },
      { header: 'Surgery Type', accessorKey: 'surgery_type_name' },
      { header: 'Cases', accessorKey: 'case_count' },
      { header: 'Avg Fee', accessorKey: 'avg_fee', cell: (i) => formatCurrency(i.getValue()) },
      { header: 'Median Fee', accessorKey: 'median_fee', cell: (i) => formatCurrency(i.getValue()) },
      { header: 'Fee Range', cell: (i) => `${formatCurrency(i.row.original.min_fee)} – ${formatCurrency(i.row.original.max_fee)}` },
      { header: 'Avg Profit', accessorKey: 'avg_profit', cell: (i) => formatCurrency(i.getValue()) },
      { header: 'Avg Margin', accessorKey: 'avg_margin_pct', cell: (i) => formatPercent(i.getValue()) },
      { header: 'Avg Duration', accessorKey: 'avg_duration_minutes', cell: (i) => formatDuration(i.getValue()) },
      { header: 'Last Case', accessorKey: 'last_surgery_date', cell: (i) => formatDate(i.getValue()) },
    ],
    []
  );

  return (
    <Stack spacing={2.5}>
      <Select size="small" value={surgeonId} onChange={(e) => setSurgeonId(e.target.value)} displayEmpty sx={{ maxWidth: 260 }}>
        <MenuItem value="">All Surgeons</MenuItem>
        {surgeons?.map((s) => (
          <MenuItem key={s.surgeonId} value={s.surgeonId}>
            {s.fullName}
          </MenuItem>
        ))}
      </Select>

      {surgeonId && data?.monthlyTrend?.series?.length > 0 && (
        <SectionCard title="Monthly Profit Trend" subtitle={data?.monthlyTrend?.trend ? `Trend: ${data.monthlyTrend.trend.direction}` : undefined}>
          <TrendLineChart
            data={(data?.monthlyTrend?.series ?? []).map((r: any) => ({ month: formatDate(r.month), 'Avg Profit': Number(r.avg_profit) }))}
            xKey="month"
            series={[{ key: 'Avg Profit', label: 'Avg Profit', color: palette.teal600 }]}
          />
        </SectionCard>
      )}

      <DataTable data={data?.benchmarks ?? []} columns={columns} isLoading={isLoading} dense />
    </Stack>
  );
}

function SurgeryTypeBenchmarkTab() {
  const { data: surgeryTypes } = useSurgeryTypes();
  const [surgeryTypeId, setSurgeryTypeId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['benchmarks', 'surgery-types', surgeryTypeId],
    queryFn: () => benchmarksApi.getSurgeryTypeBenchmarks({ surgeryTypeId: surgeryTypeId || undefined }),
  });

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      { header: 'Surgery Type', accessorKey: 'surgery_type_name' },
      { header: 'Cases', accessorKey: 'case_count' },
      { header: 'Avg Budget', accessorKey: 'avg_budget', cell: (i) => formatCurrency(i.getValue()) },
      { header: 'Avg Actual', accessorKey: 'avg_actual_cost', cell: (i) => formatCurrency(i.getValue()) },
      { header: 'Avg Quote', accessorKey: 'avg_quote', cell: (i) => formatCurrency(i.getValue()) },
      { header: 'Avg Profit', accessorKey: 'avg_profit', cell: (i) => formatCurrency(i.getValue()) },
      { header: 'Avg Margin', accessorKey: 'avg_margin_pct', cell: (i) => formatPercent(i.getValue()) },
      { header: 'Avg Duration', accessorKey: 'avg_duration_minutes', cell: (i) => formatDuration(i.getValue()) },
      { header: 'Median Cost', accessorKey: 'median_actual_cost', cell: (i) => formatCurrency(i.getValue()) },
    ],
    []
  );

  return (
    <Stack spacing={2.5}>
      <Select size="small" value={surgeryTypeId} onChange={(e) => setSurgeryTypeId(e.target.value)} displayEmpty sx={{ maxWidth: 260 }}>
        <MenuItem value="">All Surgery Types</MenuItem>
        {surgeryTypes?.map((t) => (
          <MenuItem key={t.surgeryTypeId} value={t.surgeryTypeId}>
            {t.name}
          </MenuItem>
        ))}
      </Select>

      {surgeryTypeId && data && (
        <Stack direction={{ xs: 'column', sm: 'row' }} spacing={2}>
          {data.mostExpensiveSurgery && (
            <ExtremeCard label="Most Expensive" date={data.mostExpensiveSurgery.surgery_date} value={formatCurrency(data.mostExpensiveSurgery.actual_total)} color={palette.red500} />
          )}
          {data.mostProfitableSurgery && (
            <ExtremeCard label="Most Profitable" date={data.mostProfitableSurgery.surgery_date} value={formatCurrency(data.mostProfitableSurgery.profit_amount)} color={palette.green600} />
          )}
          {data.lowestMarginSurgery && (
            <ExtremeCard label="Lowest Margin" date={data.lowestMarginSurgery.surgery_date} value={formatPercent(data.lowestMarginSurgery.margin_pct)} color={palette.amber600} />
          )}
        </Stack>
      )}

      <DataTable data={data?.benchmarks ?? []} columns={columns} isLoading={isLoading} dense />
    </Stack>
  );
}

function AnaesthetistBenchmarkTab() {
  const { data: anaesthetists } = useAnaesthetists();
  const [anaesthetistId, setAnaesthetistId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['benchmarks', 'anaesthetists', anaesthetistId],
    queryFn: () => benchmarksApi.getAnaesthetistBenchmarks({ anaesthetistId: anaesthetistId || undefined }),
  });

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      { header: 'Anaesthetist', accessorKey: 'anaesthetist_name' },
      { header: 'Anaesthesia Type', accessorKey: 'anaesthesia_type', cell: (i) => i.getValue() || 'Unspecified' },
      { header: 'Cases', accessorKey: 'case_count' },
      { header: 'Avg Fee', accessorKey: 'avg_fee', cell: (i) => formatCurrency(i.getValue()) },
      { header: 'Median Fee', accessorKey: 'median_fee', cell: (i) => formatCurrency(i.getValue()) },
      { header: 'Fee Range', cell: (i) => `${formatCurrency(i.row.original.min_fee)} – ${formatCurrency(i.row.original.max_fee)}` },
      { header: 'Std Dev', accessorKey: 'stddev_fee', cell: (i) => formatCurrency(i.getValue()) },
    ],
    []
  );

  return (
    <Stack spacing={2.5}>
      <Select size="small" value={anaesthetistId} onChange={(e) => setAnaesthetistId(e.target.value)} displayEmpty sx={{ maxWidth: 260 }}>
        <MenuItem value="">All Anaesthetists</MenuItem>
        {anaesthetists?.map((a) => (
          <MenuItem key={a.anaesthetistId} value={a.anaesthetistId}>
            {a.fullName}
          </MenuItem>
        ))}
      </Select>
      <DataTable data={data?.benchmarks ?? []} columns={columns} isLoading={isLoading} dense />
    </Stack>
  );
}

function OtBenchmarkTab() {
  const { data: surgeryTypes } = useSurgeryTypes();
  const [surgeryTypeId, setSurgeryTypeId] = useState('');

  const { data, isLoading } = useQuery({
    queryKey: ['benchmarks', 'ot', surgeryTypeId],
    queryFn: () => benchmarksApi.getOtBenchmarks({ surgeryTypeId: surgeryTypeId || undefined }),
  });

  const columns = useMemo<ColumnDef<any, any>[]>(
    () => [
      { header: 'Surgery Type', accessorKey: 'surgery_type_name' },
      { header: 'OT Room', accessorKey: 'room_name', cell: (i) => i.getValue() || 'All Rooms' },
      { header: 'Cases', accessorKey: 'case_count' },
      { header: 'Avg Duration', accessorKey: 'avg_duration_minutes', cell: (i) => formatDuration(i.getValue()) },
      { header: 'Median Duration', accessorKey: 'median_duration_minutes', cell: (i) => formatDuration(i.getValue()) },
      { header: 'Duration Range', cell: (i) => `${formatDuration(i.row.original.min_duration_minutes)} – ${formatDuration(i.row.original.max_duration_minutes)}` },
      { header: 'Avg OT Cost', accessorKey: 'avg_ot_cost', cell: (i) => formatCurrency(i.getValue()) },
      { header: 'Cost / Minute', accessorKey: 'avg_cost_per_minute', cell: (i) => formatCurrency(i.getValue()) },
    ],
    []
  );

  return (
    <Stack spacing={2.5}>
      <Select size="small" value={surgeryTypeId} onChange={(e) => setSurgeryTypeId(e.target.value)} displayEmpty sx={{ maxWidth: 260 }}>
        <MenuItem value="">All Surgery Types</MenuItem>
        {surgeryTypes?.map((t) => (
          <MenuItem key={t.surgeryTypeId} value={t.surgeryTypeId}>
            {t.name}
          </MenuItem>
        ))}
      </Select>
      <DataTable data={data?.benchmarks ?? []} columns={columns} isLoading={isLoading} dense />
    </Stack>
  );
}

function ExtremeCard({ label, date, value, color }: { label: string; date: string; value: string; color: string }) {
  return (
    <Box sx={{ flex: 1, p: 2, borderRadius: 1.5, border: 1, borderColor: 'divider', borderLeft: `3px solid ${color}` }}>
      <Box sx={{ fontSize: 12, color: 'text.secondary', fontWeight: 600 }}>{label}</Box>
      <Box sx={{ fontSize: 20, fontWeight: 700, fontFamily: 'IBM Plex Mono, monospace' }}>{value}</Box>
      <Box sx={{ fontSize: 11, color: 'text.secondary' }}>{formatDate(date)}</Box>
    </Box>
  );
}
