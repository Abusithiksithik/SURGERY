/**
 * SchedulingPage — OT Details | Pre-Op Checklist | Documentation
 * Accessed via:
 *   /scheduling/new?surgeryId=<uuid>   → create
 *   /scheduling/:scheduleId             → view / edit / actions
 *   /scheduling/:scheduleId?tab=preop   → open Pre-Op tab directly
 *   /scheduling/:scheduleId?tab=docs    → open Documentation tab directly
 */
import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate, useParams, useSearchParams } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Grid, TextField, MenuItem, Button, Alert, Typography,
  Stack, Chip, Paper, Divider, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
  Autocomplete, Tabs, Tab,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  IconButton, Tooltip, Select, FormControl, InputLabel,
} from '@mui/material';
import SaveIcon           from '@mui/icons-material/Save';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import EventRepeatIcon    from '@mui/icons-material/EventRepeat';
import MeetingRoomIcon    from '@mui/icons-material/MeetingRoom';
import GroupsIcon         from '@mui/icons-material/Groups';
import PauseCircleIcon    from '@mui/icons-material/PauseCircle';
import CancelIcon         from '@mui/icons-material/Cancel';
import HistoryIcon        from '@mui/icons-material/History';
import OpenInNewIcon      from '@mui/icons-material/OpenInNew';
import ArrowBackIcon      from '@mui/icons-material/ArrowBack';
import UploadFileIcon     from '@mui/icons-material/UploadFile';
import DownloadIcon       from '@mui/icons-material/Download';
import DeleteOutlineIcon  from '@mui/icons-material/DeleteOutline';
import CheckBoxIcon       from '@mui/icons-material/CheckBox';
import BlockIcon          from '@mui/icons-material/Block';
import PendingIcon        from '@mui/icons-material/Pending';
import { PageHeader }     from '@/components/common/PageHeader';
import { DateInput }      from '@/components/common/DateInput';
import * as schedApi      from '@/api/scheduling.api';
import * as preopApi      from '@/api/preop.api';
import * as docsApi       from '@/api/documents.api';
import { updateScheduleTimeDuration } from '@/api/scheduling.api';
import type { SurgerySchedule, SchedulePriority, ScheduleStatus } from '@/api/scheduling.api';
import type { SurgeryChecklistItem, SurgeryDocument, DocumentType } from '@/api/types';
import * as surgeriesApi  from '@/api/surgeries.api';
import {
  useSurgeons, useAnaesthetists, useOtRooms, useAssistants,
} from '@/hooks/useMasterData';
import { getErrorMessage } from '@/api/client';
import { formatDate }     from '@/utils/format';

// ─── constants ───────────────────────────────────────────────────────────────
const PRIORITIES: { value: SchedulePriority; label: string; color: 'default' | 'warning' | 'error' }[] = [
  { value: 'ROUTINE',   label: 'Routine',   color: 'default' },
  { value: 'URGENT',    label: 'Urgent',    color: 'warning' },
  { value: 'EMERGENCY', label: 'Emergency', color: 'error'   },
];

const STATUS_COLOR: Record<ScheduleStatus, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DRAFT:       'info',
  CONFIRMED:   'success',
  IN_PROGRESS: 'warning',
  COMPLETED:   'success',
  POSTPONED:   'warning',
  CANCELLED:   'error',
};

const DOC_TYPE_LABELS: Record<DocumentType, string> = {
  CONSENT_FORM:         'Consent Form',
  PAC_REPORT:           'PAC Report',
  INVESTIGATION_REPORT: 'Investigation Report',
  OTHER:                'Other',
};

type FormState = {
  plannedDate: string;
  plannedStartTime: string;
  expectedDurationMin: number;
  otRoomId: string;
  priority: SchedulePriority;
  primarySurgeonId: string;
  coSurgeonId: string;
  anaesthetistId: string;
  assistantDoctorIds: string[];
  otherPersonnel: string;
};

const EMPTY_FORM: FormState = {
  plannedDate: '', plannedStartTime: '', expectedDurationMin: 60,
  otRoomId: '', priority: 'ROUTINE', primarySurgeonId: '', coSurgeonId: '',
  anaesthetistId: '', assistantDoctorIds: [], otherPersonnel: '',
};

