/**
 * Surgery Entry — Module 2
 * Workflow: DRAFT → PLANNED (Submit for Budget) → existing SurgeryBudgetPage
 */
import { useState, useEffect } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Grid, TextField, MenuItem, Button, Alert, Typography,
  Stack, Chip, Paper, Divider, CircularProgress,
  Dialog, DialogTitle, DialogContent, DialogActions,
} from '@mui/material';
import SaveIcon from '@mui/icons-material/Save';
import SendIcon from '@mui/icons-material/Send';
import HistoryIcon from '@mui/icons-material/History';
import CancelIcon from '@mui/icons-material/Cancel';
import ArrowForwardIcon from '@mui/icons-material/ArrowForward';
import { PageHeader } from '@/components/common/PageHeader';
import { DateInput } from '@/components/common/DateInput';
import * as surgeriesApi from '@/api/surgeries.api';
import { listPatients } from '@/api/masters.api';
import { getErrorMessage } from '@/api/client';
import { StatusChip } from '@/components/common/StatusChip';
import {
  useSurgeons, useSurgeryTypes, useDepartments,
  useAnaesthetists, useOtRooms,
} from '@/hooks/useMasterData';
import { formatDate } from '@/utils/format';
import type { Surgery, SurgeryStatus } from '@/api/types';

const MAIN_BRANCH = '00000000-0000-0000-0000-000000000001';
const SIDE_OPTIONS = ['Left','Right','Bilateral','Not Applicable','To be decided'];


const EMPTY: Partial<Surgery> & Record<string, unknown> = {
  patientId: '', surgeonId: '', surgeryTypeId: '', departmentId: '',
  anaesthetistId: '', ipOp: 'OP', admissionNumber: '',
  diagnosis: '', plannedProcedure: '', sideSite: '', clinicalNotes: '',
  planDate: '', scheduledDate: '', surgeryDate: '', technicianType: '',
};

