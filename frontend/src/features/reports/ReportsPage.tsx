import { useState } from 'react';
import { Grid, Select, MenuItem, TextField, Button, Stack, Typography } from '@mui/material';
import { TableChartOutlined, DescriptionOutlined } from '@mui/icons-material';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { useBranches, useSurgeons, useSurgeryTypes } from '@/hooks/useMasterData';
import * as reportsApi from '@/api/reports.api';
import { DateInput } from '@/components/common/DateInput';

export function ReportsPage() {
  const { data: branches } = useBranches();
  const { data: surgeons } = useSurgeons();
  const { data: surgeryTypes } = useSurgeryTypes();

  const [branchId, setBranchId] = useState('');
  const [surgeonId, setSurgeonId] = useState('');
  const [surgeryTypeId, setSurgeryTypeId] = useState('');
  const [status, setStatus] = useState('COMPLETED');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [months, setMonths] = useState(12);
  const [busy, setBusy] = useState<string | null>(null);

  async function runExport(kind: 'xlsx' | 'csv' | 'pdf') {
    setBusy(kind);
    try {
      if (kind === 'pdf') {
        await reportsApi.exportDashboardPdf({ branchId: branchId || undefined, months });
      } else {
        await reportsApi.exportSurgeries(
          {
            branchId: branchId || undefined,
            surgeonId: surgeonId || undefined,
            surgeryTypeId: surgeryTypeId || undefined,
            status: status || undefined,
            dateFrom: dateFrom || undefined,
            dateTo: dateTo || undefined,
          },
          kind
        );
      }
    } finally {
      setBusy(null);
    }
  }

  return (
    <>
      <PageHeader title="Reports" subtitle="Export surgery data and dashboard summaries for offline use" />

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={7}>
          <SectionCard title="Surgery List Export" subtitle="Excel or CSV, filtered by branch, surgeon, surgery type, status, and date range">
            <Stack spacing={2}>
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                <Select size="small" value={branchId} onChange={(e) => setBranchId(e.target.value)} displayEmpty sx={{ minWidth: 160 }}>
                  <MenuItem value="">All Branches</MenuItem>
                  {branches?.map((b) => (
                    <MenuItem key={b.branchId} value={b.branchId}>
                      {b.branchName}
                    </MenuItem>
                  ))}
                </Select>
                <Select size="small" value={surgeonId} onChange={(e) => setSurgeonId(e.target.value)} displayEmpty sx={{ minWidth: 160 }}>
                  <MenuItem value="">All Surgeons</MenuItem>
                  {surgeons?.map((s) => (
                    <MenuItem key={s.surgeonId} value={s.surgeonId}>
                      {s.fullName}
                    </MenuItem>
                  ))}
                </Select>
                <Select size="small" value={surgeryTypeId} onChange={(e) => setSurgeryTypeId(e.target.value)} displayEmpty sx={{ minWidth: 180 }}>
                  <MenuItem value="">All Surgery Types</MenuItem>
                  {surgeryTypes?.map((t) => (
                    <MenuItem key={t.surgeryTypeId} value={t.surgeryTypeId}>
                      {t.name}
                    </MenuItem>
                  ))}
                </Select>
                <Select size="small" value={status} onChange={(e) => setStatus(e.target.value)} sx={{ minWidth: 150 }}>
                  <MenuItem value="">Any Status</MenuItem>
                  <MenuItem value="COMPLETED">Completed</MenuItem>
                  <MenuItem value="DRAFT">Draft</MenuItem>
                  <MenuItem value="SCHEDULED">Scheduled</MenuItem>
                  <MenuItem value="IN_PROGRESS">In Progress</MenuItem>
                  <MenuItem value="CANCELLED">Cancelled</MenuItem>
                </Select>
              </Stack>
              <Stack direction="row" spacing={2}>
                <DateInput size="small" label="From" value={dateFrom} onChange={(v) => setDateFrom(v)} />
                <DateInput size="small" label="To" value={dateTo} onChange={(v) => setDateTo(v)} />
              </Stack>
              <Stack direction="row" spacing={1.5}>
                <Button
                  variant="contained"
                  startIcon={<TableChartOutlined />}
                  onClick={() => runExport('xlsx')}
                  disabled={busy === 'xlsx'}
                >
                  {busy === 'xlsx' ? 'Generating…' : 'Export to Excel'}
                </Button>
                <Button
                  variant="outlined"
                  startIcon={<TableChartOutlined />}
                  onClick={() => runExport('csv')}
                  disabled={busy === 'csv'}
                >
                  {busy === 'csv' ? 'Generating…' : 'Export to CSV'}
                </Button>
              </Stack>
            </Stack>
          </SectionCard>
        </Grid>

        <Grid item xs={12} md={5}>
          <SectionCard title="Dashboard Summary Export" subtitle="One-page PDF of hospital KPIs and monthly trend">
            <Stack spacing={2}>
              <Select size="small" value={branchId} onChange={(e) => setBranchId(e.target.value)} displayEmpty>
                <MenuItem value="">All Branches</MenuItem>
                {branches?.map((b) => (
                  <MenuItem key={b.branchId} value={b.branchId}>
                    {b.branchName}
                  </MenuItem>
                ))}
              </Select>
              <Select size="small" value={months} onChange={(e) => setMonths(Number(e.target.value))}>
                <MenuItem value={3}>Last 3 months</MenuItem>
                <MenuItem value={6}>Last 6 months</MenuItem>
                <MenuItem value={12}>Last 12 months</MenuItem>
              </Select>
              <Button
                variant="contained"
                color="secondary"
                startIcon={<DescriptionOutlined />}
                onClick={() => runExport('pdf')}
                disabled={busy === 'pdf'}
              >
                {busy === 'pdf' ? 'Generating…' : 'Export to PDF'}
              </Button>
              <Typography variant="caption" color="text.secondary">
                Uses your browser's print dialog for printing — open the PDF and print from there.
              </Typography>
            </Stack>
          </SectionCard>
        </Grid>
      </Grid>
    </>
  );
}