// ─── ReasonDialog ─────────────────────────────────────────────────────────────
function ReasonDialog({
  open, title, label, children, onClose, onConfirm, confirmLabel, confirmColor,
}: {
  open: boolean; title: string; label: string;
  children?: React.ReactNode;
  onClose: () => void;
  onConfirm: (reason: string) => Promise<void>;
  confirmLabel?: string;
  confirmColor?: 'error' | 'warning' | 'primary';
}) {
  const [reason, setReason] = useState('');
  const [busy,   setBusy]   = useState(false);
  const [err,    setErr]    = useState('');

  useEffect(() => { if (open) { setReason(''); setBusy(false); setErr(''); } }, [open]);

  async function handle() {
    if (!reason.trim()) { setErr('Reason is required'); return; }
    setBusy(true); setErr('');
    try { await onConfirm(reason); onClose(); }
    catch (e: unknown) { setErr(e instanceof Error ? e.message : 'Failed'); }
    finally { setBusy(false); }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>{title}</DialogTitle>
      <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
        {err && <Alert severity="error">{err}</Alert>}
        {children}
        <TextField
          label={label} required multiline rows={3}
          value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason…" fullWidth
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose}>Cancel</Button>
        <Button
          variant="contained"
          color={confirmColor ?? 'primary'}
          onClick={handle}
          disabled={busy || !reason.trim()}
        >
          {busy ? 'Saving…' : (confirmLabel ?? 'Confirm')}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ─── HistoryPanel ─────────────────────────────────────────────────────────────
function HistoryPanel({ scheduleId }: { scheduleId: string }) {
  const { data = [], isLoading } = useQuery({
    queryKey: ['schedule-history', scheduleId],
    queryFn: () => schedApi.getScheduleHistory(scheduleId),
    enabled: !!scheduleId,
  });
  if (isLoading) return <CircularProgress size={20} />;
  if (!data.length) return <Typography color="text.secondary">No history yet.</Typography>;
  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Action</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Reason</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>By</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>When</TableCell>
          </TableRow>
        </TableHead>
        <TableBody>
          {data.map((h) => (
            <TableRow key={h.historyId} hover>
              <TableCell><Chip label={h.action} size="small" /></TableCell>
              <TableCell>{h.reason ?? '—'}</TableCell>
              <TableCell>{h.changedByName ?? '—'}</TableCell>
              <TableCell>{formatDate(h.changedAt)}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── PreOpChecklistTab ────────────────────────────────────────────────────────
function PreOpChecklistTab({ surgeryId }: { surgeryId: string }) {
  const qc = useQueryClient();
  const [seeding, setSeeding] = useState(false);

  const { data: items = [], isLoading, isError } = useQuery<SurgeryChecklistItem[]>({
    queryKey: ['surgery-checklist', surgeryId],
    queryFn:  () => preopApi.getSurgeryChecklist(surgeryId),
    enabled:  !!surgeryId,
  });

  // Auto-seed once when the tab loads and finds 0 items — handles surgeries
  // that were confirmed before the checklist feature was active, or when a
  // template was added after the surgery was scheduled.
  const seededRef = useRef(false);
  useEffect(() => {
    if (!isLoading && !isError && items.length === 0 && surgeryId && !seededRef.current) {
      seededRef.current = true;
      setSeeding(true);
      preopApi.seedSurgeryChecklist(surgeryId)
        .then(() => qc.invalidateQueries({ queryKey: ['surgery-checklist', surgeryId] }))
        .catch(() => {/* no-op — template may not exist for this procedure */})
        .finally(() => setSeeding(false));
    }
  }, [isLoading, isError, items.length, surgeryId, qc]);

  const [updating, setUpdating] = useState<string | null>(null);
  const [remarks,  setRemarks]  = useState<Record<string, string>>({});

  useEffect(() => {
    const r: Record<string, string> = {};
    items.forEach((i) => { r[i.checklistId] = i.remarks ?? ''; });
    setRemarks(r);
  }, [items]);

  async function handleStatusChange(item: SurgeryChecklistItem, newStatus: string) {
    setUpdating(item.checklistId);
    try {
      await preopApi.updateSurgeryChecklistItem(item.checklistId, {
        status: newStatus,
        remarks: remarks[item.checklistId] ?? '',
      });
      qc.invalidateQueries({ queryKey: ['surgery-checklist', surgeryId] });
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  }

  async function handleSaveRemarks(item: SurgeryChecklistItem) {
    setUpdating(item.checklistId);
    try {
      await preopApi.updateSurgeryChecklistItem(item.checklistId, {
        status: item.status,
        remarks: remarks[item.checklistId] ?? '',
      });
      qc.invalidateQueries({ queryKey: ['surgery-checklist', surgeryId] });
    } catch (e) {
      console.error(e);
    } finally {
      setUpdating(null);
    }
  }

  const statusIcon = (s: string) => {
    if (s === 'COMPLETED')      return <CheckBoxIcon fontSize="small" color="success" />;
    if (s === 'NOT_APPLICABLE') return <BlockIcon fontSize="small" color="disabled" />;
    return <PendingIcon fontSize="small" color="warning" />;
  };

  const statusColor = (s: string): 'success' | 'default' | 'warning' =>
    s === 'COMPLETED' ? 'success' : s === 'NOT_APPLICABLE' ? 'default' : 'warning';

  if (isLoading || seeding) return <Box sx={{ py: 4, textAlign: 'center' }}><CircularProgress size={24} /></Box>;
  if (isError)   return <Alert severity="error">Failed to load checklist.</Alert>;

  if (items.length === 0) {
    return (
      <Alert severity="info" sx={{ mt: 1 }}>
        No checklist items found for this surgery.{' '}
        No active checklist template exists for this procedure in Master Config.
        Go to <strong>Master Config → Pre-Op Checklist</strong> to add a template for the procedure,
        then return here — the checklist will be created automatically.
      </Alert>
    );
  }

  const pending       = items.filter(i => i.status === 'PENDING').length;
  const completed     = items.filter(i => i.status === 'COMPLETED').length;
  const notApplicable = items.filter(i => i.status === 'NOT_APPLICABLE').length;

  return (
    <Box>
      {/* Summary chips */}
      <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
        <Chip icon={<PendingIcon />}   label={`Pending: ${pending}`}         color="warning" size="small" variant="outlined" />
        <Chip icon={<CheckBoxIcon />}  label={`Completed: ${completed}`}     color="success" size="small" variant="outlined" />
        <Chip icon={<BlockIcon />}     label={`N/A: ${notApplicable}`}       color="default" size="small" variant="outlined" />
        <Chip                          label={`Total: ${items.length}`}       color="default" size="small" variant="outlined" />
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow sx={{ bgcolor: 'action.hover' }}>
              <TableCell sx={{ fontWeight: 700, width: 44 }}>#</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Checklist Item</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 180 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Completed By</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Completed At</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Remarks</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 80 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {items.map((item, idx) => (
              <TableRow key={item.checklistId} hover>
                <TableCell>
                  <Typography variant="caption" color="text.secondary">{item.sortOrder ?? idx + 1}</Typography>
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={1} alignItems="center">
                    {statusIcon(item.status)}
                    <Typography fontSize={13}>{item.itemLabel}</Typography>
                  </Stack>
                </TableCell>
                <TableCell>
                  <FormControl size="small" fullWidth>
                    <Select
                      value={item.status}
                      onChange={(e) => handleStatusChange(item, e.target.value)}
                      disabled={updating === item.checklistId}
                      sx={{ fontSize: 12 }}
                    >
                      <MenuItem value="PENDING">Pending</MenuItem>
                      <MenuItem value="COMPLETED">Completed</MenuItem>
                      <MenuItem value="NOT_APPLICABLE">Not Applicable</MenuItem>
                    </Select>
                  </FormControl>
                </TableCell>
                <TableCell>
                  <Typography fontSize={12} color={item.completedByName ? 'text.primary' : 'text.secondary'}>
                    {item.completedByName ?? '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <Typography fontSize={12} color={item.completedAt ? 'text.primary' : 'text.secondary'}>
                    {item.completedAt ? new Date(item.completedAt).toLocaleString() : '—'}
                  </Typography>
                </TableCell>
                <TableCell>
                  <TextField
                    size="small" fullWidth multiline maxRows={2}
                    placeholder="Add remarks…"
                    value={remarks[item.checklistId] ?? ''}
                    onChange={(e) => setRemarks(r => ({ ...r, [item.checklistId]: e.target.value }))}
                    inputProps={{ style: { fontSize: 12 } }}
                  />
                </TableCell>
                <TableCell>
                  <Stack direction="row" spacing={0.5}>
                    <Tooltip title="Mark Complete">
                      <span>
                        <IconButton
                          size="small" color="success"
                          disabled={item.status === 'COMPLETED' || updating === item.checklistId}
                          onClick={() => handleStatusChange(item, 'COMPLETED')}
                        >
                          <CheckBoxIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Mark N/A">
                      <span>
                        <IconButton
                          size="small"
                          disabled={item.status === 'NOT_APPLICABLE' || updating === item.checklistId}
                          onClick={() => handleStatusChange(item, 'NOT_APPLICABLE')}
                        >
                          <BlockIcon fontSize="small" />
                        </IconButton>
                      </span>
                    </Tooltip>
                    <Tooltip title="Save Remarks">
                      <IconButton
                        size="small" color="primary"
                        disabled={updating === item.checklistId}
                        onClick={() => handleSaveRemarks(item)}
                      >
                        <SaveIcon fontSize="small" />
                      </IconButton>
                    </Tooltip>
                  </Stack>
                </TableCell>
              </TableRow>
            ))}
          </TableBody>
        </Table>
      </TableContainer>
    </Box>
  );
}

// ─── DocumentationTab ─────────────────────────────────────────────────────────
function DocumentationTab({ surgeryId }: { surgeryId: string }) {
  const qc = useQueryClient();
  const fileInputRef = useRef<HTMLInputElement>(null);

  const [docType,  setDocType]  = useState<DocumentType>('OTHER');
  const [notes,    setNotes]    = useState('');
  const [uploading, setUploading] = useState(false);
  const [uploadErr, setUploadErr] = useState('');

  const { data: docs = [], isLoading } = useQuery<SurgeryDocument[]>({
    queryKey: ['surgery-docs', surgeryId],
    queryFn:  () => docsApi.listDocuments(surgeryId),
    enabled:  !!surgeryId,
  });

  async function handleUpload(file: File) {
    setUploading(true); setUploadErr('');
    try {
      const fd = new FormData();
      fd.append('file',         file);
      fd.append('documentType', docType);
      fd.append('notes',        notes);
      await docsApi.uploadDocument(surgeryId, fd);
      qc.invalidateQueries({ queryKey: ['surgery-docs', surgeryId] });
      setNotes('');
      if (fileInputRef.current) fileInputRef.current.value = '';
    } catch (e) {
      setUploadErr(getErrorMessage(e));
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(doc: SurgeryDocument) {
    if (!confirm(`Delete "${doc.fileName}"?`)) return;
    try {
      await docsApi.deleteDocument(doc.documentId);
      qc.invalidateQueries({ queryKey: ['surgery-docs', surgeryId] });
    } catch (e) {
      alert(getErrorMessage(e));
    }
  }

  function formatBytes(bytes?: number | null) {
    if (!bytes) return '—';
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
  }

  return (
    <Box>
      {/* Upload Panel */}
      <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
        <Typography variant="subtitle2" fontWeight={700} sx={{ mb: 1.5, textTransform: 'uppercase', letterSpacing: 0.5 }}>
          Upload Document
        </Typography>
        {uploadErr && <Alert severity="error" sx={{ mb: 1.5 }}>{uploadErr}</Alert>}
        <Grid container spacing={2} alignItems="flex-end">
          <Grid item xs={12} sm={3}>
            <TextField
              label="Document Type" select size="small" fullWidth
              value={docType}
              onChange={(e) => setDocType(e.target.value as DocumentType)}
            >
              {(Object.entries(DOC_TYPE_LABELS) as [DocumentType, string][]).map(([v, l]) => (
                <MenuItem key={v} value={v}>{l}</MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={5}>
            <TextField
              label="Notes (optional)" size="small" fullWidth
              name="surgery-document-notes"
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              // Prevent browser password-manager/contact autofill from inserting saved
              // account values (e.g. management email) into this free-text field.
              autoComplete="off"
              inputProps={{ autoComplete: 'new-password', 'data-form-type': 'other' }}
            />
          </Grid>
          <Grid item xs={12} sm={4}>
            <input
              type="file"
              ref={fileInputRef}
              style={{ display: 'none' }}
              onChange={(e) => {
                const file = e.target.files?.[0];
                if (file) handleUpload(file);
              }}
            />
            <Button
              variant="contained"
              startIcon={uploading ? <CircularProgress size={16} color="inherit" /> : <UploadFileIcon />}
              disabled={uploading}
              fullWidth
              onClick={() => fileInputRef.current?.click()}
            >
              {uploading ? 'Uploading…' : 'Choose & Upload File'}
            </Button>
          </Grid>
        </Grid>
      </Paper>

      {/* Documents List */}
      {isLoading
        ? <CircularProgress size={24} />
        : docs.length === 0
        ? <Alert severity="info">No documents uploaded yet for this surgery.</Alert>
        : (
          <TableContainer component={Paper} variant="outlined">
            <Table size="small">
              <TableHead>
                <TableRow sx={{ bgcolor: 'action.hover' }}>
                  <TableCell sx={{ fontWeight: 700 }}>Type</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>File Name</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Size</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Notes</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Uploaded By</TableCell>
                  <TableCell sx={{ fontWeight: 700 }}>Uploaded At</TableCell>
                  <TableCell sx={{ fontWeight: 700, width: 80 }}>Actions</TableCell>
                </TableRow>
              </TableHead>
              <TableBody>
                {docs.map((doc) => (
                  <TableRow key={doc.documentId} hover>
                    <TableCell>
                      <Chip label={DOC_TYPE_LABELS[doc.documentType] ?? doc.documentType} size="small" />
                    </TableCell>
                    <TableCell>
                      <Typography fontSize={13} sx={{ wordBreak: 'break-all' }}>{doc.fileName}</Typography>
                    </TableCell>
                    <TableCell>{formatBytes(doc.fileSize)}</TableCell>
                    <TableCell>
                      <Typography fontSize={12} color="text.secondary">{doc.notes ?? '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontSize={12}>{doc.uploadedByName ?? '—'}</Typography>
                    </TableCell>
                    <TableCell>
                      <Typography fontSize={12}>{new Date(doc.uploadedAt).toLocaleString()}</Typography>
                    </TableCell>
                    <TableCell>
                      <Stack direction="row" spacing={0.5}>
                        <Tooltip title="Download">
                          <IconButton
                            size="small" color="primary"
                            component="a"
                            href={docsApi.getDownloadUrl(doc.documentId)}
                            target="_blank"
                            rel="noopener noreferrer"
                          >
                            <DownloadIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                        <Tooltip title="Delete">
                          <IconButton size="small" color="error" onClick={() => handleDelete(doc)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      </Stack>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          </TableContainer>
        )
      }
    </Box>
  );
}

// ─── OT Details Tab (main form) ───────────────────────────────────────────────
function OtDetailsTab({
  form, setF, existing, surgery, surgeryId, navigate,
  isNew, isView, isLocked, canAct, saving, setSaving, setError, error,
  scheduleId, otRooms, surgeons, anaesthetists, assistants,
  onInvalidate, dialog, setDialog,
  dlgOtRoom, setDlgOtRoom,
  dlgTeam, setDlgTeam,
  dlgNewDate, setDlgNewDate,
  dlgTime, setDlgTime, dlgDuration, setDlgDuration,
}: any) {
  const updateTimeMut = useMutation({
    mutationFn: () => updateScheduleTimeDuration(scheduleId!, {
      plannedStartTime:    form.plannedStartTime ? form.plannedStartTime + ':00' : undefined,
      expectedDurationMin: form.expectedDurationMin,
      otRoomId:            form.otRoomId || undefined,
      plannedDate:         form.plannedDate || undefined,
    }),
    onSuccess: () => { onInvalidate(); setError(''); },
    onError: (e: unknown) => setError(getErrorMessage(e)),
  });

  const qc = useQueryClient();
  const [searchParams] = useSearchParams();
  const surgeryIdParam = searchParams.get('surgeryId') ?? '';

  const createMut = useMutation({
    mutationFn: (p: Parameters<typeof schedApi.createSchedule>[0]) => schedApi.createSchedule(p),
    onSuccess: (sched) => {
      qc.invalidateQueries({ queryKey: ['schedule'] });
      if (surgeryIdParam) qc.invalidateQueries({ queryKey: ['surgery', surgeryIdParam] });
      navigate(`/scheduling/${sched.scheduleId}`, { replace: true });
    },
    onError: (e: unknown) => setError(getErrorMessage(e)),
  });

  function buildPayload() {
    return {
      surgeryId:           surgeryId!,
      plannedDate:         form.plannedDate,
      plannedStartTime:    form.plannedStartTime + ':00',
      expectedDurationMin: form.expectedDurationMin,
      otRoomId:            form.otRoomId   || undefined,
      priority:            form.priority,
      primarySurgeonId:    form.primarySurgeonId  || undefined,
      coSurgeonId:         form.coSurgeonId        || undefined,
      anaesthetistId:      form.anaesthetistId     || undefined,
      assistantDoctorIds:  form.assistantDoctorIds,
      otherPersonnel:      form.otherPersonnel     || undefined,
    };
  }

  async function handleSave() {
    if (!form.plannedDate)            { setError('Surgery Date is required');      return; }
    if (!form.plannedStartTime)       { setError('OT In Time is required');        return; }
    if (!form.expectedDurationMin)    { setError('Duration is required');          return; }
    if (!form.otRoomId)               { setError('OT Room is required');           return; }
    if (!surgeryId)                   { setError('Surgery ID is required');        return; }
    setSaving(true); setError('');
    try { await createMut.mutateAsync(buildPayload()); }
    finally { setSaving(false); }
  }

  async function handleUpdateTimeDuration() {
    if (!form.plannedStartTime) { setError('Start time is required'); return; }
    setSaving(true); setError('');
    try { await updateTimeMut.mutateAsync(); }
    finally { setSaving(false); }
  }

  const status = existing?.status as ScheduleStatus | undefined;

  return (
    <>
      {isView && !isLocked && (
        <Alert severity="info" sx={{ mb: 2 }} icon={false}>
          OT Scheduling: only <strong>Start Time</strong>, <strong>OT Room</strong> and{' '}
          <strong>Duration</strong> are editable here. All other surgery details are managed from Surgery Entry.
        </Alert>
      )}

      {/* Surgery info card */}
      {(surgery || existing) && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3 }}>
          <Stack direction="row" spacing={3} alignItems="center" flexWrap="wrap" gap={1}>
            <Box>
              <Typography variant="caption" color="text.secondary">Surgery ID</Typography>
              <Typography variant="h6" sx={{ fontFamily: 'monospace', fontWeight: 700 }}>
                {surgery?.surgeryNumber ?? existing?.surgeryNumber ?? '—'}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Patient</Typography>
              <Typography variant="body2" sx={{ fontWeight: 600 }}>
                {surgery?.patient?.fullName ?? existing?.patientFullName ?? '—'}
                {' · '}
                {surgery?.patient?.mrNumber ?? existing?.mrNumber ?? ''}
              </Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Procedure</Typography>
              <Typography variant="body2">{surgery?.surgeryTypeName ?? '—'}</Typography>
            </Box>
            <Box>
              <Typography variant="caption" color="text.secondary">Surgery Status</Typography>
              <Box><Chip label={surgery?.status ?? existing?.surgeryStatus ?? '—'} size="small" /></Box>
            </Box>
            {surgeryId && (
              <Button
                variant="outlined" size="small" endIcon={<OpenInNewIcon />}
                onClick={() => navigate(`/surgeries/${surgeryId}`)}
              >
                Open Surgery Entry
              </Button>
            )}
          </Stack>
        </Paper>
      )}

      <Grid container spacing={2.5}>
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
            Scheduling
          </Typography>
        </Grid>

        <Grid item xs={12} sm={4}>
          <DateInput
            label="Planned Surgery Date" required
            value={form.plannedDate}
            onChange={(v: string) => setF('plannedDate', v)}
            size="small" fullWidth
            disabled={isView}
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            label="OT In Time" required size="small" fullWidth
            type="time"
            value={form.plannedStartTime}
            onChange={(e) => setF('plannedStartTime', e.target.value)}
            InputLabelProps={{ shrink: true }}
            inputProps={{ step: 300 }}
            disabled={isLocked}
          />
        </Grid>

        <Grid item xs={12} sm={4}>
          <TextField
            label="Duration (minutes)" required size="small" fullWidth
            type="number"
            value={form.expectedDurationMin}
            onChange={(e) => setF('expectedDurationMin', Math.max(1, parseInt(e.target.value) || 60))}
            inputProps={{ min: 1, max: 720 }}
            disabled={isLocked}
          />
        </Grid>

        {/* OT Out Time — calculated display only */}
        {(form.plannedStartTime && form.expectedDurationMin) && (
          <Grid item xs={12} sm={4}>
            <TextField
              label="OT Out Time (calculated)" size="small" fullWidth
              value={(() => {
                const [h, m] = form.plannedStartTime.split(':').map(Number);
                const outMin = h * 60 + m + Number(form.expectedDurationMin);
                const oh = String(Math.floor(outMin / 60) % 24).padStart(2, '0');
                const om = String(outMin % 60).padStart(2, '0');
                return `${oh}:${om}`;
              })()}
              InputProps={{ readOnly: true }}
              InputLabelProps={{ shrink: true }}
              disabled
              sx={{ '& .MuiInputBase-input.Mui-disabled': { WebkitTextFillColor: 'text.secondary' } }}
            />
          </Grid>
        )}

        <Grid item xs={12} sm={6}>
          <TextField
            label="OT Room" select required size="small" fullWidth
            value={form.otRoomId}
            onChange={(e) => setF('otRoomId', e.target.value)}
            disabled={isView}
            error={isNew && !form.otRoomId}
            helperText={isNew && !form.otRoomId ? 'OT Room is required' : ''}
          >
            <MenuItem value="">— Select OT Room —</MenuItem>
            {otRooms.map((r: any) => (
              <MenuItem key={r.otRoomId} value={r.otRoomId}>
                {r.roomName} ({r.roomCode})
              </MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Priority" select required size="small" fullWidth
            value={form.priority}
            onChange={(e) => setF('priority', e.target.value as SchedulePriority)}
            disabled={isView}
          >
            {PRIORITIES.map(p => (
              <MenuItem key={p.value} value={p.value}>{p.label}</MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12}><Divider /></Grid>

        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary"
            sx={{ textTransform: 'uppercase', letterSpacing: 0.5, mb: 0.5 }}>
            Surgical Team
          </Typography>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Primary Surgeon" select size="small" fullWidth
            value={form.primarySurgeonId}
            onChange={(e) => setF('primarySurgeonId', e.target.value)}
            disabled={isView}
          >
            <MenuItem value="">— Select —</MenuItem>
            {surgeons.map((s: any) => (
              <MenuItem key={s.surgeonId} value={s.surgeonId}>{s.fullName}</MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Co-Surgeon (optional)" select size="small" fullWidth
            value={form.coSurgeonId}
            onChange={(e) => setF('coSurgeonId', e.target.value)}
            disabled={isView}
          >
            <MenuItem value="">— None —</MenuItem>
            {surgeons.filter((s: any) => s.surgeonId !== form.primarySurgeonId).map((s: any) => (
              <MenuItem key={s.surgeonId} value={s.surgeonId}>{s.fullName}</MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12} sm={6}>
          <TextField
            label="Anaesthetist" select size="small" fullWidth
            value={form.anaesthetistId}
            onChange={(e) => setF('anaesthetistId', e.target.value)}
            disabled={isView}
          >
            <MenuItem value="">— Select —</MenuItem>
            {anaesthetists.map((a: any) => (
              <MenuItem key={a.anaesthetistId} value={a.anaesthetistId}>{a.fullName}</MenuItem>
            ))}
          </TextField>
        </Grid>

        <Grid item xs={12} sm={6}>
          <Autocomplete
            multiple
            options={assistants}
            getOptionLabel={(a: any) => a.fullName}
            value={assistants.filter((a: any) => form.assistantDoctorIds.includes(a.assistantId))}
            onChange={(_: any, selected: any[]) =>
              setF('assistantDoctorIds', selected.map((a: any) => a.assistantId))
            }
            disabled={isView}
            renderInput={(params: any) => (
              <TextField {...params} label="Assistant Doctor(s)" size="small" fullWidth />
            )}
            size="small"
          />
        </Grid>

        <Grid item xs={12}>
          <TextField
            label="Other Personnel (nurses, techs, etc.)" size="small" fullWidth
            value={form.otherPersonnel}
            onChange={(e) => setF('otherPersonnel', e.target.value)}
            disabled={isView}
            multiline rows={2}
          />
        </Grid>
      </Grid>

      {/* Actions */}
      <Stack direction="row" spacing={2} sx={{ mt: 4 }} flexWrap="wrap" gap={1}>
        {isNew && (
          <Button
            variant="contained" startIcon={<SaveIcon />}
            onClick={handleSave} disabled={saving}
          >
            {saving ? 'Saving…' : 'Save Schedule'}
          </Button>
        )}

        {canAct && (
          <Button
            variant="contained" color="primary" startIcon={<SaveIcon />}
            onClick={handleUpdateTimeDuration}
            disabled={saving || updateTimeMut.isPending}
          >
            {saving || updateTimeMut.isPending ? 'Saving…' : 'Save OT Room / Time & Duration'}
          </Button>
        )}

        {canAct && status === 'DRAFT' && (
          <Button
            variant="contained" color="success" startIcon={<CheckCircleIcon />}
            onClick={() =>
              schedApi.confirmSchedule(scheduleId!)
                .then(() => onInvalidate())
                .catch((e: unknown) => setError(String(e)))
            }
          >
            Confirm Schedule
          </Button>
        )}

        {canAct && (
          <>
            <Button variant="outlined" startIcon={<EventRepeatIcon />}
              onClick={() => { setDlgNewDate(''); setDlgTime(''); setDlgDuration(form.expectedDurationMin); setDialog('reschedule'); }}>
              Reschedule
            </Button>
            <Button variant="outlined" startIcon={<MeetingRoomIcon />}
              onClick={() => { setDlgOtRoom(form.otRoomId); setDialog('changeOt'); }}>
              Change OT
            </Button>
            <Button variant="outlined" startIcon={<GroupsIcon />}
              onClick={() => {
                setDlgTeam({
                  primarySurgeonId: form.primarySurgeonId, coSurgeonId: form.coSurgeonId,
                  anaesthetistId: form.anaesthetistId,
                  assistantDoctorIds: [...form.assistantDoctorIds],
                  otherPersonnel: form.otherPersonnel,
                });
                setDialog('changeTeam');
              }}>
              Change Team
            </Button>
            <Button variant="outlined" color="warning" startIcon={<PauseCircleIcon />}
              onClick={() => { setDlgNewDate(''); setDialog('postpone'); }}>
              Postpone
            </Button>
            <Button variant="outlined" color="error" startIcon={<CancelIcon />}
              onClick={() => setDialog('cancel')}>
              Cancel
            </Button>
          </>
        )}
      </Stack>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────
export function SchedulingPage() {
  const navigate       = useNavigate();
  const { scheduleId } = useParams<{ scheduleId?: string }>();
  const [searchParams] = useSearchParams();
  const surgeryIdParam = searchParams.get('surgeryId') ?? '';
  const initialTab     = searchParams.get('tab') === 'preop' ? 1
                       : searchParams.get('tab') === 'docs'  ? 2 : 0;
  const qc             = useQueryClient();

  const isNew  = !scheduleId || scheduleId === 'new';
  const isView = !isNew;

  const [form,     setForm]     = useState<FormState>({ ...EMPTY_FORM });
  const [error,    setError]    = useState('');
  const [saving,   setSaving]   = useState(false);
  const [activeTab, setActiveTab] = useState(initialTab);
  const [histOpen, setHistOpen] = useState(false);

  // Action dialogs
  const [dialog, setDialog] = useState<
    null | 'reschedule' | 'changeOt' | 'changeTeam' | 'postpone' | 'cancel'
  >(null);
  const [dlgOtRoom,   setDlgOtRoom]   = useState('');
  const [dlgTeam,     setDlgTeam]     = useState({
    primarySurgeonId: '', coSurgeonId: '', anaesthetistId: '',
    assistantDoctorIds: [] as string[], otherPersonnel: '',
  });
  const [dlgNewDate,  setDlgNewDate]  = useState('');
  const [dlgTime,     setDlgTime]     = useState('');
  const [dlgDuration, setDlgDuration] = useState(60);

  // Master data
  const { data: surgeons      = [] } = useSurgeons();
  const { data: anaesthetists = [] } = useAnaesthetists();
  const { data: otRooms       = [] } = useOtRooms();
  const { data: assistants    = [] } = useAssistants();

  // Existing schedule
  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn:  () => schedApi.getSchedule(scheduleId!),
    enabled:  isView,
  });

  // Surgery info
  const surgeryId = isView ? existing?.surgeryId : surgeryIdParam;
  const { data: surgery } = useQuery({
    queryKey: ['surgery', surgeryId],
    queryFn:  () => surgeriesApi.getSurgery(surgeryId!),
    enabled:  !!surgeryId,
  });

  // Populate form
  useEffect(() => {
    if (!existing) return;
    setForm({
      plannedDate:         (existing.plannedDate ?? '').slice(0, 10),
      plannedStartTime:    (existing.plannedStartTime ?? '').slice(0, 5),
      expectedDurationMin: existing.expectedDurationMin ?? 60,
      otRoomId:            existing.otRoomId ?? '',
      priority:            existing.priority ?? 'ROUTINE',
      primarySurgeonId:    existing.primarySurgeonId ?? '',
      coSurgeonId:         existing.coSurgeonId ?? '',
      anaesthetistId:      existing.anaesthetistId ?? '',
      assistantDoctorIds:  existing.assistantDoctors?.map((a: any) => a.assistantId) ?? [],
      otherPersonnel:      existing.otherPersonnel ?? '',
    });
  }, [existing]);

  const setF = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm(f => ({ ...f, [k]: v }));
  }, []);

  function invalidate() {
    qc.invalidateQueries({ queryKey: ['schedule', scheduleId] });
    qc.invalidateQueries({ queryKey: ['schedule-history', scheduleId] });
    qc.invalidateQueries({ queryKey: ['surgery-checklist', surgeryId] });
    if (surgeryId) qc.invalidateQueries({ queryKey: ['surgery', surgeryId] });
  }

  const status   = existing?.status as ScheduleStatus | undefined;
  const isLocked = status === 'COMPLETED' || status === 'CANCELLED';
  const canAct   = isView && !isLocked;

  if (isView && loadingExisting) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <Box>
          <Button
            startIcon={<ArrowBackIcon />} size="small" sx={{ mb: 1 }}
            onClick={() => navigate(-1)}
          >
            Back
          </Button>
          <PageHeader
            title={isNew ? 'OT Schedule' : `OT Schedule — ${existing?.surgeryNumber ?? ''}`}
            subtitle={
              isNew
                ? surgery
                  ? `${surgery.patient?.fullName ?? ''} · ${surgery.patient?.mrNumber ?? ''} · ${surgery.surgeryNumber ?? ''}`
                  : 'Loading…'
                : `${existing?.patientFullName ?? ''} · ${existing?.mrNumber ?? ''}`
            }
          />
        </Box>
        <Stack direction="row" spacing={1} alignItems="center">
          {status && (
            <Chip label={status} color={STATUS_COLOR[status]} size="small" sx={{ fontWeight: 700 }} />
          )}
          {existing?.priority && (
            <Chip
              label={PRIORITIES.find(p => p.value === existing.priority)?.label ?? existing.priority}
              color={PRIORITIES.find(p => p.value === existing.priority)?.color ?? 'default'}
              size="small"
            />
          )}
          {isView && (
            <Button
              size="small" variant="outlined" startIcon={<HistoryIcon />}
              onClick={() => setHistOpen(true)}
            >
              History
            </Button>
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {/* Tabs — only show on view mode */}
      {isView && (
        <Tabs
          value={activeTab}
          onChange={(_, v) => setActiveTab(v)}
          sx={{ mb: 3, borderBottom: 1, borderColor: 'divider' }}
        >
          <Tab label="OT Details" />
          <Tab label="Pre-Op Checklist" />
          <Tab label="Documentation" />
        </Tabs>
      )}

      {/* Tab 0: OT Details (also the only tab on create) */}
      {(activeTab === 0 || isNew) && (
        <OtDetailsTab
          form={form} setF={setF}
          existing={existing} surgery={surgery} surgeryId={surgeryId}
          navigate={navigate}
          isNew={isNew} isView={isView}
          isLocked={isLocked} canAct={canAct}
          saving={saving} setSaving={setSaving}
          error={error} setError={setError}
          scheduleId={scheduleId}
          otRooms={otRooms} surgeons={surgeons}
          anaesthetists={anaesthetists} assistants={assistants}
          onInvalidate={invalidate}
          dialog={dialog} setDialog={setDialog}
          dlgOtRoom={dlgOtRoom} setDlgOtRoom={setDlgOtRoom}
          dlgTeam={dlgTeam} setDlgTeam={setDlgTeam}
          dlgNewDate={dlgNewDate} setDlgNewDate={setDlgNewDate}
          dlgTime={dlgTime} setDlgTime={setDlgTime}
          dlgDuration={dlgDuration} setDlgDuration={setDlgDuration}
        />
      )}

      {/* Tab 1: Pre-Op Checklist */}
      {activeTab === 1 && isView && surgeryId && (
        <PreOpChecklistTab surgeryId={surgeryId} />
      )}

      {/* Tab 2: Documentation */}
      {activeTab === 2 && isView && surgeryId && (
        <DocumentationTab surgeryId={surgeryId} />
      )}

      {/* ── RESCHEDULE DIALOG ── */}
      <ReasonDialog
        open={dialog === 'reschedule'}
        title="Reschedule Surgery"
        label="Reason for rescheduling"
        confirmLabel="Reschedule"
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await schedApi.reschedule(scheduleId!, {
            reason,
            plannedDate:         dlgNewDate  || undefined,
            plannedStartTime:    dlgTime     ? dlgTime + ':00' : undefined,
            expectedDurationMin: dlgDuration || undefined,
          });
          invalidate();
        }}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <DateInput label="New Date (optional)" value={dlgNewDate}
              onChange={setDlgNewDate} size="small" fullWidth />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField label="New Start Time" type="time" size="small" fullWidth
              value={dlgTime} onChange={e => setDlgTime(e.target.value)}
              InputLabelProps={{ shrink: true }} inputProps={{ step: 300 }} />
          </Grid>
          <Grid item xs={12} sm={3}>
            <TextField label="Duration (min)" type="number" size="small" fullWidth
              value={dlgDuration} onChange={e => setDlgDuration(parseInt(e.target.value) || 60)} />
          </Grid>
        </Grid>
      </ReasonDialog>

      {/* ── CHANGE OT DIALOG ── */}
      <ReasonDialog
        open={dialog === 'changeOt'}
        title="Change OT Room"
        label="Reason for OT change"
        confirmLabel="Change OT"
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          if (!dlgOtRoom) throw new Error('Select an OT Room');
          await schedApi.changeOt(scheduleId!, { reason, otRoomId: dlgOtRoom });
          invalidate();
        }}
      >
        <TextField label="New OT Room" select size="small" fullWidth
          value={dlgOtRoom} onChange={e => setDlgOtRoom(e.target.value)}>
          <MenuItem value="">— Select OT Room —</MenuItem>
          {otRooms.map((r: any) => (
            <MenuItem key={r.otRoomId} value={r.otRoomId}>{r.roomName} ({r.roomCode})</MenuItem>
          ))}
        </TextField>
      </ReasonDialog>

      {/* ── CHANGE TEAM DIALOG ── */}
      <ReasonDialog
        open={dialog === 'changeTeam'}
        title="Change Surgical Team"
        label="Reason for team change"
        confirmLabel="Update Team"
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await schedApi.changeTeam(scheduleId!, { reason, ...dlgTeam });
          invalidate();
        }}
      >
        <Grid container spacing={2}>
          <Grid item xs={12} sm={6}>
            <TextField label="Primary Surgeon" select size="small" fullWidth
              value={dlgTeam.primarySurgeonId}
              onChange={e => setDlgTeam(t => ({ ...t, primarySurgeonId: e.target.value }))}>
              <MenuItem value="">— Select —</MenuItem>
              {surgeons.map((s: any) => <MenuItem key={s.surgeonId} value={s.surgeonId}>{s.fullName}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Co-Surgeon" select size="small" fullWidth
              value={dlgTeam.coSurgeonId}
              onChange={e => setDlgTeam(t => ({ ...t, coSurgeonId: e.target.value }))}>
              <MenuItem value="">— None —</MenuItem>
              {surgeons.map((s: any) => <MenuItem key={s.surgeonId} value={s.surgeonId}>{s.fullName}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <TextField label="Anaesthetist" select size="small" fullWidth
              value={dlgTeam.anaesthetistId}
              onChange={e => setDlgTeam(t => ({ ...t, anaesthetistId: e.target.value }))}>
              <MenuItem value="">— Select —</MenuItem>
              {anaesthetists.map((a: any) => <MenuItem key={a.anaesthetistId} value={a.anaesthetistId}>{a.fullName}</MenuItem>)}
            </TextField>
          </Grid>
          <Grid item xs={12} sm={6}>
            <Autocomplete
              multiple size="small"
              options={assistants}
              getOptionLabel={(a: any) => a.fullName}
              value={assistants.filter((a: any) => dlgTeam.assistantDoctorIds.includes(a.assistantId))}
              onChange={(_: any, selected: any[]) =>
                setDlgTeam(t => ({ ...t, assistantDoctorIds: selected.map((a: any) => a.assistantId) }))
              }
              renderInput={(params: any) => <TextField {...params} label="Assistants" size="small" fullWidth />}
            />
          </Grid>
          <Grid item xs={12}>
            <TextField label="Other Personnel" size="small" fullWidth multiline rows={2}
              value={dlgTeam.otherPersonnel}
              onChange={e => setDlgTeam(t => ({ ...t, otherPersonnel: e.target.value }))} />
          </Grid>
        </Grid>
      </ReasonDialog>

      {/* ── POSTPONE DIALOG ── */}
      <ReasonDialog
        open={dialog === 'postpone'}
        title="Postpone Surgery"
        label="Reason for postponement"
        confirmLabel="Postpone"
        confirmColor="warning"
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await schedApi.postponeSchedule(scheduleId!, { reason, newDate: dlgNewDate || undefined });
          invalidate();
        }}
      >
        <DateInput label="New Date (optional)" value={dlgNewDate}
          onChange={setDlgNewDate} size="small" fullWidth />
      </ReasonDialog>

      {/* ── CANCEL DIALOG ── */}
      <ReasonDialog
        open={dialog === 'cancel'}
        title="Cancel Schedule"
        label="Reason for cancellation"
        confirmLabel="Cancel Schedule"
        confirmColor="error"
        onClose={() => setDialog(null)}
        onConfirm={async (reason) => {
          await schedApi.cancelSchedule(scheduleId!, { reason });
          invalidate();
        }}
      />

      {/* ── HISTORY DIALOG ── */}
      <Dialog open={histOpen} onClose={() => setHistOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>Schedule History — {existing?.surgeryNumber}</DialogTitle>
        <DialogContent sx={{ minHeight: 200 }}>
          {scheduleId && <HistoryPanel scheduleId={scheduleId} />}
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