export function SurgeryEntryPage() {
  const navigate = useNavigate();
  const { id } = useParams<{ id?: string }>();
  const location = useLocation();
  const qc = useQueryClient();
  const isEdit = !!id && id !== 'new';

  const [form, setForm] = useState({ ...EMPTY });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [cancelReason, setCancelReason] = useState('');
  const [historyOpen, setHistoryOpen] = useState(false);

  // Pre-fill patient from navigation state (coming from PatientEntryPage)
  useEffect(() => {
    if (!isEdit && location.state?.patientId) {
      setForm((f) => ({ ...f, patientId: location.state.patientId }));
    }
  }, [isEdit, location.state]);

  const { data: existing, isLoading: loadingExisting } = useQuery({
    queryKey: ['surgery', id],
    queryFn: () => surgeriesApi.getSurgery(id!),
    enabled: isEdit,
  });

  useEffect(() => {
    if (existing) {
      setForm({
        patientId: existing.patientId ?? '',
        surgeonId: existing.surgeonId ?? '',
        surgeryTypeId: existing.surgeryTypeId ?? '',
        departmentId: existing.departmentId ?? '',
        anaesthetistId: existing.anaesthetistId ?? '',
        ipOp: existing.ipOp ?? 'OP',
        admissionNumber: existing.admissionNumber ?? '',
        diagnosis: existing.diagnosis ?? '',
        plannedProcedure: existing.plannedProcedure ?? '',
        sideSite: existing.sideSite ?? '',
        clinicalNotes: existing.clinicalNotes ?? '',
        planDate: existing.planDate ?? '',
        scheduledDate: existing.scheduledDate ?? '',
        surgeryDate: existing.surgeryDate ?? '',
        technicianType: existing.technicianType ?? '',
      });
    }
  }, [existing]);

  const { data: patients = [] } = useQuery({
    queryKey: ['patients'],
    queryFn: () => listPatients({ limit: 500, isActive: 'true' }),
    staleTime: 0, // always refetch so newly-registered patients appear immediately
  });
  const { data: surgeons = [] } = useSurgeons();
  const { data: surgeryTypes = [] } = useSurgeryTypes();
  const { data: departments = [] } = useDepartments();
  const { data: anaesthetists = [] } = useAnaesthetists();

  const isLocked = isEdit && (existing?.status === 'COMPLETED' || existing?.status === 'DELETED');
  const canEdit  = !isEdit || ['DRAFT','PLANNED'].includes(existing?.status ?? '');
  const canCancel = isEdit && !['COMPLETED','DELETED','CANCELLED'].includes(existing?.status ?? '');

  function set(k: string, v: unknown) { setForm((f) => ({ ...f, [k]: v })); }

  const createMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => surgeriesApi.createSurgery(data),
    onSuccess: (s) => {
      qc.invalidateQueries({ queryKey: ['surgeries'] });
      navigate(`/surgeries/${s.surgeryId}`, { replace: true });
    },
  });

  const updateMut = useMutation({
    mutationFn: (data: Record<string, unknown>) => surgeriesApi.updateSurgery(id!, data),
    onSuccess: () => { qc.invalidateQueries({ queryKey: ['surgery', id] }); },
  });

  const statusMut = useMutation({
    mutationFn: ({ status, notes }: { status: SurgeryStatus; notes?: string }) =>
      surgeriesApi.changeSurgeryStatus(id!, status, notes),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['surgery', id] });
      qc.invalidateQueries({ queryKey: ['surgeries'] });
    },
  });

  function buildPayload() {
    return {
      branchId: MAIN_BRANCH,
      patientId: form.patientId,
      surgeonId: form.surgeonId,
      surgeryTypeId: form.surgeryTypeId,
      departmentId: form.departmentId || undefined,
      anaesthetistId: form.anaesthetistId || undefined,
      ipOp: form.ipOp,
      admissionNumber: form.admissionNumber || undefined,
      diagnosis: form.diagnosis || undefined,
      plannedProcedure: form.plannedProcedure || undefined,
      sideSite: form.sideSite || undefined,
      clinicalNotes: form.clinicalNotes || undefined,
      technicianType: form.technicianType || undefined,
      planDate: form.planDate || undefined,
      scheduledDate: form.scheduledDate || undefined,
      surgeryDate: form.surgeryDate || undefined,
      // defaults so existing budget page still works
      budgetSurgeonFee: 0, budgetAssistantCost: 0, budgetAnaesthetistFee: 0,
      budgetOtCost: 0, budgetConsumables: 0, budgetPharmacy: 0, budgetMiscellaneous: 0,
    };
  }

  async function handleSaveDraft() {
    if (!form.patientId || !form.surgeonId || !form.surgeryTypeId) {
      setError('Patient, Consultant, and Procedure are required'); return;
    }
    setSaving(true); setError('');
    try {
      if (isEdit) { await updateMut.mutateAsync(buildPayload()); }
      else        { await createMut.mutateAsync(buildPayload()); }
    } catch (e: unknown) {
      setError(getErrorMessage(e));
    } finally { setSaving(false); }
  }

  async function handleSubmitForBudget() {
    if (!isEdit) { await handleSaveDraft(); return; }
    try {
      await statusMut.mutateAsync({ status: 'PLANNED' });
      navigate(`/surgeries/${id}`);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Submit failed');
    }
  }

  async function handleCancel() {
    if (!cancelReason.trim()) return;
    try {
      await statusMut.mutateAsync({ status: 'CANCELLED', notes: cancelReason });
      setCancelDialogOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Cancel failed');
    }
  }

  if (isEdit && loadingExisting) {
    return <Box sx={{ display: 'flex', justifyContent: 'center', py: 8 }}><CircularProgress /></Box>;
  }

  const status = existing?.status as SurgeryStatus | undefined;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <PageHeader
          title={isEdit ? `Surgery Entry — ${existing?.surgeryNumber ?? id?.slice(0,8)}` : 'New Surgery Entry'}
          subtitle={isEdit ? `Patient: ${existing?.patient?.fullName} · ${existing?.patient?.mrNumber}` : 'Register a new surgical case'}
        />
        <Stack direction="row" spacing={1} alignItems="center">
          {status && (
            <StatusChip status={status} />
          )}
          {isEdit && (
            <Button startIcon={<HistoryIcon />} size="small" variant="outlined" onClick={() => setHistoryOpen(true)}>
              History
            </Button>
          )}
        </Stack>
      </Stack>

      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}

      {existing?.surgeryNumber && (
        <Paper variant="outlined" sx={{ p: 2, mb: 3, display: 'flex', alignItems: 'center', gap: 2 }}>
          <Typography variant="body2" color="text.secondary">Surgery ID</Typography>
          <Typography variant="h6" sx={{ fontWeight: 700, fontFamily: 'monospace' }}>{existing.surgeryNumber}</Typography>
          {status === 'PLANNED' && (
            <>
              <Button variant="outlined" size="small" endIcon={<ArrowForwardIcon />} onClick={() => navigate(`/surgeries/${id}`)}>
                Open Budget
              </Button>
              <Button variant="contained" size="small" color="secondary" onClick={() => navigate(`/scheduling/new?surgeryId=${id}`)}>
                Schedule Surgery
              </Button>
            </>
          )}
        </Paper>
      )}

      <Grid container spacing={2.5}>
        {/* Patient */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Patient Details</Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Select Patient" required select fullWidth size="small"
            value={form.patientId} onChange={(e) => set('patientId', e.target.value)}
            disabled={isLocked || !canEdit}
          >
            <MenuItem value="">— Select Patient —</MenuItem>
            {patients.map((p) => (
              <MenuItem key={p.patientId} value={p.patientId}>{p.fullName} · {p.mrNumber}</MenuItem>
            ))}
          </TextField>
        </Grid>
        {/* Show patient details once selected */}
        {form.patientId && (() => {
          const sel = patients.find((p) => p.patientId === form.patientId);
          if (!sel) return null;
          return (
            <Grid item xs={12} sm={6}>
              <Paper variant="outlined" sx={{ p: 1.5, bgcolor: 'action.hover' }}>
                <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap>
                  <Typography variant="body2"><strong>MR#:</strong> {sel.mrNumber}</Typography>
                  <Typography variant="body2"><strong>Name:</strong> {sel.fullName}</Typography>
                  {sel.gender && <Typography variant="body2"><strong>Gender:</strong> {sel.gender}</Typography>}
                  {sel.dateOfBirth && <Typography variant="body2"><strong>DOB:</strong> {formatDate(sel.dateOfBirth)}</Typography>}
                  {sel.phone && <Typography variant="body2"><strong>Phone:</strong> {sel.phone}</Typography>}
                  {sel.bloodGroup && <Typography variant="body2"><strong>Blood:</strong> {sel.bloodGroup}</Typography>}
                </Stack>
              </Paper>
            </Grid>
          );
        })()}
        <Grid item xs={12} sm={3}>
          <TextField
            label="IP / OP" select fullWidth size="small"
            value={form.ipOp ?? 'OP'} onChange={(e) => set('ipOp', e.target.value)}
            disabled={isLocked || !canEdit}
          >
            <MenuItem value="OP">OP (Out-Patient)</MenuItem>
            <MenuItem value="IP">IP (In-Patient)</MenuItem>
          </TextField>
        </Grid>
        {form.ipOp === 'IP' && (
          <Grid item xs={12} sm={3}>
            <TextField label="Admission Number" fullWidth size="small" value={form.admissionNumber ?? ''}
              onChange={(e) => set('admissionNumber', e.target.value)} disabled={isLocked || !canEdit} />
          </Grid>
        )}

        {/* Technician type — full-width row directly below IP / OP */}
        <Grid item xs={12}>
          <TextField
            label="Technician" select fullWidth size="small"
            value={form.technicianType ?? ''}
            onChange={(e) => set('technicianType', e.target.value)}
            disabled={isLocked || !canEdit}
          >
            <MenuItem value="">— Select Technician Type —</MenuItem>
            <MenuItem value="IN_HOUSE">In-house</MenuItem>
            <MenuItem value="OUTSOURCED">Outsourced</MenuItem>
          </TextField>
        </Grid>

        <Grid item xs={12}><Divider /></Grid>

        {/* Clinical */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Clinical Information</Typography>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Consultant / Treating Doctor" required select fullWidth size="small"
            value={form.surgeonId} onChange={(e) => set('surgeonId', e.target.value)}
            disabled={isLocked || !canEdit}
          >
            <MenuItem value="">— Select —</MenuItem>
            {surgeons.map((s) => <MenuItem key={s.surgeonId} value={s.surgeonId}>{s.fullName}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Department" select fullWidth size="small"
            value={form.departmentId ?? ''} onChange={(e) => set('departmentId', e.target.value)}
            disabled={isLocked || !canEdit}
          >
            <MenuItem value="">— Select —</MenuItem>
            {departments.map((d) => <MenuItem key={d.departmentId} value={d.departmentId}>{d.departmentName}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Planned Procedure" required select fullWidth size="small"
            value={form.surgeryTypeId} onChange={(e) => set('surgeryTypeId', e.target.value)}
            disabled={isLocked || !canEdit}
          >
            <MenuItem value="">— Select Procedure —</MenuItem>
            {surgeryTypes.map((t) => <MenuItem key={t.surgeryTypeId} value={t.surgeryTypeId}>{t.name}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField
            label="Anaesthetist" select fullWidth size="small"
            value={form.anaesthetistId ?? ''} onChange={(e) => set('anaesthetistId', e.target.value)}
            disabled={isLocked || !canEdit}
          >
            <MenuItem value="">— Select —</MenuItem>
            {anaesthetists.map((a) => <MenuItem key={a.anaesthetistId} value={a.anaesthetistId}>{a.fullName}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12}>
          <TextField label="Diagnosis" fullWidth size="small" multiline rows={2}
            value={form.diagnosis ?? ''} onChange={(e) => set('diagnosis', e.target.value)}
            disabled={isLocked || !canEdit} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Procedure (free text / details)" fullWidth size="small"
            value={form.plannedProcedure ?? ''} onChange={(e) => set('plannedProcedure', e.target.value)}
            disabled={isLocked || !canEdit} />
        </Grid>
        <Grid item xs={12} sm={6}>
          <TextField label="Side / Site" select fullWidth size="small"
            value={form.sideSite ?? ''} onChange={(e) => set('sideSite', e.target.value)}
            disabled={isLocked || !canEdit}
          >
            <MenuItem value="">— Select —</MenuItem>
            {SIDE_OPTIONS.map((s) => <MenuItem key={s} value={s}>{s}</MenuItem>)}
          </TextField>
        </Grid>
        <Grid item xs={12}>
          <TextField label="Clinical Notes" fullWidth size="small" multiline rows={3}
            value={form.clinicalNotes ?? ''} onChange={(e) => set('clinicalNotes', e.target.value)}
            disabled={isLocked || !canEdit} />
        </Grid>


        <Grid item xs={12}><Divider /></Grid>

        {/* Dates */}
        <Grid item xs={12}>
          <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>Dates</Typography>
        </Grid>
        <Grid item xs={12} sm={4}>
          <DateInput label="Surgery Plan Date" value={form.planDate as string} onChange={(v) => set('planDate', v)} size="small" fullWidth disabled={isLocked || !canEdit} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <DateInput label="Scheduled Date" value={form.scheduledDate as string} onChange={(v) => set('scheduledDate', v)} size="small" fullWidth disabled={isLocked || !canEdit} />
        </Grid>
        <Grid item xs={12} sm={4}>
          <DateInput label="Surgery Date" value={form.surgeryDate as string} onChange={(v) => set('surgeryDate', v)} size="small" fullWidth disabled={isLocked || !canEdit} />
        </Grid>
      </Grid>

      {/* OT Schedule Info — readonly, populated after OT Scheduling */}
      {isEdit && existing?.otScheduleId && (
        <>
          <Grid item xs={12}><Divider /></Grid>
          <Grid item xs={12}>
            <Typography variant="subtitle2" color="text.secondary" sx={{ mb: 1, textTransform: 'uppercase', letterSpacing: 0.5 }}>
              OT Schedule
            </Typography>
          </Grid>
          <Grid item xs={12}>
            <Paper
              variant="outlined"
              sx={{
                p: 2,
                bgcolor: existing.otScheduleStatus === 'CANCELLED' ? 'error.50' : 'action.hover',
                borderColor: existing.otScheduleStatus === 'CANCELLED' ? 'error.light' : 'divider',
              }}
            >
              <Stack direction="row" spacing={2} flexWrap="wrap" useFlexGap alignItems="center">
                <Chip
                  label={existing.otScheduleStatus ?? 'DRAFT'}
                  color={
                    existing.otScheduleStatus === 'CONFIRMED' ? 'success'
                    : existing.otScheduleStatus === 'CANCELLED' ? 'error'
                    : existing.otScheduleStatus === 'POSTPONED' ? 'warning'
                    : 'default'
                  }
                  size="small"
                  sx={{ fontWeight: 700 }}
                />
                {existing.otScheduleRoom && (
                  <Typography variant="body2">
                    <strong>OT Room:</strong> {existing.otScheduleRoom.roomName} ({existing.otScheduleRoom.roomCode})
                  </Typography>
                )}
                {existing.otPlannedDate && (
                  <Typography variant="body2">
                    <strong>Date:</strong> {formatDate(existing.otPlannedDate)}
                  </Typography>
                )}
                {existing.otPlannedStartTime && (
                  <Typography variant="body2">
                    <strong>In Time:</strong> {existing.otPlannedStartTime.slice(0, 5)}
                  </Typography>
                )}
                {existing.otPlannedEndTime && (
                  <Typography variant="body2">
                    <strong>Out Time:</strong> {existing.otPlannedEndTime.slice(0, 5)}
                  </Typography>
                )}
                {existing.otExpectedDurationMin && (
                  <Typography variant="body2">
                    <strong>Duration:</strong> {existing.otExpectedDurationMin} min
                  </Typography>
                )}
                <Button
                  size="small"
                  variant="outlined"
                  onClick={() => navigate(`/scheduling/${existing.otScheduleId}`)}
                  sx={{ ml: 'auto' }}
                >
                  View Schedule
                </Button>
              </Stack>
            </Paper>
          </Grid>
        </>
      )}

      {/* Actions */}
      <Stack direction="row" spacing={2} sx={{ mt: 4 }} justifyContent="flex-end">
        {canCancel && (
          <Button color="error" startIcon={<CancelIcon />} onClick={() => setCancelDialogOpen(true)}>
            Cancel Case
          </Button>
        )}
        {canEdit && (
          <Button variant="outlined" startIcon={<SaveIcon />} onClick={handleSaveDraft} disabled={saving}>
            {saving ? 'Saving…' : 'Save Draft'}
          </Button>
        )}
        {isEdit && status === 'DRAFT' && (
          <Button variant="contained" startIcon={<SendIcon />} onClick={handleSubmitForBudget} disabled={saving}
            color="primary">
            Submit for Budget →
          </Button>
        )}
        {isEdit && status === 'PLANNED' && (
          <>
            <Button variant="contained" endIcon={<ArrowForwardIcon />} onClick={() => navigate(`/surgeries/${id}`)}>
              Open Budget
            </Button>
            <Button variant="outlined" onClick={() => navigate(`/scheduling/new?surgeryId=${id}`)}>
              Schedule Surgery
            </Button>
          </>
        )}
        {!isEdit && (
          <Button variant="contained" startIcon={<SaveIcon />} onClick={handleSaveDraft} disabled={saving}>
            {saving ? 'Creating…' : 'Create Surgery'}
          </Button>
        )}
      </Stack>

      {/* Cancel Dialog */}
      <Dialog open={cancelDialogOpen} onClose={() => setCancelDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Cancel Surgery Case</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          <TextField
            label="Cancellation Reason" required fullWidth multiline rows={3}
            value={cancelReason} onChange={(e) => setCancelReason(e.target.value)}
            placeholder="Provide a reason for cancellation…"
          />
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setCancelDialogOpen(false)}>Back</Button>
          <Button variant="contained" color="error" onClick={handleCancel} disabled={!cancelReason.trim()}>
            Confirm Cancel
          </Button>
        </DialogActions>
      </Dialog>

      {/* Status History Dialog */}
      <Dialog open={historyOpen} onClose={() => setHistoryOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>Status History — {existing?.surgeryNumber}</DialogTitle>
        <DialogContent>
          <StatusHistory surgeryId={id} />
        </DialogContent>
        <DialogActions>
          <Button onClick={() => setHistoryOpen(false)}>Close</Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ─── Status History sub-component ────────────────────────────────────────────
function StatusHistory({ surgeryId }: { surgeryId?: string }) {
  const { data, isLoading } = useQuery({
    queryKey: ['surgery-history', surgeryId],
    queryFn: () => surgeriesApi.getSurgeryHistory(surgeryId!),
    enabled: !!surgeryId,
  });

  if (isLoading) return <CircularProgress size={20} />;
  const rows = Array.isArray(data) ? data : [];

  if (rows.length === 0) return <Typography color="text.secondary">No status changes recorded.</Typography>;

  return (
    <Stack spacing={1} sx={{ mt: 1 }}>
      {rows.map((rawRow: unknown, i: number) => {
        const r = rawRow as { fromStatus?: string; toStatus?: string; changedAt?: string; notes?: string };
        return (
          <Box key={i} sx={{ p: 1.5, border: '1px solid', borderColor: 'divider', borderRadius: 1 }}>
            <Stack direction="row" spacing={1} alignItems="center">
              {r.fromStatus && <Chip label={r.fromStatus} size="small" />}
              {r.fromStatus && <ArrowForwardIcon fontSize="small" />}
              <Chip label={r.toStatus ?? '—'} size="small" color="primary" />
              <Typography variant="caption" color="text.secondary" sx={{ ml: 'auto' }}>
                {r.changedAt ? formatDate(r.changedAt) : ''}
              </Typography>
            </Stack>
            {r.notes && <Typography variant="body2" sx={{ mt: 0.5 }}>{r.notes}</Typography>}
          </Box>
        );
      })}
    </Stack>
  );
}
