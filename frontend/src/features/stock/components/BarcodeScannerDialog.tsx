import { useEffect, useRef, useState } from 'react';
import { Alert, Button, Dialog, DialogActions, DialogContent, DialogTitle, Stack, TextField, Typography } from '@mui/material';

type ScanResult = { rawValue: string };
type Detector = { detect: (source: HTMLVideoElement) => Promise<ScanResult[]> };
type DetectorConstructor = new (options?: { formats?: string[] }) => Detector;
declare global { interface Window { BarcodeDetector?: DetectorConstructor } }

interface Props { open: boolean; onClose: () => void; onDetected: (value: string) => void; title?: string }
export function BarcodeScannerDialog({ open, onClose, onDetected, title = 'Scan Item Barcode / QR' }: Props) {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const detectedRef = useRef(onDetected);
  const closeRef = useRef(onClose);
  detectedRef.current = onDetected;
  closeRef.current = onClose;
  const [manual, setManual] = useState('');
  const [error, setError] = useState('');
  const [cameraState, setCameraState] = useState('Starting camera…');

  useEffect(() => {
    if (!open) return;
    let active = true;
    let timer: number | undefined;
    const stop = () => { if (timer) window.clearInterval(timer); streamRef.current?.getTracks().forEach(track => track.stop()); streamRef.current = null; };
    const start = async () => {
      setError(''); setCameraState('Starting camera…');
      if (!navigator.mediaDevices?.getUserMedia) { setError('Camera is unavailable. Use the scanner input below or a USB barcode scanner.'); return; }
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: { ideal: 'environment' } }, audio: false });
        if (!active) { stream.getTracks().forEach(track => track.stop()); return; }
        streamRef.current = stream;
        if (videoRef.current) { videoRef.current.srcObject = stream; await videoRef.current.play(); }
        if (!window.BarcodeDetector) { setCameraState('Camera preview is available, but this browser does not support native barcode detection. Use manual / USB scanner input.'); return; }
        const detector = new window.BarcodeDetector({ formats: ['qr_code', 'code_128', 'code_39', 'ean_13', 'ean_8', 'upc_a', 'upc_e', 'itf', 'data_matrix'] });
        setCameraState('Point the camera at the item barcode or QR code.');
        timer = window.setInterval(async () => {
          const video = videoRef.current;
          if (!active || !video || video.readyState < 2) return;
          try { const codes = await detector.detect(video); if (codes[0]?.rawValue) { active = false; detectedRef.current(codes[0].rawValue); closeRef.current(); } } catch { /* Ignore transient frame decode errors. */ }
        }, 350);
      } catch (e) {
        setError(e instanceof Error ? e.message : 'Camera permission was denied or the camera is unavailable.');
        setCameraState('Camera scan unavailable. Use manual / USB scanner input.');
      }
    };
    void start();
    return () => { active = false; stop(); };
  }, [open]);

  const submitManual = () => { const value = manual.trim(); if (value) { onDetected(value); setManual(''); onClose(); } };
  return <Dialog open={open} onClose={onClose} fullWidth maxWidth="sm"><DialogTitle>{title}</DialogTitle><DialogContent><Stack spacing={2} sx={{ pt: 1 }}>
    <video ref={videoRef} muted playsInline style={{ width: '100%', maxHeight: 300, objectFit: 'cover', borderRadius: 8, background: '#080d18' }} />
    <Typography variant="body2" color="text.secondary">{cameraState}</Typography>
    {error && <Alert severity="warning">{error}</Alert>}
    <TextField autoFocus fullWidth label="Enter / scan barcode or QR value" value={manual} onChange={e => setManual(e.target.value)} onKeyDown={e => { if (e.key === 'Enter') submitManual(); }} autoComplete="off" helperText="USB scanners that type the code and press Enter are supported." />
  </Stack></DialogContent><DialogActions><Button onClick={onClose}>Cancel</Button><Button variant="contained" onClick={submitManual} disabled={!manual.trim()}>Use Code</Button></DialogActions></Dialog>;
}
