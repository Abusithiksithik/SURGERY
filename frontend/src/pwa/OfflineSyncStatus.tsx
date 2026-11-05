import { useCallback, useEffect, useState } from 'react';
import { Alert, Box, Button, Chip, CircularProgress, Stack, Typography } from '@mui/material';
import CloudDoneOutlined from '@mui/icons-material/CloudDoneOutlined';
import CloudOffOutlined from '@mui/icons-material/CloudOffOutlined';
import SyncOutlined from '@mui/icons-material/SyncOutlined';
import WarningAmberOutlined from '@mui/icons-material/WarningAmberOutlined';
import { listOfflineOperations, retryFailedOfflineOperations, subscribeToOutbox, syncOfflineOperations, type OfflineOperation } from './offlineOutbox';

export function OfflineSyncStatus() {
  const [online, setOnline] = useState(navigator.onLine);
  const [operations, setOperations] = useState<OfflineOperation[]>([]);
  const [syncing, setSyncing] = useState(false);
  const [message, setMessage] = useState('');
  const refresh = useCallback(async () => {
    setOnline(navigator.onLine);
    try { setOperations(await listOfflineOperations()); } catch { setMessage('Offline storage is unavailable in this browser.'); }
  }, []);
  useEffect(() => {
    void refresh();
    if (navigator.onLine) {
      setSyncing(true);
      void syncOfflineOperations().then(result => {
        if (result.synced) setMessage(`${result.synced} offline operation(s) synced.`);
        if (result.failed) setMessage('Some offline operations need review. See the failed sync queue.');
      }).finally(() => { setSyncing(false); void refresh(); });
    }
    const unsubscribe = subscribeToOutbox(() => { void refresh(); });
    const onOnline = async () => {
      setOnline(true);
      setSyncing(true);
      try {
        const result = await syncOfflineOperations();
        if (result.synced) setMessage(`${result.synced} offline operation(s) synced.`);
        if (result.failed) setMessage('Some offline operations need review. See the failed sync queue.');
      } finally { setSyncing(false); void refresh(); }
    };
    window.addEventListener('online', onOnline);
    return () => { unsubscribe(); window.removeEventListener('online', onOnline); };
  }, [refresh]);
  const pending = operations.filter(op => op.status === 'PENDING').length;
  const failed = operations.filter(op => op.status === 'FAILED').length;
  const handleRetry = async () => {
    setSyncing(true);
    try { await retryFailedOfflineOperations(); setMessage('Retry completed. Review any remaining failed operations.'); }
    finally { setSyncing(false); void refresh(); }
  };
  return <Box sx={{ px: { xs: 2, sm: 3 }, py: 1, borderBottom: 1, borderColor: 'divider' }}>
    <Stack direction="row" spacing={1} alignItems="center" flexWrap="wrap">
      <Chip size="small" color={online ? 'success' : 'warning'} icon={online ? <CloudDoneOutlined/> : <CloudOffOutlined/>} label={online ? 'Online' : 'Offline'} />
      {(pending > 0 || failed > 0 || syncing) && <Chip size="small" color={failed ? 'error' : 'info'} icon={syncing ? <CircularProgress size={14}/> : <SyncOutlined/>} label={`${pending} pending · ${failed} failed`} />}
      {failed > 0 && <Button size="small" onClick={handleRetry} disabled={!online || syncing}>Retry failed sync</Button>}
      {syncing && <Typography variant="caption" color="text.secondary">Syncing queued stock movements…</Typography>}
    </Stack>
    {failed > 0 && <Alert severity="warning" icon={<WarningAmberOutlined/>} sx={{ mt: 1 }}>
      {failed} stock operation(s) could not be synced. They remain on this device and need review. Do not repeat the same movement until its status is checked.
      {operations.filter(op => op.status === 'FAILED').slice(0,2).map(op => <Typography key={op.id} variant="caption" display="block">{op.kind}: {op.error || 'Sync failed'}</Typography>)}
    </Alert>}
    {!!message && <Typography variant="caption" color="text.secondary" display="block" sx={{ mt: .5 }}>{message}</Typography>}
  </Box>;
}
