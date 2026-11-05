import { useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, CircularProgress, MenuItem, Stack, TextField, Typography } from '@mui/material';
import { useNavigate } from 'react-router-dom';
import { stockApi, type StockItem } from '@/api/stock.api';
import { getErrorMessage } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';

const today = () => new Date().toISOString().slice(0, 10);

export function MobileReceiveStockPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const { hasPermission } = useAuth();
  const itemsQ = useQuery({ queryKey: ['mobile-stock-items'], queryFn: () => stockApi.items() });
  const locationsQ = useQuery({ queryKey: ['mobile-stock-locations'], queryFn: stockApi.locations });
  const [itemId, setItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [unitCost, setUnitCost] = useState('0');
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [batchNumber, setBatchNumber] = useState('');
  const [expiryDate, setExpiryDate] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');
  const items = itemsQ.data || [];
  const selected = useMemo(() => items.find((item: StockItem) => item.itemId === itemId), [items, itemId]);
  const mutation = useMutation({
    mutationFn: () => stockApi.createReceipt({
      receiptId: crypto.randomUUID(), locationId: effectiveLocationId, invoiceNumber: invoiceNumber.trim(), invoiceDate: today(),
      lines: [{ itemId, quantity: Number(quantity), unitCost: Number(unitCost), batchNumber: batchNumber.trim() || undefined, expiryDate: expiryDate || null, serialNumber: serialNumber.trim() || undefined }],
    }),
    onSuccess: () => {
      setError(''); setMessage('Stock received successfully. Ledger balance has been updated.');
      setInvoiceNumber(''); setBatchNumber(''); setExpiryDate(''); setSerialNumber(''); setQuantity('1');
      void qc.invalidateQueries({ queryKey: ['mobile-stock-balances'] });
      void qc.invalidateQueries({ queryKey: ['stock'] });
    },
    onError: (e) => { setMessage(''); setError(getErrorMessage(e)); },
  });

  if (!hasPermission('RECEIVE_STOCK')) return <Box sx={{ maxWidth: 600, mx: 'auto', p: 2 }}><Alert severity="warning">Your account has mobile view access, but stock receiving permission has not been granted. Ask an administrator to enable RECEIVE_STOCK.</Alert><Button sx={{ mt: 2 }} onClick={() => navigate('/mobile/ot-store')}>Back to Available Stock</Button></Box>;
  const loadError = itemsQ.error || locationsQ.error;
  const loading = itemsQ.isLoading || locationsQ.isLoading;
  const effectiveLocationId = locationId || locationsQ.data?.[0]?.locationId || '';
  const valid = !!itemId && !!effectiveLocationId && Number(quantity) > 0 && Number(unitCost) >= 0 && (!selected?.trackBatch || !!batchNumber.trim()) && (!selected?.trackExpiry || !!expiryDate) && (!selected?.trackSerial || !!serialNumber.trim());

  return <Box component="form" autoComplete="off" onSubmit={(e) => { e.preventDefault(); if (valid) mutation.mutate(); }} sx={{ maxWidth: 680, mx: 'auto', p: 2, pb: 5 }}>
    <Stack direction="row" justifyContent="space-between" alignItems="center" sx={{ mb: 2 }}><Typography variant="h5" fontWeight={800}>Receive Stock</Typography><Button onClick={() => navigate('/mobile/ot-store')}>Back</Button></Stack>
    <Typography color="text.secondary" sx={{ mb: 2 }}>Record stock received into the OT Store. This creates an immutable receipt ledger entry.</Typography>
    {message && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setMessage('')}>{message}</Alert>}
    {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
    {loadError && <Alert severity="error" sx={{ mb: 2 }}>Unable to load item/location data: {getErrorMessage(loadError)}</Alert>}
    {loading ? <Box sx={{ display: 'flex', justifyContent: 'center', p: 4 }}><CircularProgress /></Box> : <Stack spacing={2}>
      <TextField select fullWidth required label="Item" value={itemId} onChange={(e) => { const id = e.target.value; setItemId(id); const item = items.find((x) => x.itemId === id); setUnitCost(String(item?.purchaseRate ?? item?.standardCost ?? 0)); setBatchNumber(''); setExpiryDate(''); setSerialNumber(''); }}>
        {items.map((item) => <MenuItem key={item.itemId} value={item.itemId} disabled={!item.uom?.trim()}>{item.itemCode} — {item.itemName} ({item.uom || 'UOM missing'})</MenuItem>)}
      </TextField>
      <TextField select fullWidth required label="OT Store Location" value={locationId || locationsQ.data?.[0]?.locationId || ''} onChange={(e) => setLocationId(e.target.value)}>
        {(locationsQ.data || []).map((location) => <MenuItem key={location.locationId} value={location.locationId}>{location.locationName} ({location.locationCode})</MenuItem>)}
      </TextField>
      <TextField fullWidth label="Invoice / Receipt Number" name="mobile-stock-reference" autoComplete="off" inputProps={{ autoComplete: 'off' }} value={invoiceNumber} onChange={(e) => setInvoiceNumber(e.target.value)} />
      <TextField fullWidth required type="number" label={`Quantity${selected?.uom ? ` (${selected.uom})` : ''}`} inputProps={{ min: 0.001, step: 'any' }} value={quantity} onChange={(e) => setQuantity(e.target.value)} />
      <TextField fullWidth required type="number" label="Unit Cost (₹)" inputProps={{ min: 0, step: '0.01' }} value={unitCost} onChange={(e) => setUnitCost(e.target.value)} />
      {selected?.trackBatch && <TextField fullWidth required label="Batch Number" value={batchNumber} onChange={(e) => setBatchNumber(e.target.value)} />}
      {selected?.trackExpiry && <TextField fullWidth required type="date" label="Expiry Date" InputLabelProps={{ shrink: true }} inputProps={{ min: today() }} value={expiryDate} onChange={(e) => setExpiryDate(e.target.value)} />}
      {selected?.trackSerial && <TextField fullWidth required label="Serial Number" value={serialNumber} onChange={(e) => setSerialNumber(e.target.value)} />}
      <Button fullWidth size="large" type="submit" variant="contained" disabled={!valid || mutation.isPending || loading}>{mutation.isPending ? 'Saving…' : 'Save Stock Receipt'}</Button>
    </Stack>}
  </Box>;
}
