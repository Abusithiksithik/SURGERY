import { useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Grid, Select, MenuItem, Stack, Typography } from '@mui/material';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { KpiCard } from '@/components/common/KpiCard';
import { BarComparisonChart } from '@/components/charts/BarComparisonChart';
import { LoadingState } from '@/components/common/AsyncStates';
import { useBranches } from '@/hooks/useMasterData';
import * as dashboardApi from '@/api/dashboard.api';
import { formatCurrency, formatPercent } from '@/utils/format';
import { palette } from '@/theme/tokens';

export function CostIntelligencePage() {
  const [branchId, setBranchId] = useState('');
  const [months, setMonths] = useState(12);
  const { data: branches } = useBranches();

  const summaryQuery = useQuery({
    queryKey: ['cost-intel', 'summary', branchId, months],
    queryFn: () => dashboardApi.getDashboardSummary({ branchId: branchId || undefined, months }),
  });

  const deptQuery = useQuery({
    queryKey: ['cost-intel', 'department-comparison', branchId, months],
    queryFn: () => dashboardApi.getDepartmentComparison({ branchId: branchId || undefined, months }),
  });

  const branchQuery = useQuery({
    queryKey: ['cost-intel', 'branch-comparison', months],
    queryFn: () => dashboardApi.getBranchComparison({ months }),
  });

  const doctorQuery = useQuery({
    queryKey: ['cost-intel', 'doctor-comparison', branchId],
    queryFn: () => dashboardApi.getDoctorComparison({ branchId: branchId || undefined }),
  });

  const highestConsumablesQuery = useQuery({
    queryKey: ['cost-intel', 'highest-consumables', branchId],
    queryFn: () => dashboardApi.getHighestConsumables({ branchId: branchId || undefined, limit: 5 }),
  });

  const kpis = summaryQuery.data?.kpis;

  // Cost breakdown % — surgeon fee/assistant/OT/consumables/pharmacy/misc as a share of total cost.
  const costBreakdownPct = kpis
    ? {
        grossMarginPct: kpis.overallMarginPct,
        contributionMarginPct:
          kpis.totalRevenue > 0 ? Math.round(((kpis.totalRevenue - kpis.totalCost) / kpis.totalRevenue) * 10000) / 100 : null,
      }
    : null;

  return (
    <>
      <PageHeader
        title="Cost Intelligence Dashboard"
        subtitle="Financial intelligence: margins, comparisons, and cost drivers across the hospital"
        actions={
          <>
            <Select size="small" value={branchId} onChange={(e) => setBranchId(e.target.value)} displayEmpty sx={{ minWidth: 160 }}>
              <MenuItem value="">All Branches</MenuItem>
              {branches?.map((b) => (
                <MenuItem key={b.branchId} value={b.branchId}>
                  {b.branchName}
                </MenuItem>
              ))}
            </Select>
            <Select size="small" value={months} onChange={(e) => setMonths(Number(e.target.value))} sx={{ minWidth: 130 }}>
              <MenuItem value={3}>Last 3 months</MenuItem>
              <MenuItem value={6}>Last 6 months</MenuItem>
              <MenuItem value={12}>Last 12 months</MenuItem>
            </Select>
          </>
        }
      />

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label="Gross Margin" value={formatPercent(costBreakdownPct?.grossMarginPct)} accentColor={palette.teal600} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label="Contribution Margin" value={formatPercent(costBreakdownPct?.contributionMarginPct)} accentColor={palette.slate700} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label="Total Cost" value={formatCurrency(kpis?.totalCost)} accentColor={palette.amber600} />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard label="Pending Collection" value={formatCurrency(kpis?.pendingCollection)} accentColor={palette.red500} />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={6}>
          <SectionCard title="Department Comparison" subtitle="Revenue vs cost by department">
            {deptQuery.isLoading ? (
              <LoadingState minHeight={280} />
            ) : (
              <BarComparisonChart
                data={(deptQuery.data ?? []).map((d: any) => ({
                  name: d.department_name,
                  Revenue: Number(d.total_revenue),
                  Cost: Number(d.total_cost),
                }))}
                xKey="name"
                series={[
                  { key: 'Revenue', label: 'Revenue', color: palette.slate700 },
                  { key: 'Cost', label: 'Cost', color: palette.amber500 },
                ]}
                horizontal
              />
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={6}>
          <SectionCard title="Branch Comparison" subtitle="Revenue vs profit across branches">
            {branchQuery.isLoading ? (
              <LoadingState minHeight={280} />
            ) : (branchQuery.data ?? []).length <= 1 ? (
              <Stack alignItems="center" justifyContent="center" sx={{ minHeight: 280 }}>
                <Typography color="text.secondary" variant="body2">
                  Only one branch configured — comparison needs 2+.
                </Typography>
              </Stack>
            ) : (
              <BarComparisonChart
                data={(branchQuery.data ?? []).map((b: any) => ({
                  name: b.branch_name,
                  Revenue: Number(b.total_revenue),
                  Profit: Number(b.total_profit),
                }))}
                xKey="name"
                series={[
                  { key: 'Revenue', label: 'Revenue', color: palette.slate700 },
                  { key: 'Profit', label: 'Profit', color: palette.teal600 },
                ]}
              />
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={7}>
          <SectionCard title="Doctor Comparison" subtitle="Case volume, fee, profit, margin by surgeon">
            {doctorQuery.isLoading ? (
              <LoadingState minHeight={320} />
            ) : (
              <BarComparisonChart
                data={(doctorQuery.data ?? []).slice(0, 10).map((d: any) => ({
                  name: d.surgeon_name,
                  'Avg Profit': Number(d.avg_profit),
                }))}
                xKey="name"
                series={[{ key: 'Avg Profit', label: 'Avg Profit / Case', color: palette.teal600 }]}
                horizontal
                height={360}
              />
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={5}>
          <SectionCard title="Highest Consumable Cost Cases" noPadding>
            {highestConsumablesQuery.isLoading ? (
              <LoadingState minHeight={320} />
            ) : (
              <Stack divider={<Stack sx={{ borderTop: 1, borderColor: 'divider' }} />} sx={{ px: 2.5, pb: 2 }}>
                {(highestConsumablesQuery.data ?? []).map((row: any) => (
                  <Stack key={row.surgery_id} direction="row" justifyContent="space-between" sx={{ py: 1.2 }}>
                    <Stack>
                      <Typography variant="body2" fontWeight={600}>
                        {row.surgery_type_name}
                      </Typography>
                      <Typography variant="caption" color="text.secondary">
                        {row.surgeon_name}
                      </Typography>
                    </Stack>
                    <Typography fontWeight={700} sx={{ fontFamily: 'IBM Plex Mono, monospace', color: palette.amber600 }}>
                      {formatCurrency(row.value)}
                    </Typography>
                  </Stack>
                ))}
              </Stack>
            )}
          </SectionCard>
        </Grid>
      </Grid>
    </>
  );
}
