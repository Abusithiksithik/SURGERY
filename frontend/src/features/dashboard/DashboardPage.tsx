import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Card,
  CardActionArea,
  CardContent,
  Grid,
  MenuItem,
  Select,
  Stack,
  Typography,
  Chip,
  List,
  ListItem,
  ListItemText,
  Divider,
} from '@mui/material';
import {
  MonetizationOnOutlined,
  TrendingUpOutlined,
  ReceiptLongOutlined,
  AccountBalanceWalletOutlined,
  TravelExploreOutlined,
  InsightsOutlined,
  NotificationsActiveOutlined,
  SummarizeOutlined,
} from '@mui/icons-material';
import { PageHeader } from '@/components/common/PageHeader';
import { KpiCard } from '@/components/common/KpiCard';
import { SectionCard } from '@/components/common/SectionCard';
import { TrendLineChart } from '@/components/charts/TrendLineChart';
import { LoadingState, ErrorState } from '@/components/common/AsyncStates';
import { ExportMenu } from '@/components/common/ExportMenu';
import { useBranches } from '@/hooks/useMasterData';
import * as dashboardApi from '@/api/dashboard.api';
import * as reportsApi from '@/api/reports.api';
import { formatCurrency, formatPercent, formatDate } from '@/utils/format';
import { palette } from '@/theme/tokens';

export function DashboardPage() {
  const navigate = useNavigate();
  const [branchId, setBranchId] = useState<string>('');
  const [months, setMonths] = useState(12);

  const { data: branches } = useBranches();

  const summaryQuery = useQuery({
    queryKey: ['dashboard', 'summary', branchId, months],
    queryFn: () => dashboardApi.getDashboardSummary({ branchId: branchId || undefined, months }),
  });

  const topProfitableQuery = useQuery({
    queryKey: ['dashboard', 'top-profitable', branchId],
    queryFn: () => dashboardApi.getTopProfitable({ branchId: branchId || undefined, limit: 5 }),
  });

  const lowestMarginQuery = useQuery({
    queryKey: ['dashboard', 'lowest-margin', branchId],
    queryFn: () => dashboardApi.getLowestMargin({ branchId: branchId || undefined, limit: 5 }),
  });

  const forecastQuery = useQuery({
    queryKey: ['dashboard', 'forecast', branchId],
    queryFn: () => dashboardApi.getForecast({ branchId: branchId || undefined, metric: 'revenue', periods: 3 }),
    retry: 1,
  });

  if (summaryQuery.isLoading) return <LoadingState label="Loading dashboard…" minHeight={400} />;

  const kpis = summaryQuery.data?.kpis;
  const trend = (summaryQuery.data?.monthlyTrend ?? []).map((row) => ({
    month: formatDate(row.month).replace(/\/\d{4}$/, ''),
    Revenue: Number(row.total_revenue),
    Cost: Number(row.total_cost),
    Profit: Number(row.total_profit),
  })) ?? [];

  return (
    <>
      <PageHeader
        title="Hospital Dashboard"
        subtitle="Revenue, cost, and profit across all completed surgeries"
        actions={
          <>
            <Select
              size="small"
              value={branchId}
              onChange={(e) => setBranchId(e.target.value)}
              displayEmpty
              sx={{ minWidth: 160 }}
            >
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
              <MenuItem value={24}>Last 24 months</MenuItem>
            </Select>
            <ExportMenu onExportPdf={() => reportsApi.exportDashboardPdf({ branchId: branchId || undefined, months })} />
          </>
        }
      />

      {summaryQuery.isError && (
        <Alert
          severity="warning"
          sx={{ mb: 2.5 }}
          action={
            <Button color="inherit" size="small" onClick={() => summaryQuery.refetch()}>
              Retry
            </Button>
          }
        >
          Dashboard summary could not be loaded. Check that the backend server is running on port 5000.
        </Alert>
      )}

      {forecastQuery.isError && !summaryQuery.isError && (
        <Alert severity="info" sx={{ mb: 2.5 }}>
          Forecast data unavailable — not enough completed surgery history yet.
        </Alert>
      )}

      <Grid container spacing={2.5} sx={{ mb: 2.5 }}>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            label="Total Revenue"
            value={formatCurrency(kpis?.totalRevenue)}
            icon={<MonetizationOnOutlined />}
            accentColor={palette.teal600}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            label="Total Profit"
            value={formatCurrency(kpis?.totalProfit)}
            icon={<TrendingUpOutlined />}
            accentColor={palette.green600}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            label="Overall Margin"
            value={formatPercent(kpis?.overallMarginPct)}
            icon={<ReceiptLongOutlined />}
            accentColor={palette.slate700}
          />
        </Grid>
        <Grid item xs={12} sm={6} lg={3}>
          <KpiCard
            label="Pending Collection"
            value={formatCurrency(kpis?.pendingCollection)}
            icon={<AccountBalanceWalletOutlined />}
            accentColor={palette.amber600}
          />
        </Grid>
      </Grid>

      <Grid container spacing={2.5}>
        <Grid item xs={12} lg={8}>
          <SectionCard title="Monthly Revenue, Cost & Profit" subtitle={`Case count: ${kpis?.caseCount ?? 0}`}>
            {trend.length === 0 ? (
              <Typography color="text.secondary" sx={{ py: 6, textAlign: 'center' }}>
                No completed surgery data for this period yet.
              </Typography>
            ) : (
              <TrendLineChart
                data={trend}
                xKey="month"
                series={[
                  { key: 'Revenue', label: 'Revenue', color: palette.slate700 },
                  { key: 'Cost', label: 'Cost', color: palette.amber500 },
                  { key: 'Profit', label: 'Profit', color: palette.teal600 },
                ]}
              />
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} lg={4}>
          <SectionCard
            title="Revenue Forecast"
            subtitle={forecastQuery.data?.trend ? `Trend: ${forecastQuery.data.trend.direction}` : undefined}
          >
            {forecastQuery.isLoading ? (
              <LoadingState minHeight={180} />
            ) : forecastQuery.isError ? (
              <Typography color="text.secondary" variant="body2">
                Forecast unavailable — not enough historical data yet.
              </Typography>
            ) : forecastQuery.data && forecastQuery.data.forecast.length > 0 ? (
              <Stack spacing={1.5}>
                {forecastQuery.data.forecast.map((f) => (
                  <Stack key={f.periodsAhead} direction="row" justifyContent="space-between" alignItems="center">
                    <Typography variant="body2" color="text.secondary">
                      +{f.periodsAhead} month{f.periodsAhead > 1 ? 's' : ''}
                    </Typography>
                    <Typography fontWeight={700} sx={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                      {formatCurrency(f.projectedValue)}
                    </Typography>
                  </Stack>
                ))}
                <Chip
                  size="small"
                  label={`Model fit R² = ${forecastQuery.data.trend?.r2 != null ? forecastQuery.data.trend.r2.toFixed(2) : 'N/A'}`}
                  sx={{ alignSelf: 'flex-start', mt: 1 }}
                />
              </Stack>
            ) : (
              <Typography color="text.secondary" variant="body2">
                Not enough historical data to forecast yet.
              </Typography>
            )}
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard title="Top 5 Most Profitable Surgeries" noPadding>
            <TopBottomList
              rows={topProfitableQuery.data}
              isLoading={topProfitableQuery.isLoading}
              valueLabel="Profit"
              positive
            />
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={6}>
          <SectionCard title="Lowest Margin Surgeries" noPadding>
            <TopBottomList
              rows={lowestMarginQuery.data}
              isLoading={lowestMarginQuery.isLoading}
              valueLabel="Margin"
              isPercent
              positive={false}
            />
          </SectionCard>
        </Grid>
      </Grid>

      {/* ── Quick Access to Modules ───────────────────────────────────── */}
      <Typography variant="subtitle2" color="text.secondary"
        sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mt: 3, mb: 1.5 }}>
        Analytics &amp; Tools
      </Typography>
      <Grid container spacing={2} sx={{ mb: 2 }}>
        {[
          { label: 'Similar Surgery Explorer', sub: 'Compare past surgeries by type, surgeon, cost', path: '/explorer', Icon: TravelExploreOutlined },
          { label: 'Benchmarks', sub: 'Surgeon, OT, and procedure performance benchmarks', path: '/benchmarks', Icon: InsightsOutlined },
          { label: 'Alert Center', sub: 'Cost overruns, margin alerts, and thresholds', path: '/alerts', Icon: NotificationsActiveOutlined },
          { label: 'Reports', sub: 'Export surgery data as XLSX, CSV, or PDF', path: '/reports', Icon: SummarizeOutlined },
        ].map(({ label, sub, path, Icon }) => (
          <Grid item xs={12} sm={6} md={3} key={path}>
            <Card variant="outlined" sx={{ height: '100%' }}>
              <CardActionArea onClick={() => navigate(path)} sx={{ height: '100%' }}>
                <CardContent>
                  <Icon sx={{ color: 'primary.main', mb: 1 }} />
                  <Typography fontWeight={700} fontSize={14}>{label}</Typography>
                  <Typography variant="body2" color="text.secondary" fontSize={12} sx={{ mt: 0.5 }}>
                    {sub}
                  </Typography>
                </CardContent>
              </CardActionArea>
            </Card>
          </Grid>
        ))}
      </Grid>
    </>
  );
}

