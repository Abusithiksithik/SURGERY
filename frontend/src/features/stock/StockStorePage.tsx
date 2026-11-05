import { useCallback, useEffect, useMemo, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useAuth } from '@/auth/AuthContext';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle,
  Grid, IconButton, MenuItem, Paper, Stack, Tab, Table, TableBody, TableCell, TableContainer,
  TableHead, TableRow, Tabs, TextField, Typography,
} from '@mui/material';
import { Add, DeleteOutline, Inventory2Outlined, LocalShippingOutlined, QrCodeScanner, Refresh } from '@mui/icons-material';
import { PageHeader } from '@/components/common/PageHeader';
import { getErrorMessage } from '@/api/client';
import { stockApi, type StockItem, type StockReceiptLineInput } from '@/api/stock.api';
import { BarcodeScannerDialog } from './components/BarcodeScannerDialog';

const today = () => new Date().toISOString().slice(0, 10);
type DraftLine = StockReceiptLineInput & { key: string };
const blankLine = (): DraftLine => ({ key: crypto.randomUUID(), itemId: '', quantity: 1, unitCost: 0, batchNumber: '', expiryDate: '', serialNumber: '' });
const money = (value: unknown) => `₹${Number(value || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const dateText = (value?: string | null) => value ? new Date(value).toLocaleDateString('en-IN') : '—';

export function StockStorePage() {
  const navigate = useNavigate();
  const { hasPermission } = useAuth();
  const [tab, setTab] = useState(0);
  const [receiptOpen, setReceiptOpen] = useState(false);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [scannerTarget, setScannerTarget] = useState<'receipt' | 'count'>('receipt');
  const [search, setSearch] = useState('');
  const [itemSearch, setItemSearch] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [invoiceDate, setInvoiceDate] = useState(today());
  const [vendorId, setVendorId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [notes, setNotes] = useState('');
  const [countItemId, setCountItemId] = useState('');
  const [countLocationId, setCountLocationId] = useState('');
  const [countQty, setCountQty] = useState('0');
  const [countBatch, setCountBatch] = useState('');
  const [countExpiry, setCountExpiry] = useState('');
  const [countSerial, setCountSerial] = useState('');
  const [countReason, setCountReason] = useState('');
  const [lines, setLines] = useState<DraftLine[]>([blankLine()]);
  const qc = useQueryClient();

  const locationsQ = useQuery({ queryKey: ['stock', 'locations'], queryFn: stockApi.locations });
  const itemsQ = useQuery({ queryKey: ['stock', 'items'], queryFn: () => stockApi.items() });
  const receiptsQ = useQuery({ queryKey: ['stock', 'receipts'], queryFn: () => stockApi.receipts({ page: 1, limit: 100 }) });
  const balancesQ = useQuery({ queryKey: ['stock', 'balances'], queryFn: () => stockApi.balances({ page: 1, limit: 200 }) });
  const vendorsQ = useQuery({
    queryKey: ['stock', 'vendors'],
    queryFn: async () => { const r = await (await import('@/api/client')).apiClient.get('/masters/vendors', { params: { active: true, limit: 500 } }); return (r.data.data || []) as Array<{ vendorId: string; name: string; isActive?: boolean }>; },
  });
  const countMutation = useMutation({
    mutationFn: stockApi.recordPhysicalCount,
    onSuccess: (result) => { setSuccess(result.noChange ? 'Physical count matches the ledger balance. No adjustment was needed.' : `Physical count saved for ${result.itemName}. Stock balance updated.`); setError(''); setCountReason(''); qc.invalidateQueries({ queryKey: ['stock'] }); },
    onError: (e) => { setError(getErrorMessage(e)); setSuccess(''); },
  });
  const receiptMutation = useMutation({
    mutationFn: stockApi.createReceipt,
    onSuccess: () => {
      setSuccess('Stock receipt saved. Stock ledger and balance have been updated.'); setError('');
      setReceiptOpen(false); resetForm(); setItemSearch('');
      qc.invalidateQueries({ queryKey: ['stock'] });
    },
    onError: (e) => { setError(getErrorMessage(e)); setSuccess(''); },
  });
  const resetForm = () => { setInvoiceNumber(''); setInvoiceDate(today()); setVendorId(''); setLocationId(locationsQ.data?.[0]?.locationId || ''); setNotes(''); setLines([blankLine()]); };
  const itemById = useMemo(() => new Map((itemsQ.data || []).map((item) => [item.itemId, item])), [itemsQ.data]);
  useEffect(() => { if (!locationId && locationsQ.data?.[0]) setLocationId(locationsQ.data[0].locationId); }, [locationId, locationsQ.data]);
  const selectableItems = (itemsQ.data || []).filter((item) => `${item.itemCode} ${item.itemName}`.toLowerCase().includes(itemSearch.toLowerCase()));
  const handleCountScan = useCallback((raw: string) => {
    let code = raw.trim();
    try { const parsed = JSON.parse(code) as Record<string, unknown>; code = String(parsed.itemCode ?? parsed.item_code ?? parsed.code ?? code); } catch { /* Plain barcode / QR payload. */ }
    try { const url = new URL(code); code = url.searchParams.get('itemCode') || url.searchParams.get('code') || code; } catch { /* Not a URL. */ }
    const found = (itemsQ.data || []).find((item) => item.itemCode.toLowerCase() === code.toLowerCase());
    if (!found) { setError(`No Item Master item matches scanned code: ${code}.`); return; }
    setCountItemId(found.itemId); setCountBatch(''); setCountExpiry(''); setCountSerial(''); setError('');
    setSuccess(`Scanned ${found.itemCode} — ${found.itemName}. Enter the counted quantity and required batch/serial details.`);
  }, [itemsQ.data]);
  const receiptTotal = lines.reduce((sum, line) => sum + Number(line.quantity || 0) * Number(line.unitCost || 0), 0);
  const filteredBalances = (balancesQ.data || []).filter((row) => `${row.itemCode} ${row.itemName} ${row.batchNumber || ''}`.toLowerCase().includes(search.toLowerCase()));
  const filteredReceipts = (receiptsQ.data || []).filter((row) => `${row.invoiceNumber || ''} ${row.receiptNumber || ''} ${row.vendorName || ''}`.toLowerCase().includes(search.toLowerCase()));

  const openReceipt = () => {
    setError(''); setSuccess('');
    if (!locationId && locationsQ.data?.[0]) setLocationId(locationsQ.data[0].locationId);
    setReceiptOpen(true);
  };
  const updateLine = (key: string, patch: Partial<DraftLine>) => setLines((prev) => prev.map((line) => line.key === key ? { ...line, ...patch } : line));
  const handleReceiptScan = useCallback((raw: string) => {
    let code = raw.trim();
    try { const parsed = JSON.parse(code) as Record<string, unknown>; code = String(parsed.itemCode ?? parsed.item_code ?? parsed.code ?? code); } catch { /* Plain barcode or QR payload. */ }
    try { const url = new URL(code); code = url.searchParams.get('itemCode') || url.searchParams.get('code') || code; } catch { /* Not a URL. */ }
    const found = (itemsQ.data || []).find((item) => item.itemCode.toLowerCase() === code.toLowerCase());
    if (!found) { setError(`No Item Master item matches scanned code: ${code}. Use the exact Item Code or add a matching item first.`); setSuccess(''); return; }
    if (!found.uom?.trim()) { setError(`${found.itemName} has no Base UOM. Update Item Master before receiving stock.`); return; }
    setLines((prev) => { const empty = prev.find((line) => !line.itemId); if (empty) return prev.map((line) => line.key === empty.key ? { ...line, itemId: found.itemId, unitCost: Number(found.purchaseRate ?? found.standardCost ?? 0) } : line); return [...prev, { ...blankLine(), itemId: found.itemId, unitCost: Number(found.purchaseRate ?? found.standardCost ?? 0) }]; });
    setItemSearch(''); setError(''); setSuccess(`Scanned ${found.itemCode} — ${found.itemName}.`);
  }, [itemsQ.data]);
  const submitReceipt = () => {
    setError('');
    if (!locationId) return setError('No active stock location is available. Confirm the OT_STORE location was created by migration 27.');
    if (!lines.length || lines.some((line) => !line.itemId || Number(line.quantity) <= 0 || Number(line.unitCost) < 0)) return setError('Select an item and enter a valid positive quantity and non-negative unit cost for every line.');
    const payloadLines = lines.map((line) => {
      const item = itemById.get(line.itemId);
      if (!item) throw new Error('Selected item is no longer available. Refresh the page.');
      if (item.trackBatch && !line.batchNumber?.trim()) throw new Error(`Batch number is required for ${item.itemName}.`);
      if (item.trackExpiry && !line.expiryDate) throw new Error(`Expiry date is required for ${item.itemName}.`);
      if (item.trackSerial && !line.serialNumber?.trim()) throw new Error(`Serial number is required for ${item.itemName}.`);
      if (item.trackSerial && Number(line.quantity) !== 1) throw new Error(`${item.itemName} is serial-tracked; enter one unit per line.`);
      return { itemId: line.itemId, quantity: Number(line.quantity), unitCost: Number(line.unitCost), batchNumber: line.batchNumber || undefined, expiryDate: line.expiryDate || null, serialNumber: line.serialNumber || undefined };
    });
    receiptMutation.mutate({ receiptId: crypto.randomUUID(), locationId, vendorId: vendorId || null, invoiceNumber: invoiceNumber.trim() || undefined, invoiceDate: invoiceDate || null, notes: notes.trim() || undefined, lines: payloadLines });
  };

  return <Box>
    <PageHeader title="OT Store" subtitle="Receive stock, review receipts and monitor on-hand inventory." />
    {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
    {error && !receiptOpen && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
    <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={2} sx={{ mb: 2 }}>
      <Tabs value={tab} onChange={(_, value) => { setTab(value); setSearch(''); }} variant="scrollable" scrollButtons="auto">
        <Tab label="Stock Dashboard" /><Tab label="Receive Stock" /><Tab label="Receipt History" /><Tab label="Stock On Hand" /><Tab label="Physical Count" />
      </Tabs>
      <Button variant="contained" startIcon={<Add />} onClick={openReceipt}>Receive Stock</Button>
    </Stack>

    {tab === 0 && <Grid container spacing={2}>
      <Grid item xs={12} sm={4}><Paper sx={{ p: 2.5 }}><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Stock Lines</Typography><Inventory2Outlined color="primary" /></Stack><Typography variant="h4" sx={{ mt: 1 }}>{balancesQ.data?.length ?? '—'}</Typography></Paper></Grid>
      <Grid item xs={12} sm={4}><Paper sx={{ p: 2.5 }}><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Units On Hand</Typography><Inventory2Outlined color="primary" /></Stack><Typography variant="h4" sx={{ mt: 1 }}>{balancesQ.data ? balancesQ.data.reduce((sum, row) => sum + Number(row.onHandQty || 0), 0).toLocaleString('en-IN') : '—'}</Typography></Paper></Grid>
      <Grid item xs={12} sm={4}><Paper sx={{ p: 2.5 }}><Stack direction="row" justifyContent="space-between"><Typography color="text.secondary">Receipts Recorded</Typography><LocalShippingOutlined color="primary" /></Stack><Typography variant="h4" sx={{ mt: 1 }}>{receiptsQ.data?.length ?? '—'}</Typography></Paper></Grid>
      <Grid item xs={12}><Paper sx={{ p: 2.5 }}><Typography variant="h6" sx={{ mb: 1 }}>Recent Receipts</Typography><ReceiptTable rows={(receiptsQ.data || []).slice(0, 8)} loading={receiptsQ.isLoading} /></Paper></Grid>
    </Grid>}

    {tab === 1 && <Paper sx={{ p: 2.5 }}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}><Box><Typography variant="h6">Receive New Stock</Typography><Typography color="text.secondary" variant="body2">Receipt and stock ledger entries are saved together.</Typography></Box><Button startIcon={<Refresh />} onClick={() => { void qc.invalidateQueries({ queryKey: ['stock'] }); }}>Refresh data</Button></Stack><Alert severity="info" sx={{ mb: 2 }}>Items are loaded from the existing Item Master. Batch, expiry and serial fields are required according to each item's tracking settings.</Alert><Button variant="contained" startIcon={<Add />} onClick={openReceipt}>Create Stock Receipt</Button></Paper>}

    {tab === 2 && <Paper sx={{ p: 2.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" sx={{ mb: 2 }}><Typography variant="h6">Receipt History</Typography><TextField size="small" label="Search invoice / supplier" value={search} onChange={(e) => setSearch(e.target.value)} /></Stack><ReceiptTable rows={filteredReceipts} loading={receiptsQ.isLoading} /></Paper>}

    {tab === 3 && <Paper sx={{ p: 2.5 }}><Stack direction={{ xs: 'column', sm: 'row' }} spacing={2} justifyContent="space-between" sx={{ mb: 2 }}><Typography variant="h6">Stock On Hand</Typography><TextField size="small" label="Search item / batch" value={search} onChange={(e) => setSearch(e.target.value)} /></Stack>{balancesQ.isLoading ? <CircularProgress /> : balancesQ.error ? <Alert severity="error">{getErrorMessage(balancesQ.error)}</Alert> : <TableContainer><Table size="small"><TableHead><TableRow>{['Item Code','Item','Location','Batch','Expiry','On Hand','Unit'].map((h) => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>{filteredBalances.map((row, index) => <TableRow key={`${row.itemId}-${row.locationId}-${row.batchNumber}-${index}`}><TableCell>{row.itemCode}</TableCell><TableCell>{row.itemName}</TableCell><TableCell>{row.locationCode}</TableCell><TableCell>{row.batchNumber || '—'}</TableCell><TableCell>{dateText(row.expiryDate)}</TableCell><TableCell><Chip size="small" color={Number(row.onHandQty) > 0 ? 'success' : 'default'} label={Number(row.onHandQty).toLocaleString('en-IN')} /></TableCell><TableCell>{row.uom}</TableCell></TableRow>)}{!filteredBalances.length && <TableRow><TableCell colSpan={7} align="center">No stock balances found.</TableCell></TableRow>}</TableBody></Table></TableContainer>}</Paper>}

    {tab === 4 && <Paper sx={{ p: 2.5 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Physical Stock Count</Typography>
      <Alert severity="warning" sx={{ mb: 2 }}>Submitting a count posts an approved, immutable adjustment to the stock ledger. Use a test location/item first. Only users with APPROVE_STOCK_ADJUSTMENT can submit.</Alert>
      {!hasPermission('APPROVE_STOCK_ADJUSTMENT') ? <Alert severity="info">You do not have permission to approve stock adjustments. Ask an administrator to grant APPROVE_STOCK_ADJUSTMENT.</Alert> : <Grid container spacing={2}>
        <Grid item xs={12} md={4}><Stack direction="row" spacing={1}><TextField select fullWidth label="Item" value={countItemId} onChange={(e) => { setCountItemId(e.target.value); setCountBatch(''); setCountExpiry(''); setCountSerial(''); }}>{(itemsQ.data || []).map((it) => <MenuItem key={it.itemId} value={it.itemId}>{it.itemCode} — {it.itemName} ({it.uom || 'UOM missing'})</MenuItem>)}</TextField><Button variant="outlined" startIcon={<QrCodeScanner />} onClick={() => { setScannerTarget('count'); setScannerOpen(true); }}>Scan</Button></Stack></Grid>
        <Grid item xs={12} md={4}><TextField select fullWidth label="Location" value={countLocationId || locationId} onChange={(e) => setCountLocationId(e.target.value)}>{(locationsQ.data || []).map((l) => <MenuItem key={l.locationId} value={l.locationId}>{l.locationName}</MenuItem>)}</TextField></Grid>
        <Grid item xs={12} md={4}><TextField fullWidth type="number" label="Physically Counted Quantity" inputProps={{ min: 0, step: '0.001' }} value={countQty} onChange={(e) => setCountQty(e.target.value)} /></Grid>
        {itemById.get(countItemId)?.trackBatch && <Grid item xs={12} md={4}><TextField required fullWidth label="Batch Number" value={countBatch} onChange={(e) => setCountBatch(e.target.value)} /></Grid>}
        {itemById.get(countItemId)?.trackExpiry && <Grid item xs={12} md={4}><TextField required fullWidth type="date" label="Expiry Date" InputLabelProps={{ shrink: true }} value={countExpiry} onChange={(e) => setCountExpiry(e.target.value)} /></Grid>}
        {itemById.get(countItemId)?.trackSerial && <Grid item xs={12} md={4}><TextField required fullWidth label="Serial Number" value={countSerial} onChange={(e) => setCountSerial(e.target.value)} /></Grid>}
        <Grid item xs={12}><Alert severity="info">Current ledger balance: {(balancesQ.data || []).filter((row) => row.itemId === countItemId && row.locationId === (countLocationId || locationId) && (row.batchNumber || '') === countBatch && (row.expiryDate || '') === countExpiry).reduce((sum, row) => sum + Number(row.onHandQty || 0), 0).toLocaleString('en-IN')} {itemById.get(countItemId)?.uom || ''}. Enter the physical quantity counted for this item/location/batch.</Alert></Grid>
        <Grid item xs={12}><TextField required fullWidth multiline minRows={2} label="Reason for count difference / cut-over" value={countReason} onChange={(e) => setCountReason(e.target.value)} /></Grid>
        <Grid item xs={12}><Button variant="contained" disabled={countMutation.isPending || !countItemId || !(countLocationId || locationId) || countQty === '' || Number(countQty) < 0 || countReason.trim().length < 5 || (!!itemById.get(countItemId)?.trackBatch && !countBatch.trim()) || (!!itemById.get(countItemId)?.trackExpiry && !countExpiry) || (!!itemById.get(countItemId)?.trackSerial && !countSerial.trim())} onClick={() => countMutation.mutate({ idempotencyKey: crypto.randomUUID(), itemId: countItemId, locationId: countLocationId || locationId, countedQuantity: Number(countQty), batchNumber: countBatch || undefined, expiryDate: countExpiry || null, serialNumber: countSerial || undefined, reason: countReason.trim() })}>{countMutation.isPending ? 'Saving…' : 'Submit Physical Count'}</Button></Grid>
      </Grid>}
    </Paper>}

    <BarcodeScannerDialog open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={scannerTarget === 'receipt' ? handleReceiptScan : handleCountScan} />
    <Dialog open={receiptOpen} onClose={() => !receiptMutation.isPending && setReceiptOpen(false)} fullWidth maxWidth="lg">
      <DialogTitle>Receive Stock</DialogTitle><DialogContent dividers>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        {(locationsQ.error || itemsQ.error || vendorsQ.error) && <Alert severity="error" sx={{ mb: 2 }}>Unable to load master data: {getErrorMessage(locationsQ.error || itemsQ.error || vendorsQ.error)}</Alert>}
        {(locationsQ.isLoading || itemsQ.isLoading || vendorsQ.isLoading) ? <CircularProgress /> : <>
          <Grid container spacing={2} sx={{ mb: 2 }}>
            <Grid item xs={12} sm={6} md={3}><TextField select fullWidth label="OT Store Location" value={locationId || locationsQ.data?.[0]?.locationId || ''} onChange={(e) => setLocationId(e.target.value)}>{(locationsQ.data || []).map((l) => <MenuItem key={l.locationId} value={l.locationId}>{l.locationName} ({l.locationCode})</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} sm={6} md={3}><TextField select fullWidth label="Supplier" value={vendorId} onChange={(e) => setVendorId(e.target.value)}><MenuItem value="">Not specified</MenuItem>{(vendorsQ.data || []).map((v) => <MenuItem key={v.vendorId} value={v.vendorId}>{v.name}</MenuItem>)}</TextField></Grid>
            <Grid item xs={12} sm={6} md={3}><TextField fullWidth label="Invoice Number" name="ot-store-invoice-reference" autoComplete="new-password" value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} /></Grid>
            <Grid item xs={12} sm={6} md={3}><TextField fullWidth type="date" label="Invoice Date" InputLabelProps={{ shrink: true }} value={invoiceDate} onChange={(e) => setInvoiceDate(e.target.value)} /></Grid>
            <Grid item xs={12}><TextField fullWidth multiline minRows={2} label="Notes" name="ot-store-receipt-notes" autoComplete="off" value={notes} onChange={(e) => setNotes(e.target.value)} /></Grid>
          </Grid>
          <Stack direction={{ xs: 'column', sm: 'row' }} justifyContent="space-between" alignItems={{ sm: 'center' }} spacing={1} sx={{ mb: 1 }}><Typography variant="h6">Items</Typography><Stack direction="row" spacing={1}><TextField size="small" label="Search Item Master" name="ot-store-item-search" autoComplete="off" value={itemSearch} onChange={(e) => setItemSearch(e.target.value)} /><Button startIcon={<QrCodeScanner />} onClick={() => { setScannerTarget('receipt'); setScannerOpen(true); }}>Scan</Button><Button startIcon={<Add />} onClick={() => setLines((prev) => [...prev, blankLine()])}>Add Line</Button>{hasPermission('EDIT_MASTERS') && <Button size="small" onClick={() => navigate('/admin/config')}>Manage Item Master</Button>}</Stack></Stack>
          {lines.map((line, index) => {
            const item = itemById.get(line.itemId) as StockItem | undefined;
            return <Paper variant="outlined" sx={{ p: 2, mb: 1.5 }} key={line.key}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 1 }}><Typography fontWeight={700}>Item {index + 1}</Typography><IconButton color="error" disabled={lines.length === 1} onClick={() => setLines((prev) => prev.filter((x) => x.key !== line.key))}><DeleteOutline /></IconButton></Stack><Grid container spacing={1.5}>
              <Grid item xs={12} md={4}><TextField select fullWidth label="Item" value={line.itemId} onChange={(e) => { const chosen = itemById.get(e.target.value); updateLine(line.key, { itemId: e.target.value, unitCost: Number(chosen?.purchaseRate ?? chosen?.standardCost ?? 0) }); }}>{selectableItems.map((it) => <MenuItem key={it.itemId} value={it.itemId} disabled={!it.uom?.trim()}>{it.itemCode} — {it.itemName}{it.uom ? ` (${it.uom})` : ' — UOM missing; update Item Master'}</MenuItem>)}</TextField></Grid>
              <Grid item xs={6} md={2}><TextField fullWidth type="number" label={`Quantity${item?.uom ? ` (${item.uom})` : ''}`} inputProps={{ min: 0.001, step: 'any' }} value={line.quantity} onChange={(e) => updateLine(line.key, { quantity: Number(e.target.value) })} /></Grid>
              <Grid item xs={6} md={2}><TextField fullWidth type="number" label="Unit Cost (₹)" inputProps={{ min: 0, step: '0.01' }} value={line.unitCost} onChange={(e) => updateLine(line.key, { unitCost: Number(e.target.value) })} /></Grid>
              {item?.trackBatch && <Grid item xs={6} md={2}><TextField fullWidth required label="Batch Number" value={line.batchNumber || ''} onChange={(e) => updateLine(line.key, { batchNumber: e.target.value })} /></Grid>}
              {item?.trackExpiry && <Grid item xs={6} md={2}><TextField fullWidth required type="date" label="Expiry Date" InputLabelProps={{ shrink: true }} inputProps={{ min: today() }} value={line.expiryDate || ''} onChange={(e) => updateLine(line.key, { expiryDate: e.target.value })} /></Grid>}
              {item?.trackSerial && <Grid item xs={12} md={3}><TextField fullWidth required label="Serial Number" value={line.serialNumber || ''} onChange={(e) => updateLine(line.key, { serialNumber: e.target.value })} /></Grid>}
              <Grid item xs={12}><Typography variant="body2" color="text.secondary">Line total: {money(Number(line.quantity) * Number(line.unitCost))}{item && ` • Base unit: ${item.uom || 'not configured'}`}</Typography></Grid>
            </Grid></Paper>;
          })}
          <Stack direction="row" justifyContent="flex-end" sx={{ mt: 2 }}><Typography variant="h6">Receipt Total: {money(receiptTotal)}</Typography></Stack>
        </>}
      </DialogContent><DialogActions><Button onClick={() => setReceiptOpen(false)} disabled={receiptMutation.isPending}>Cancel</Button><Button variant="contained" onClick={submitReceipt} disabled={receiptMutation.isPending || locationsQ.isLoading || itemsQ.isLoading || !itemsQ.data?.some((item) => !!item.uom?.trim())}>{receiptMutation.isPending ? 'Saving…' : 'Save Receipt'}</Button></DialogActions>
    </Dialog>
  </Box>;
}

function ReceiptTable({ rows, loading }: { rows: Array<import('@/api/stock.api').StockReceipt>; loading: boolean }) {
  if (loading) return <Box sx={{ py: 3, textAlign: 'center' }}><CircularProgress size={26} /></Box>;
  return <TableContainer><Table size="small"><TableHead><TableRow>{['Received','Invoice / Receipt','Supplier','Location','Lines','Total','Received By'].map((h) => <TableCell key={h}>{h}</TableCell>)}</TableRow></TableHead><TableBody>{rows.map((r) => <TableRow key={r.receiptId}><TableCell>{dateText(r.receivedAt)}</TableCell><TableCell>{r.invoiceNumber || r.receiptNumber || r.receiptId.slice(0, 8)}</TableCell><TableCell>{r.vendorName || '—'}</TableCell><TableCell>{r.locationCode || '—'}</TableCell><TableCell>{r.lineCount ?? r.lines?.length ?? '—'}</TableCell><TableCell>{money(r.receiptTotal)}</TableCell><TableCell>{r.receivedByName || '—'}</TableCell></TableRow>)}{!rows.length && <TableRow><TableCell colSpan={7} align="center">No receipts found.</TableCell></TableRow>}</TableBody></Table></TableContainer>;
}
