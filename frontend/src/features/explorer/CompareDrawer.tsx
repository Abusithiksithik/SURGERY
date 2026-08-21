import { Drawer, Box, Typography, IconButton, Table, TableBody, TableCell, TableHead, TableRow } from '@mui/material';
import { Close } from '@mui/icons-material';
import { useQuery } from '@tanstack/react-query';
import * as explorerApi from '@/api/explorer.api';
import { LoadingState } from '@/components/common/AsyncStates';
import { formatCurrency, formatDate, formatDuration, formatPercent } from '@/utils/format';

const ROWS: Array<{ label: string; get: (s: any) => string }> = [
  { label: 'Date', get: (s) => formatDate(s.surgeryDate) },
  { label: 'Patient', get: (s) => s.patient?.fullName || '—' },
  { label: 'Surgeon', get: (s) => s.surgeon?.fullName || '—' },
  { label: 'Anaesthetist', get: (s) => s.anaesthetist?.fullName || '—' },
  { label: 'Duration', get: (s) => formatDuration(s.durationMinutes) },
  { label: 'Surgeon Fee', get: (s) => formatCurrency(s.actualSurgeonFee ?? s.budgetSurgeonFee) },
  { label: 'OT Cost', get: (s) => formatCurrency(s.actualOtCost ?? s.budgetOtCost) },
  { label: 'Consumables', get: (s) => formatCurrency(s.actualConsumables ?? s.budgetConsumables) },
  { label: 'Actual Total', get: (s) => formatCurrency(s.actualTotal) },
  { label: 'Quoted Price', get: (s) => formatCurrency(s.quotedPrice) },
  { label: 'Profit', get: (s) => formatCurrency(s.profitAmount) },
  {
    label: 'Margin',
    get: (s) => formatPercent(s.quotedPrice ? ((s.profitAmount ?? 0) / s.quotedPrice) * 100 : null),
  },
];

export function CompareDrawer({
  open,
  surgeryIds,
  onClose,
}: {
  open: boolean;
  surgeryIds: string[];
  onClose: () => void;
}) {
  const { data, isLoading } = useQuery({
    queryKey: ['explorer', 'compare', surgeryIds],
    queryFn: () => explorerApi.compareSurgeries(surgeryIds),
    enabled: open && surgeryIds.length >= 2,
  });

  return (
    <Drawer anchor="right" open={open} onClose={onClose} PaperProps={{ sx: { width: { xs: '100%', md: 720 }, p: 3 } }}>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <Typography variant="h6" fontWeight={700}>
          Surgery Comparison
        </Typography>
        <IconButton onClick={onClose}>
          <Close />
        </IconButton>
      </Box>

      {isLoading ? (
        <LoadingState label="Loading comparison…" />
      ) : (
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell>Metric</TableCell>
              {data?.map((s) => (
                <TableCell key={s.surgeryId}>{s.surgeryType?.name}</TableCell>
              ))}
            </TableRow>
          </TableHead>
          <TableBody>
            {ROWS.map((row) => (
              <TableRow key={row.label}>
                <TableCell sx={{ fontWeight: 600 }}>{row.label}</TableCell>
                {data?.map((s) => (
                  <TableCell key={s.surgeryId} sx={{ fontFamily: 'IBM Plex Mono, monospace' }}>
                    {row.get(s)}
                  </TableCell>
                ))}
              </TableRow>
            ))}
          </TableBody>
        </Table>
      )}
    </Drawer>
  );
}
