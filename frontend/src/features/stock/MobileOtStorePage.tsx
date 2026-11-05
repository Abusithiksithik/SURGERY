import { useMemo, useState } from 'react';
import { useQuery } from '@tanstack/react-query';
import { Alert, Box, Button, Card, CardContent, Chip, CircularProgress, Stack, TextField, Typography } from '@mui/material';
import { Inventory2Outlined, QrCodeScanner, Refresh, ShoppingCartCheckout } from '@mui/icons-material';
import { useNavigate } from 'react-router-dom';
import { getErrorMessage } from '@/api/client';
import { stockApi } from '@/api/stock.api';
import { useAuth } from '@/auth/AuthContext';
import { OfflineSyncStatus } from '@/pwa/OfflineSyncStatus';

export function MobileOtStorePage() {
  const [search,setSearch]=useState('');
  const navigate=useNavigate();
  const {hasPermission,logout,user}=useAuth();
  const balances=useQuery({queryKey:['mobile-stock-balances'],queryFn:()=>stockApi.balances({page:1,limit:300}),refetchInterval:60000});
  const rows=useMemo(()=> (balances.data||[]).filter(r=>`${r.itemCode} ${r.itemName} ${r.batchNumber||''}`.toLowerCase().includes(search.toLowerCase())),[balances.data,search]);
  return <Box sx={{maxWidth:760,mx:'auto',pb:4}}>
    <Stack direction="row" alignItems="center" justifyContent="space-between" sx={{p:2,borderBottom:1,borderColor:'divider'}}>
      <Box><Typography variant="h6" fontWeight={800}>OT Store Mobile</Typography><Typography variant="caption" color="text.secondary">{user?.fullName}</Typography></Box>
      <Button size="small" onClick={logout}>Sign out</Button>
    </Stack>
    <OfflineSyncStatus />
    <Box sx={{p:2}}>
      <Typography variant="h5" fontWeight={800} sx={{mb:1}}>Available Stock</Typography>
      <Typography color="text.secondary" variant="body2" sx={{mb:2}}>Search current OT Store balances, check batch/expiry, and open permitted stock workflows.</Typography>
      <TextField fullWidth size="small" label="Search item / code / batch" name="mobile-ot-search-field" autoComplete="new-password" inputProps={{ autoComplete: 'new-password', autoCorrect: 'off', spellCheck: false }} value={search} onChange={e=>setSearch(e.target.value)} sx={{mb:2}} />
      <Stack direction="row" spacing={1} sx={{mb:2}} flexWrap="wrap" useFlexGap>
        {hasPermission('RECEIVE_STOCK') && <Button fullWidth variant="contained" startIcon={<Inventory2Outlined/>} onClick={()=>navigate('/mobile/ot-store/receive')}>Receive Stock</Button>}
        {hasPermission('ENTER_CASE_USAGE') && <Button fullWidth variant="outlined" startIcon={<ShoppingCartCheckout/>} onClick={()=>navigate('/ot-store/consumption')}>Surgery Consumption</Button>}
      </Stack>
      {!hasPermission('RECEIVE_STOCK') && <Alert severity="info" sx={{mb:2}}>Your account has mobile view access. Stock receiving requires RECEIVE_STOCK permission.</Alert>}
      {balances.isLoading ? <Box sx={{display:'flex',justifyContent:'center',p:4}}><CircularProgress/></Box> : balances.isError ? <Alert severity="error">Could not load stock: {getErrorMessage(balances.error)}. Check that the backend is running and the API URL is reachable from this device.</Alert> : rows.length===0 ? <Alert severity="info">No matching stock balances found.</Alert> : <Stack spacing={1}>{rows.map((r,i)=><Card key={`${r.itemId}-${r.locationId}-${r.batchNumber||''}-${i}`} variant="outlined"><CardContent sx={{'&:last-child':{pb:2}}}>
        <Stack direction="row" justifyContent="space-between" alignItems="flex-start" spacing={1}><Box sx={{minWidth:0}}><Typography fontWeight={700}>{r.itemName}</Typography><Typography variant="caption" color="text.secondary">{r.itemCode} · {r.locationCode}</Typography></Box><Chip size="small" color={Number(r.onHandQty)<=0?'error':Number(r.onHandQty)<5?'warning':'success'} label={`${Number(r.onHandQty).toLocaleString()} ${r.uom||''}`} /></Stack>
        <Typography variant="caption" color="text.secondary" display="block" sx={{mt:1}}>Batch: {r.batchNumber||'—'} · Expiry: {r.expiryDate?new Date(r.expiryDate).toLocaleDateString('en-IN'):'—'}</Typography>
      </CardContent></Card>)}</Stack>}
      <Button fullWidth sx={{mt:2}} startIcon={<Refresh/>} onClick={()=>void balances.refetch()}>Refresh Stock</Button>
      <Typography variant="caption" color="text.secondary" display="block" sx={{mt:2}}>QR/barcode scanner is available inside the receive and physical-count workflows. Offline stock movements are queued on this device and sync when the connection returns.</Typography>
    </Box>
  </Box>;
}