function TopBottomList({
  rows,
  isLoading,
  valueLabel,
  isPercent,
  positive,
}: {
  rows?: Array<{ surgery_id: string; surgery_date: string; surgeon_name: string; surgery_type_name: string; value: number }>;
  isLoading: boolean;
  valueLabel: string;
  isPercent?: boolean;
  positive: boolean;
}) {
  if (isLoading) return <LoadingState minHeight={180} />;
  if (!rows || rows.length === 0) {
    return (
      <Typography color="text.secondary" variant="body2" sx={{ px: 2.5, py: 3 }}>
        No data available yet.
      </Typography>
    );
  }

  return (
    <List dense disablePadding>
      {rows.map((row, i) => (
        <div key={row.surgery_id}>
          {i > 0 && <Divider component="li" />}
          <ListItem sx={{ py: 1.2 }}>
            <ListItemText
              primary={row.surgery_type_name}
              secondary={`${row.surgeon_name} · ${formatDate(row.surgery_date)}`}
              primaryTypographyProps={{ fontWeight: 600, fontSize: 13.5 }}
              secondaryTypographyProps={{ fontSize: 12 }}
            />
            <Typography
              fontWeight={700}
              sx={{
                fontFamily: 'IBM Plex Mono, monospace',
                color: positive ? 'success.main' : 'error.main',
              }}
            >
              {isPercent ? formatPercent(row.value) : formatCurrency(row.value)}
            </Typography>
          </ListItem>
        </div>
      ))}
    </List>
  );
}
