import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import {
  Alert,
  Button,
  Checkbox,
  MenuItem,
  Select,
  TextField,
  Typography,
  Chip,
} from '@mui/material';
import { CompareArrowsOutlined } from '@mui/icons-material';
import type { ColumnDef } from '@tanstack/react-table';
import { PageHeader } from '@/components/common/PageHeader';
import { FilterBar } from '@/components/common/FilterBar';
import { DataTable } from '@/components/common/DataTable';
import { EmptyState } from '@/components/common/AsyncStates';
import { useSurgeons, useSurgeryTypes, useDepartments } from '@/hooks/useMasterData';
import * as explorerApi from '@/api/explorer.api';
import { formatCurrency, formatDate, formatDuration, formatPercent } from '@/utils/format';
import { palette } from '@/theme/tokens';
import type { SimilarSurgeryRow } from '@/api/types';
import { CompareDrawer } from './CompareDrawer';
import { DateInput } from '@/components/common/DateInput';

export function ExplorerPage() {
  const { data: surgeons } = useSurgeons();
  const { data: surgeryTypes } = useSurgeryTypes();
  const { data: departments } = useDepartments();

  const [surgeryTypeId, setSurgeryTypeId] = useState('');
  const [surgeonId, setSurgeonId] = useState('');
  const [departmentId, setDepartmentId] = useState('');
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo, setDateTo] = useState('');
  const [minProfit, setMinProfit] = useState('');
  const [maxProfit, setMaxProfit] = useState('');
  const [minDuration, setMinDuration] = useState('');
  const [maxDuration, setMaxDuration] = useState('');
  const [sort, setSort] = useState('similarityScore:desc');
  const [page, setPage] = useState(1);
  const [limit, setLimit] = useState(10);
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [compareOpen, setCompareOpen] = useState(false);

  const filters: explorerApi.ExplorerFilters = {
    surgeryTypeId,
    surgeonId: surgeonId || undefined,
    departmentId: departmentId || undefined,
    dateFrom: dateFrom || undefined,
    dateTo: dateTo || undefined,
    minProfit: minProfit ? Number(minProfit) : undefined,
    maxProfit: maxProfit ? Number(maxProfit) : undefined,
    minDuration: minDuration ? Number(minDuration) : undefined,
    maxDuration: maxDuration ? Number(maxDuration) : undefined,
    sort,
    page,
    limit,
  };

  const { data, isLoading, isFetching } = useQuery({
    queryKey: ['explorer', filters],
    queryFn: () => explorerApi.searchSimilarSurgeries(filters),
    enabled: !!surgeryTypeId,
  });

  function toggleSelect(id: string) {
    setSelectedIds((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id].slice(-10)));
  }

  const columns = useMemo<ColumnDef<SimilarSurgeryRow, any>[]>(
    () => [
      {
        id: 'select',
        header: '',
        cell: (info) => (
          <Checkbox
            size="small"
            checked={selectedIds.includes(info.row.original.surgeryId)}
            onChange={() => toggleSelect(info.row.original.surgeryId)}
            onClick={(e) => e.stopPropagation()}
          />
        ),
        enableSorting: false,
      },
      {
        header: 'Match',
        accessorKey: 'similarityScore',
        cell: (info) => (
          <Chip
            size="small"
            label={`${Math.round(info.getValue())}%`}
            sx={{ bgcolor: palette.teal100, color: palette.teal600, fontWeight: 700 }}
          />
        ),
      },
      { header: 'Date', accessorKey: 'surgeryDate', cell: (info) => formatDate(info.getValue()) },
      { header: 'MR Number', accessorKey: 'mrNumber' },
      { header: 'Patient', accessorKey: 'patientName' },
      { header: 'Age', accessorKey: 'patientAgeYears' },
      { header: 'Surgeon', accessorKey: 'surgeonName' },
      { header: 'Anaesthetist', accessorKey: 'anaesthetistName', cell: (info) => info.getValue() || '—' },
      { header: 'Duration', accessorKey: 'durationMinutes', cell: (info) => formatDuration(info.getValue()) },
      { header: 'Surgeon Fee', accessorKey: 'surgeonFee', cell: (info) => formatCurrency(info.getValue()) },
      { header: 'Assistant', accessorKey: 'assistantCost', cell: (info) => formatCurrency(info.getValue()) },
      { header: 'OT Cost', accessorKey: 'otCost', cell: (info) => formatCurrency(info.getValue()) },
      { header: 'Consumables', accessorKey: 'consumablesCost', cell: (info) => formatCurrency(info.getValue()) },
      { header: 'Actual Total', accessorKey: 'actualTotal', cell: (info) => formatCurrency(info.getValue()) },
      { header: 'Quoted', accessorKey: 'quotedPrice', cell: (info) => formatCurrency(info.getValue()) },
      { header: 'Profit', accessorKey: 'profit', cell: (info) => formatCurrency(info.getValue()) },
      { header: 'Margin', accessorKey: 'marginPct', cell: (info) => formatPercent(info.getValue()) },
    ],
    [selectedIds]
  );

  return (
    <>
      <PageHeader
        title="Similar Surgery Explorer"
        subtitle="Browse and compare historical completed surgeries similar to a given profile"
        actions={
          <Button
            variant="contained"
            startIcon={<CompareArrowsOutlined />}
            disabled={selectedIds.length < 2}
            onClick={() => setCompareOpen(true)}
          >
            Compare ({selectedIds.length})
          </Button>
        }
      />

      <FilterBar
        onClear={() => {
          setSurgeonId('');
          setDepartmentId('');
          setDateFrom('');
          setDateTo('');
          setMinProfit('');
          setMaxProfit('');
          setMinDuration('');
          setMaxDuration('');
          setPage(1);
        }}
      >
        <Select
          size="small"
          value={surgeryTypeId}
          onChange={(e) => {
            setSurgeryTypeId(e.target.value);
            setPage(1);
          }}
          displayEmpty
          sx={{ minWidth: 200 }}
        >
          <MenuItem value="" disabled>
            Surgery Type (required)
          </MenuItem>
          {surgeryTypes?.map((t) => (
            <MenuItem key={t.surgeryTypeId} value={t.surgeryTypeId}>
              {t.name}
            </MenuItem>
          ))}
        </Select>
        <Select size="small" value={surgeonId} onChange={(e) => setSurgeonId(e.target.value)} displayEmpty sx={{ minWidth: 160 }}>
          <MenuItem value="">Any Surgeon</MenuItem>
          {surgeons?.map((s) => (
            <MenuItem key={s.surgeonId} value={s.surgeonId}>
              {s.fullName}
            </MenuItem>
          ))}
        </Select>
        <Select size="small" value={departmentId} onChange={(e) => setDepartmentId(e.target.value)} displayEmpty sx={{ minWidth: 160 }}>
          <MenuItem value="">Any Department</MenuItem>
          {departments?.map((d) => (
            <MenuItem key={d.departmentId} value={d.departmentId}>
              {d.departmentName}
            </MenuItem>
          ))}
        </Select>
        <DateInput size="small" label="From" value={dateFrom} onChange={(v) => setDateFrom(v)} />
        <DateInput size="small" label="To" value={dateTo} onChange={(v) => setDateTo(v)} />
        <TextField size="small" label="Min Profit" type="number" value={minProfit} onChange={(e) => setMinProfit(e.target.value)} sx={{ width: 120 }} />
        <TextField size="small" label="Max Profit" type="number" value={maxProfit} onChange={(e) => setMaxProfit(e.target.value)} sx={{ width: 120 }} />
        <TextField size="small" label="Min Duration" type="number" value={minDuration} onChange={(e) => setMinDuration(e.target.value)} sx={{ width: 120 }} />
        <TextField size="small" label="Max Duration" type="number" value={maxDuration} onChange={(e) => setMaxDuration(e.target.value)} sx={{ width: 120 }} />
        <Select size="small" value={sort} onChange={(e) => setSort(e.target.value)} sx={{ minWidth: 170 }}>
          <MenuItem value="similarityScore:desc">Best Match First</MenuItem>
          <MenuItem value="surgeryDate:desc">Newest First</MenuItem>
          <MenuItem value="actualTotal:asc">Lowest Cost First</MenuItem>
          <MenuItem value="actualTotal:desc">Highest Cost First</MenuItem>
          <MenuItem value="profit:desc">Highest Profit First</MenuItem>
          <MenuItem value="marginPct:asc">Lowest Margin First</MenuItem>
        </Select>
      </FilterBar>

      {!surgeryTypeId ? (
        <EmptyState
          title="Select a surgery type to begin"
          description="Choose a surgery type above (and optionally a surgeon) to see similarity-ranked historical cases."
        />
      ) : (
        <>
          {isFetching && !isLoading && (
            <Typography variant="caption" color="text.secondary" sx={{ mb: 1, display: 'block' }}>
              Refreshing…
            </Typography>
          )}
          <DataTable
            data={data?.items ?? []}
            columns={columns}
            isLoading={isLoading}
            emptyTitle="No similar surgeries found"
            emptyDescription="Try widening your filters."
            dense
            maxHeight={560}
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
      )}

      {selectedIds.length > 10 && (
        <Alert severity="warning" sx={{ mt: 2 }}>
          You can compare up to 10 surgeries at once — only the most recently selected 10 are kept.
        </Alert>
      )}

      <CompareDrawer open={compareOpen} surgeryIds={selectedIds} onClose={() => setCompareOpen(false)} />
    </>
  );
}
