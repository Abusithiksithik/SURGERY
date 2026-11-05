import { useCallback, useMemo, useState } from 'react';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { Alert, Box, Button, Chip, CircularProgress, Dialog, DialogActions, DialogContent, DialogTitle, Grid, MenuItem, Paper, Stack, Table, TableBody, TableCell, TableHead, TableRow, TextField, Typography } from '@mui/material';
import { Add, LocalPharmacy, QrCodeScanner, Refresh, Search } from '@mui/icons-material';
import { PageHeader } from '@/components/common/PageHeader';
import { getErrorMessage } from '@/api/client';
import { stockApi } from '@/api/stock.api';
import { stockUsageApi, type UsageCase, type UsageLine } from '@/api/stockUsage.api';
import { useAuth } from '@/auth/AuthContext';
import { BarcodeScannerDialog } from './components/BarcodeScannerDialog';

const money = (n: number) => `₹${Number(n || 0).toLocaleString('en-IN', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const date = (s?: string | null) => s ? new Date(s).toLocaleDateString('en-IN') : '—';
const qty = (value: number | string) => Number(value || 0).toLocaleString('en-IN', { maximumFractionDigits: 3 });
const caseIsClosed = (status?: string) => ['CLOSED', 'CANCELLED', 'DELETED'].includes(String(status || '').toUpperCase());

export function CaseConsumptionPage() {
  const { hasPermission } = useAuth();
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const [selected, setSelected] = useState<UsageCase | null>(null);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [dialog, setDialog] = useState<'issue'|'return'|'wastage'|null>(null);
  const [scannerOpen, setScannerOpen] = useState(false);
  const [activeLine, setActiveLine] = useState<UsageLine | null>(null);
  const [itemId, setItemId] = useState('');
  const [locationId, setLocationId] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [batch, setBatch] = useState('');
  const [expiry, setExpiry] = useState('');
  const [serial, setSerial] = useState('');
  const [notes, setNotes] = useState('');
  const [busyId, setBusyId] = useState('');

  const casesQ = useQuery({ queryKey: ['stock-usage','cases',search], queryFn: () => stockUsageApi.findCases(search.trim()), enabled: search.trim().length >= 2 });
  const detailQ = useQuery({ queryKey: ['stock-usage','case',selected?.surgeryId], queryFn: () => stockUsageApi.caseUsage(selected!.surgeryId), enabled: !!selected });
  const itemsQ = useQuery({ queryKey: ['stock','items'], queryFn: () => stockApi.items() });
  const locationsQ = useQuery({ queryKey: ['stock','locations'], queryFn: stockApi.locations });
  const issueM = useMutation({ mutationFn: stockUsageApi.issue, onSuccess: (result: any) => result?.queued ? queuedSuccess('Stock issue saved on this device. It will sync when the connection returns; server stock validation happens during sync.') : refresh('Stock issued to surgery successfully.'), onError: e => setError(getErrorMessage(e)) });
  const adjustM = useMutation({ mutationFn: async () => { if (!activeLine || !dialog) throw new Error('Select a usage line.'); return dialog === 'return' ? stockUsageApi.returnItem(activeLine.usageId, Number(quantity), notes) : stockUsageApi.wastage(activeLine.usageId, Number(quantity), notes); }, onSuccess: (result: any) => result?.queued ? queuedSuccess('Return / wastage saved on this device. It will sync when the connection returns; server quantity validation happens during sync.') : refresh(dialog === 'return' ? 'Stock return recorded.' : 'Wastage recorded.'), onError: e => setError(getErrorMessage(e)) });
  const handoverM = useMutation({ mutationFn: ({ id, note }: { id: string; note: string }) => stockUsageApi.handover(id, note), onSuccess: () => refresh('Usage handed over to pharmacy.'), onError: e => setError(getErrorMessage(e)) });
  function queuedSuccess(message: string) { setSuccess(message); setError(''); setDialog(null); setActiveLine(null); setNotes(''); setQuantity('1'); }
  function refresh(message: string) { setSuccess(message); setError(''); setDialog(null); setActiveLine(null); setNotes(''); setQuantity('1'); void qc.invalidateQueries({ queryKey: ['stock-usage'] }); void qc.invalidateQueries({ queryKey: ['stock'] }); }
  const selectedItem = useMemo(() => (itemsQ.data || []).find(i => i.itemId === itemId), [itemsQ.data,itemId]);
  const stockForItem = (detailQ.data?.availableStock || []).filter(s => s.itemId === itemId);
  const maxAdjust = activeLine ? Number(activeLine.quantityIssued)-Number(activeLine.quantityReturned)-Number(activeLine.quantityWasted) : 0;
  const canHandover = hasPermission('RECORD_PHARMACY_BILL');
  const handleIssueScan = useCallback((raw: string) => {
    let code = raw.trim();
    try { const parsed = JSON.parse(code) as Record<string, unknown>; code = String(parsed.itemCode ?? parsed.item_code ?? parsed.code ?? code); } catch { /* Plain barcode / QR payload. */ }
    try { const url = new URL(code); code = url.searchParams.get('itemCode') || url.searchParams.get('code') || code; } catch { /* Not a URL. */ }
    const found = (itemsQ.data || []).find(item => item.itemCode.toLowerCase() === code.toLowerCase());
    if (!found) { setError(`No Item Master item matches scanned code: ${code}. Scan an Item Code registered in Item Master.`); return; }
    const available = (detailQ.data?.availableStock || []).filter(stock => stock.itemId === found.itemId && Number(stock.onHandQty) > 0);
    if (!available.length) { setError(`${found.itemName} is not available in OT Store.`); return; }
    setItemId(found.itemId); setBatch(''); setExpiry(''); setSerial('');
    if (available.length === 1) { setLocationId(available[0].locationId); setBatch(available[0].batchNumber || ''); setExpiry(available[0].expiryDate?.slice(0,10) || ''); setSerial(available[0].serialNumber || ''); }
    setError(''); setSuccess(`Scanned ${found.itemCode} — ${found.itemName}. ${available.length > 1 ? 'Select the correct stock batch/location.' : 'Stock batch selected.'}`);
  }, [itemsQ.data, detailQ.data?.availableStock]);

  const submitIssue = () => {
    if (!selected || !selectedItem || !locationId || Number(quantity) <= 0) return setError('Select an item, location and valid quantity.');
    if (selectedItem.trackBatch && !batch.trim()) return setError('Batch number is required for this item.');
    if (selectedItem.trackExpiry && !expiry) return setError('Expiry date is required for this item.');
    if (selectedItem.trackSerial && (!serial.trim() || Number(quantity) !== 1)) return setError('Enter a serial number and issue one unit per line.');
    const matching = stockForItem.find(s => s.locationId === locationId && (s.batchNumber || '') === batch && (s.serialNumber || '') === serial);
    if (!matching) return setError('No matching available stock batch/serial found.');
    if (Number(quantity) > Number(matching.onHandQty)) return setError(`Only ${matching.onHandQty} ${matching.uom} available in the selected batch.`);
    issueM.mutate({ idempotencyKey: crypto.randomUUID(), surgeryId: selected.surgeryId, surgeryNumber: selected.surgeryNumber, itemId, locationId, quantity: Number(quantity), batchNumber: batch || null, expiryDate: expiry || null, serialNumber: serial || null, notes: notes || undefined });
  };

  return <Box>
    <PageHeader title="Surgery Case Consumption" subtitle="Issue OT Store stock to a surgery, record returns and wastage, and hand over billable usage to pharmacy." />
    {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
    {success && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSuccess('')}>{success}</Alert>}
    <Paper sx={{ p: 2.5, mb: 2 }}>
      <Typography variant="h6" sx={{ mb: 1 }}>Find Surgery Case</Typography>
      <TextField fullWidth name="case-lookup-reference" autoComplete="off" InputLabelProps={{ shrink: true }} inputProps={{ autoComplete: "off", spellCheck: false }} value={search} onChange={e => setSearch(e.target.value)} label="Search MR Number, Surgery Number or Patient Name" placeholder="Enter at least 2 characters" InputProps={{ endAdornment: <Search color="action" /> }} />
      {casesQ.isFetching && <CircularProgress size={22} sx={{ mt: 2 }} />}
      {casesQ.error && <Alert severity="error" sx={{ mt: 2 }}>{getErrorMessage(casesQ.error)}</Alert>}
      {!!casesQ.data?.length && <Table size="small" sx={{ mt: 2 }}><TableHead><TableRow>{['Surgery No.','Patient','MR Number','Procedure','Status','Action'].map(x=><TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead><TableBody>{casesQ.data.map(c=><TableRow key={c.surgeryId} selected={selected?.surgeryId===c.surgeryId}><TableCell>{c.surgeryNumber || '—'}</TableCell><TableCell>{c.patientName}</TableCell><TableCell>{c.mrNumber}</TableCell><TableCell>{c.surgeryName || '—'}</TableCell><TableCell><Chip size="small" label={c.status}/></TableCell><TableCell><Button size="small" variant={selected?.surgeryId===c.surgeryId?'contained':'outlined'} onClick={()=>{setSelected(c);setError('');setSuccess('');}}>Open Case</Button></TableCell></TableRow>)}</TableBody></Table>}
      {search.trim().length >= 2 && !casesQ.isFetching && !casesQ.data?.length && !casesQ.error && <Typography color="text.secondary" sx={{ mt: 2 }}>No matching surgery cases found.</Typography>}
    </Paper>
    {selected && <>
      {detailQ.isLoading ? <CircularProgress/> : detailQ.error ? <Alert severity="error">{getErrorMessage(detailQ.error)}</Alert> : detailQ.data && <>
        <Paper sx={{ p: 2.5, mb: 2 }}>
          <Stack direction={{xs:'column',sm:'row'}} justifyContent="space-between" spacing={2}><Box><Typography variant="h6">{detailQ.data.surgery.patientName}</Typography><Typography color="text.secondary">{detailQ.data.surgery.surgeryNumber || 'No surgery number'} · MR {detailQ.data.surgery.mrNumber} · {detailQ.data.surgery.surgeryName || 'Surgery'}</Typography><Typography variant="body2" color="text.secondary">Date: {date(detailQ.data.surgery.surgeryDate || detailQ.data.surgery.scheduledDate)} · Status: {detailQ.data.surgery.status}</Typography>{caseIsClosed(detailQ.data.surgery.status) && <Alert severity="warning" sx={{mt:1}}>This surgery is closed or cancelled. Stock issue, return and wastage actions are disabled.</Alert>}</Box><Stack direction="row" spacing={1} alignItems="center"><Chip color="primary" label={`Consumables Cost ${money(Number(detailQ.data.actualConsumablesCost))}`}/><Button startIcon={<Refresh/>} onClick={()=>void detailQ.refetch()}>Refresh</Button></Stack></Stack>
        </Paper>
        <Grid container spacing={2}>
          <Grid item xs={12} lg={7}><Paper sx={{p:2.5,height:'100%'}}><Stack direction="row" justifyContent="space-between" alignItems="center" sx={{mb:2}}><Typography variant="h6">Issued Items</Typography><Button variant="contained" disabled={caseIsClosed(detailQ.data.surgery.status)} title={caseIsClosed(detailQ.data.surgery.status) ? "Closed/cancelled cases cannot receive stock" : "Issue stock"} startIcon={<Add/>} onClick={()=>{setDialog('issue');setItemId('');setLocationId(locationsQ.data?.[0]?.locationId || '');setQuantity('1');setBatch('');setExpiry('');setSerial('');setNotes('');setError('');}}>Issue Stock</Button></Stack>
          {detailQ.data.usageLines.length===0 ? <Alert severity="info">No items have been issued to this surgery yet.</Alert> : <Table size="small"><TableHead><TableRow>{['Item','Issued','Returned','Wasted','Net Used','Cost','Actions'].map(x=><TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead><TableBody>{detailQ.data.usageLines.map(line=>{const net=Number(line.quantityIssued)-Number(line.quantityReturned)-Number(line.quantityWasted);return <TableRow key={line.usageId}><TableCell><b>{line.itemName}</b><Typography variant="caption" display="block" color="text.secondary">{line.itemCode} · {line.batchNumber || 'No batch'}</Typography></TableCell><TableCell>{qty(line.quantityIssued)} {line.uom}</TableCell><TableCell>{qty(line.quantityReturned)}</TableCell><TableCell>{qty(line.quantityWasted)}</TableCell><TableCell>{qty(net)}</TableCell><TableCell>{money(net*Number(line.unitCost))}</TableCell><TableCell><Stack direction="row" spacing={0.5} flexWrap="wrap"><Button size="small" disabled={net<=0 || !!line.handoverId} onClick={()=>{setActiveLine(line);setDialog('return');setQuantity('1');setNotes('');}}>Return</Button><Button size="small" color="warning" disabled={net<=0 || !!line.handoverId} onClick={()=>{setActiveLine(line);setDialog('wastage');setQuantity('1');setNotes('');}}>Wastage</Button>{canHandover && <Button size="small" startIcon={<LocalPharmacy/>} disabled={!!line.handoverId} onClick={()=>handoverM.mutate({id:line.usageId,note:''})}> {line.handoverId?'Handed Over':'Handover'}</Button>}</Stack></TableCell></TableRow>})}</TableBody></Table>}
          </Paper></Grid>
          <Grid item xs={12} lg={5}><Paper sx={{p:2.5,height:'100%'}}><Typography variant="h6" sx={{mb:2}}>Available OT Store Stock</Typography><Table size="small"><TableHead><TableRow>{['Item','Location','Batch / Expiry','Available'].map(x=><TableCell key={x}>{x}</TableCell>)}</TableRow></TableHead><TableBody>{detailQ.data.availableStock.map((s,i)=><TableRow key={`${s.itemId}-${s.locationId}-${s.batchNumber}-${s.serialNumber}-${i}`}><TableCell>{s.itemName}<Typography variant="caption" display="block" color="text.secondary">{s.itemCode}</Typography></TableCell><TableCell>{s.locationCode}</TableCell><TableCell>{s.batchNumber || '—'}<Typography variant="caption" display="block">{date(s.expiryDate)}</Typography></TableCell><TableCell>{qty(s.onHandQty)} {s.uom}</TableCell></TableRow>)}</TableBody></Table>{!detailQ.data.availableStock.length&&<Alert severity="warning" sx={{mt:1}}>No available stock. Receive stock before issuing to surgery.</Alert>}</Paper></Grid>
        </Grid>
      </>}
    </>}
    <BarcodeScannerDialog open={scannerOpen} onClose={() => setScannerOpen(false)} onDetected={handleIssueScan} />
    <Dialog open={!!dialog} onClose={()=>setDialog(null)} fullWidth maxWidth="sm"><DialogTitle>{dialog==='issue'?'Issue Stock to Surgery':dialog==='return'?'Return Unused Stock':'Record Wastage'}</DialogTitle><DialogContent><Stack spacing={2} sx={{pt:1}}>
      {dialog==='issue' ? <>
        <Stack direction="row" spacing={1} alignItems="center"><TextField select fullWidth label="Item" value={itemId} onChange={e=>{setItemId(e.target.value);setBatch('');setExpiry('');setSerial('');}}>{(itemsQ.data||[]).filter(i=>!!i.uom?.trim() && (detailQ.data?.availableStock || []).some(stock=>stock.itemId===i.itemId && Number(stock.onHandQty)>0)).map(i=><MenuItem key={i.itemId} value={i.itemId}>{i.itemCode} – {i.itemName} ({i.uom})</MenuItem>)}</TextField><Button variant="outlined" startIcon={<QrCodeScanner/>} onClick={()=>setScannerOpen(true)}>Scan</Button></Stack>
        <TextField select label="Location" value={locationId} onChange={e=>setLocationId(e.target.value)}>{(locationsQ.data||[]).map(l=><MenuItem key={l.locationId} value={l.locationId}>{l.locationName}</MenuItem>)}</TextField>
        <TextField select label="Stock Batch / Serial" value={`${batch}::${serial}`} onChange={e=>{const row=stockForItem.find(s=>`${s.batchNumber||''}::${s.serialNumber||''}`===e.target.value&&s.locationId===locationId);setBatch(row?.batchNumber||'');setExpiry(row?.expiryDate?.slice(0,10)||'');setSerial(row?.serialNumber||'');}}>{stockForItem.filter(s=>s.locationId===locationId).map((s,i)=><MenuItem key={`${s.batchNumber}-${s.serialNumber}-${i}`} value={`${s.batchNumber||''}::${s.serialNumber||''}`}>{s.batchNumber || 'No batch'}{s.serialNumber ? ` · ${s.serialNumber}` : ''} · Exp {date(s.expiryDate)} · Available {qty(s.onHandQty)} {s.uom}</MenuItem>)}</TextField>
        {selectedItem?.trackBatch && <Typography variant="caption" color="text.secondary">Batch tracking is required for this item.</Typography>}
        {selectedItem?.trackExpiry && <Typography variant="caption" color="text.secondary">Expiry: {expiry || 'Select a stock batch.'}</Typography>}
        {selectedItem?.trackSerial && <Typography variant="caption" color="text.secondary">Serial: {serial || 'Select a serial-numbered unit.'}</Typography>}
        <TextField type="number" label={`Quantity${selectedItem?.uom?` (${selectedItem.uom})`:''}`} value={quantity} onChange={e=>setQuantity(e.target.value)} inputProps={{min:0.001,step:0.001}} />
        {itemId && <Alert severity="info">Available matching stock: {stockForItem.filter(s=>s.locationId===locationId && (!batch||s.batchNumber===batch)).reduce((n,s)=>n+Number(s.onHandQty),0)} {selectedItem?.uom || ''}</Alert>}
      </> : <><Typography color="text.secondary">{activeLine?.itemName} · Issued {activeLine?.quantityIssued} {activeLine?.uom} · Remaining {maxAdjust} {activeLine?.uom}</Typography><TextField type="number" label="Quantity" value={quantity} onChange={e=>setQuantity(e.target.value)} inputProps={{min:0.001,max:maxAdjust,step:0.001}}/><Alert severity="info">Quantity cannot exceed the remaining issued balance.</Alert></>}
      <TextField multiline minRows={2} label="Notes" value={notes} onChange={e=>setNotes(e.target.value)}/>
    </Stack></DialogContent><DialogActions><Button onClick={()=>setDialog(null)}>Cancel</Button><Button variant="contained" disabled={issueM.isPending||adjustM.isPending||Number(quantity)<=0||(dialog!=='issue'&&Number(quantity)>maxAdjust)} onClick={()=>dialog==='issue'?submitIssue():adjustM.mutate()}>{dialog==='issue'?'Issue Stock':dialog==='return'?'Confirm Return':'Record Wastage'}</Button></DialogActions></Dialog>
  </Box>;
}
