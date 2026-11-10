import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Card, CardContent, Chip, Dialog, DialogActions, DialogContent,
  DialogTitle, Divider, Grid, MenuItem, Stack, TextField, Typography,
} from '@mui/material';
import * as dashboardApi from '@/api/dashboard.api';
import type { OtExpiryAlert, OtFixedStockAlert } from '@/api/dashboard.api';
import { stockApi } from '@/api/stock.api';

type CloseDraft = { itemId: string; locationId: string; batchNumber?: string | null; expiryDate: string; itemName: string; category: string };

export function OtStockAlertsPanel() {
  const qc = useQueryClient();
  const [showFixedAll, setShowFixedAll] = useState(false);
  const [showExpiryAll, setShowExpiryAll] = useState(false);
  const [showClosed, setShowClosed] = useState(false);
  const [manageOpen, setManageOpen] = useState(false);
  const [closeDraft, setCloseDraft] = useState<CloseDraft | null>(null);
  const [itemId, setItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [fixedQty, setFixedQty] = useState('');
  const [remarks, setRemarks] = useState('');
  const [closeScope, setCloseScope] = useState<'BATCH' | 'CATEGORY'>('BATCH');

  const alertsQuery = useQuery({ queryKey: ['dashboard', 'ot-stock-alerts'], queryFn: dashboardApi.getOtStockAlerts, refetchInterval: 60_000 });
  const itemsQuery = useQuery({ queryKey: ['stock', 'items', ''], queryFn: () => stockApi.items(''), enabled: manageOpen });
  const locationsQuery = useQuery({ queryKey: ['stock', 'locations'], queryFn: stockApi.locations, enabled: manageOpen });
  const saveTarget = useMutation({ mutationFn: dashboardApi.saveOtFixedStockTarget, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['dashboard', 'ot-stock-alerts'] }); await qc.invalidateQueries({ queryKey: ['stock', 'items'] }); setManageOpen(false); setItemId(''); setLocationId(''); setFixedQty(''); } });
  const closeAlert = useMutation({ mutationFn: dashboardApi.closeOtExpiryAlert, onSuccess: async () => { await qc.invalidateQueries({ queryKey: ['dashboard', 'ot-stock-alerts'] }); setCloseDraft(null); setRemarks(''); } });

  const fixed = alertsQuery.data?.fixedStock;
  const expiry = alertsQuery.data?.expiry;
  const fixedRows = showFixedAll ? fixed?.items ?? [] : (fixed?.items ?? []).slice(0, 5);
  const expiryRows = showExpiryAll ? expiry?.items ?? [] : (expiry?.items ?? []).slice(0, 5);
  const itemOptions = useMemo(() => itemsQuery.data ?? [], [itemsQuery.data]);

  if (alertsQuery.isLoading) return <Card variant="outlined" sx={{ mb: 2.5 }}><CardContent><Typography color="text.secondary">Loading OT stock alerts…</Typography></CardContent></Card>;
  if (alertsQuery.isError) return <Alert severity="warning" sx={{ mb: 2.5 }}>OT stock alerts could not be loaded. Please retry after checking the stock database.</Alert>;

  return <Box sx={{ mb: 3 }}>
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ xs: 'stretch', sm: 'center' }} spacing={1} sx={{ mb: 1.5 }}>
      <Typography variant="overline" color="text.secondary" sx={{ letterSpacing: 1 }}>OT Store Alerts</Typography>
      <Stack direction="row" spacing={1}>
        <Button size="small" onClick={() => alertsQuery.refetch()}>Refresh</Button>
        <Button size="small" variant="outlined" onClick={() => setManageOpen(true)}>Manage Fixed Qty</Button>
      </Stack>
    </Stack>
    <Grid container spacing={2}>
      <Grid item xs={12} lg={6}>
        <Card variant="outlined" sx={{ height: '100%', bgcolor: 'background.paper' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography variant="h6" fontWeight={700}>Fixed Stock Mismatch</Typography>
              <Stack direction="row" spacing={0.75}>
                <Chip size="small" color="warning" label={`${fixed?.yellowCount ?? 0} yellow`} />
                <Chip size="small" color="error" label={`${fixed?.redCount ?? 0} red`} />
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>
              OT stock must match the configured Fixed Qty. Yellow = within 24 hours of the latest stock movement; Red = overdue.
            </Typography>
            {fixedRows.length === 0 ? <Box sx={{ py: 3, textAlign: 'center' }}><Typography color="text.secondary">{fixed?.configuredCount ? '✓ Every configured fixed-stock item is at its Fixed Qty.' : 'No fixed stock targets configured yet.'}</Typography><Typography variant="caption" color="text.secondary">Configure items using Manage Fixed Qty.</Typography></Box> : fixedRows.map((row: OtFixedStockAlert, i: number) => <Box key={row.targetId}>
              {i > 0 && <Divider sx={{ my: 1.25 }} />}
              <Stack direction="row" spacing={1.25} alignItems="stretch">
                <Box sx={{ width: 4, borderRadius: 2, bgcolor: row.severity === 'RED' ? 'error.main' : 'warning.main', flexShrink: 0 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={700}>{row.itemName}</Typography>
                  <Typography variant="body2" color="text.secondary">Fixed {Number(row.fixedQty)} · In OT {Number(row.onHandQty)} · {row.locationCode}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography fontWeight={800} color={row.severity === 'RED' ? 'error.main' : 'warning.main'}>{Number(row.difference) > 0 ? '+' : ''}{Number(row.difference)}</Typography>
                  <Typography variant="caption" color="text.secondary">{row.severity === 'RED' ? `overdue ${row.hoursOverdue}h` : `${row.hoursLeft}h left`}</Typography>
                </Box>
              </Stack>
            </Box>)}
            {(fixed?.items.length ?? 0) > 5 && <Button fullWidth size="small" sx={{ mt: 1.5 }} onClick={() => setShowFixedAll(v => !v)}>{showFixedAll ? 'Show less' : `Show all ${fixed?.items.length}`}</Button>}
          </CardContent>
        </Card>
      </Grid>
      <Grid item xs={12} lg={6}>
        <Card variant="outlined" sx={{ height: '100%', bgcolor: 'background.paper' }}>
          <CardContent>
            <Stack direction="row" alignItems="center" justifyContent="space-between" spacing={1}>
              <Typography variant="h6" fontWeight={700}>Expiry Alerts · next 3 months</Typography>
              <Stack direction="row" spacing={0.75}>
                <Chip size="small" color="error" label={`${expiry?.expiredCount ?? 0} expired`} />
                <Chip size="small" color="warning" label={`${expiry?.withinThreeMonthsCount ?? 0} ≤ 3 months`} />
              </Stack>
            </Stack>
            <Typography variant="body2" color="text.secondary" sx={{ mt: 0.5, mb: 1.5 }}>Close an alert with a remark when the batch is still usable. Closed alerts remain recorded.</Typography>
            {expiryRows.length === 0 ? <Box sx={{ py: 3, textAlign: 'center' }}><Typography color="text.secondary">✓ No expiry alerts in the next 3 months.</Typography></Box> : expiryRows.map((row: OtExpiryAlert, i: number) => <Box key={`${row.itemId}-${row.locationId}-${row.batchNumber ?? ''}-${row.expiryDate}`}>
              {i > 0 && <Divider sx={{ my: 1.25 }} />}
              <Stack direction="row" spacing={1.25} alignItems="center">
                <Box sx={{ width: 4, alignSelf: 'stretch', borderRadius: 2, bgcolor: row.status === 'EXPIRED' ? 'error.main' : 'warning.main', flexShrink: 0 }} />
                <Box sx={{ minWidth: 0, flex: 1 }}>
                  <Typography fontWeight={700}>{row.itemName}</Typography>
                  <Typography variant="body2" color="text.secondary">Batch {row.batchNumber || '—'} · {row.expiryDate} · {row.locationCode}</Typography>
                </Box>
                <Box sx={{ textAlign: 'right', flexShrink: 0 }}>
                  <Typography fontWeight={800} color={row.status === 'EXPIRED' ? 'error.main' : 'warning.main'}>{row.status === 'EXPIRED' ? 'Expired' : `${row.daysLeft} days`}</Typography>
                  <Typography variant="caption" color="text.secondary">Qty {Number(row.onHandQty)}</Typography>
                </Box>
                <Button size="small" variant="outlined" onClick={() => { setCloseDraft({ itemId: row.itemId, locationId: row.locationId, batchNumber: row.batchNumber, expiryDate: row.expiryDate, itemName: row.itemName, category: row.category }); setRemarks(''); setCloseScope('BATCH'); }}>Close</Button>
              </Stack>
            </Box>)}
            {(expiry?.items.length ?? 0) > 5 && <Button fullWidth size="small" sx={{ mt: 1.5 }} onClick={() => setShowExpiryAll(v => !v)}>{showExpiryAll ? 'Show less' : `Show all ${expiry?.items.length}`}</Button>}
            {(expiry?.closedCount ?? 0) > 0 && <><Divider sx={{ my: 1.5 }} /><Button fullWidth size="small" onClick={() => setShowClosed(v => !v)}>{showClosed ? 'Hide closed alerts' : `Show closed alerts (${expiry?.closedCount})`}</Button>{showClosed && (expiry?.closedItems ?? []).map((row, i) => <Box key={row.closureId} sx={{ mt: 1.25 }}><Typography fontWeight={600}>{row.itemName} · Batch {row.batchNumber || '—'}</Typography><Typography variant="caption" color="text.secondary">{row.expiryDate} · {row.locationCode} · {row.remarks}</Typography></Box>)}</>}
          </CardContent>
        </Card>
      </Grid>
    </Grid>

    <Dialog open={manageOpen} onClose={() => setManageOpen(false)} fullWidth maxWidth="sm">
      <DialogTitle>Configure OT Fixed Stock</DialogTitle>
      <DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
        {saveTarget.isError && <Alert severity="error">{(saveTarget.error as Error).message || 'Could not save fixed quantity.'}</Alert>}
        {itemsQuery.isError || locationsQuery.isError ? <Alert severity="warning">You do not have permission to manage fixed stock, or the master data could not be loaded.</Alert> : null}
        <TextField select label="Item" value={itemId} onChange={e => setItemId(e.target.value)} fullWidth>
          {itemOptions.map(x => <MenuItem key={x.itemId} value={x.itemId}>{x.itemCode} · {x.itemName}</MenuItem>)}
        </TextField>
        <TextField select label="OT Store Location" value={locationId} onChange={e => setLocationId(e.target.value)} fullWidth>
          {(locationsQuery.data ?? []).map(x => <MenuItem key={x.locationId} value={x.locationId}>{x.locationName} ({x.locationCode})</MenuItem>)}
        </TextField>
        <TextField label="Fixed Quantity" type="number" name="ot-fixed-stock-quantity" autoComplete="off" value={fixedQty} onChange={e => setFixedQty(e.target.value)} inputProps={{ min: 0, step: '0.001', autoComplete: 'off' }} fullWidth />
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setManageOpen(false)}>Cancel</Button><Button variant="contained" disabled={!itemId || !locationId || fixedQty === '' || Number(fixedQty) < 0 || saveTarget.isPending} onClick={() => saveTarget.mutate({ itemId, locationId, fixedQty: Number(fixedQty) })}>Save</Button></DialogActions>
    </Dialog>
    <Dialog open={Boolean(closeDraft)} onClose={() => setCloseDraft(null)} fullWidth maxWidth="sm">
      <DialogTitle>Close Expiry Alert</DialogTitle>
      <DialogContent><Stack spacing={1.5} sx={{ pt: 1 }}>
        <Typography variant="body2">{closeDraft?.itemName} · Batch {closeDraft?.batchNumber || '—'}</Typography>
        <TextField select label="Close scope" value={closeScope} onChange={e => setCloseScope(e.target.value as 'BATCH' | 'CATEGORY')}><MenuItem value="BATCH">This batch only</MenuItem><MenuItem value="CATEGORY">Whole category ({closeDraft?.category})</MenuItem></TextField>
        <TextField label="Remark (required)" multiline minRows={3} value={remarks} onChange={e => setRemarks(e.target.value)} placeholder="Explain why this batch is still usable or why the alert is being closed." />
        {closeAlert.isError && <Alert severity="error">{(closeAlert.error as Error).message || 'Could not close alert.'}</Alert>}
      </Stack></DialogContent>
      <DialogActions><Button onClick={() => setCloseDraft(null)}>Cancel</Button><Button variant="contained" disabled={remarks.trim().length < 3 || closeAlert.isPending || !closeDraft} onClick={() => closeDraft && closeAlert.mutate({ itemId: closeDraft.itemId, locationId: closeDraft.locationId, batchNumber: closeDraft.batchNumber, expiryDate: closeDraft.expiryDate, scope: closeScope, remarks: remarks.trim() })}>Confirm Close</Button></DialogActions>
    </Dialog>
  </Box>;
}
