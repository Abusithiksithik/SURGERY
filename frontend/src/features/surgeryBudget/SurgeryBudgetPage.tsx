import { useEffect, useMemo, useRef, useState } from 'react';
import { useNavigate, useParams, useLocation } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Grid, Stack, TextField, MenuItem, Button, Autocomplete, Divider,
  Typography, Chip, Alert, Dialog, DialogTitle, DialogContent,
  DialogContentText, DialogActions,
} from '@mui/material';
import { Add, ArrowBack, Save } from '@mui/icons-material';
import { PageHeader } from '@/components/common/PageHeader';
import { SectionCard } from '@/components/common/SectionCard';
import { StatusChip } from '@/components/common/StatusChip';
import { ConfirmDialog } from '@/components/common/ConfirmDialog';
import { LoadingState } from '@/components/common/AsyncStates';
import { RecommendationPanel } from './RecommendationPanel';
import { NewPatientDialog } from './NewPatientDialog';
import { OverrideReasonDialog, type OverridePrompt } from './OverrideReasonDialog';
import { DateInput } from '@/components/common/DateInput';
import { useSurgeons, useSurgeryTypes, useAnaesthetists, useDepartments, useBranches, useOtRooms } from '@/hooks/useMasterData';
import * as surgeriesApi from '@/api/surgeries.api';
import * as mastersApi from '@/api/masters.api';
import * as recommendationsApi from '@/api/recommendations.api';
import { getErrorMessage } from '@/api/client';
import { useAuth } from '@/auth/AuthContext';
import { formatCurrency } from '@/utils/format';
import type { Patient, SurgeryStatus } from '@/api/types';
import { ALLOWED_TRANSITIONS_HINT, STATUS_ACTION_LABELS, BUDGET_LOCKED_STATUSES, APPROVAL_ACTIONS } from './constants';

const BUDGET_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'budgetSurgeonFee', label: 'Surgeon Fee' },
  { key: 'budgetAssistantCost', label: 'Assistant Cost' },
  { key: 'budgetAnaesthetistFee', label: 'Anaesthetist Fee' },
  { key: 'budgetOtCost', label: 'OT Cost' },
  { key: 'budgetConsumables', label: 'Consumables' },
  { key: 'budgetPharmacy', label: 'Pharmacy' },
  { key: 'budgetMiscellaneous', label: 'Miscellaneous' },
];

const ACTUAL_FIELDS: Array<{ key: string; label: string }> = [
  { key: 'actualSurgeonFee', label: 'Surgeon Fee' },
  { key: 'actualAssistantCost', label: 'Assistant Cost' },
  { key: 'actualAnaesthetistFee', label: 'Anaesthetist Fee' },
  { key: 'actualOtCost', label: 'OT Cost' },
  { key: 'actualConsumables', label: 'Consumables' },
  { key: 'actualPharmacy', label: 'Pharmacy' },
  { key: 'actualMiscellaneous', label: 'Miscellaneous' },
];

const FIELD_LABELS: Record<string, string> = Object.fromEntries(BUDGET_FIELDS.map((f) => [f.key, f.label]));

const SIDE_SITE_OPTIONS = ['Left', 'Right', 'Bilateral', 'Midline', 'Not Applicable'];

// ── Cancel Reason Dialog ────────────────────────────────────────────────────────
function CancelReasonDialog({
  open, onClose, onConfirm, loading,
}: {
  open: boolean; onClose: () => void;
  onConfirm: (reason: string) => void;
  loading: boolean;
}) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState('');

  useEffect(() => { if (open) { setReason(''); setErr(''); } }, [open]);

  function handle() {
    if (!reason.trim()) { setErr('Cancellation reason is required.'); return; }
    onConfirm(reason.trim());
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>Cancel Surgery — Reason Required</DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        {err && <Alert severity="error" sx={{ mb: 2 }}>{err}</Alert>}
        <DialogContentText sx={{ mb: 2 }}>
          Please provide a mandatory reason for cancelling this surgery. This will be saved against the record.
        </DialogContentText>
        <TextField
          label="Cancellation Reason"
          multiline rows={3} fullWidth required
          value={reason}
          onChange={(e) => setReason(e.target.value)}
          placeholder="Enter reason for cancellation…"
          error={!!err}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={loading}>Back</Button>
        <Button variant="contained" color="error" onClick={handle} disabled={loading || !reason.trim()}>
          {loading ? 'Cancelling…' : 'Confirm Cancellation'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// Prevent accidental scroll-wheel changes on focused number inputs
const blockWheel = (e: { target: EventTarget }) => {
  (e.target as HTMLElement).blur();
};

export function SurgeryBudgetPage() {
  const { id } = useParams();
  const isEdit = !!id;
  const navigate = useNavigate();
  const location = useLocation();
  const queryClient = useQueryClient();
  const { hasPermission } = useAuth();
  const topRef = useRef<HTMLDivElement>(null);

  const { data: surgeons, isLoading: surgeonsLoading } = useSurgeons();
  const { data: surgeryTypes, isLoading: surgeryTypesLoading } = useSurgeryTypes();
  const { data: anaesthetists, isLoading: anaesthetistsLoading } = useAnaesthetists();
  const { data: departments, isLoading: departmentsLoading } = useDepartments();
  const { data: branches, isLoading: branchesLoading } = useBranches();
  const { data: otRooms, isLoading: otRoomsLoading } = useOtRooms();
  const { data: clinicalStaff } = useQuery({ queryKey: ['masters', 'clinical-staff'], queryFn: () => mastersApi.staffCrud.list({ limit: 500 }) });

  const masterDataLoading = surgeonsLoading || surgeryTypesLoading || anaesthetistsLoading || departmentsLoading || branchesLoading || otRoomsLoading;

  const existingQuery = useQuery({
    queryKey: ['surgeries', id],
    queryFn: () => surgeriesApi.getSurgery(id!),
    enabled: isEdit,
  });

  const [form, setForm] = useState<Record<string, any>>({
    branchId: '', departmentId: '', patientId: '', surgeonId: '',
    anaesthetistId: '', surgeryTypeId: '', otRoomId: '',
    patientAgeYears: '', patientGender: 'UNKNOWN',
    surgeryDate: '',
    ipOp: 'OP', admissionNumber: '',
    diagnosis: '', plannedProcedure: '', sideSite: '', clinicalNotes: '', technicianType: '',
    comments: '',
    asaGrade: '', asaEmergency: false, comorbidities: '', pacDate: '', pacByStaffId: '',
    fitnessRemark: '', specialPrecautions: '', plannedOtType: '', payerType: 'SELF', payerName: '', payerReference: '', preauthAmount: '', hisUhid: '',
    budgetSurgeonFee: '', budgetAssistantCost: '', budgetAnaesthetistFee: '',
    budgetOtCost: '', budgetConsumables: '', budgetPharmacy: '', budgetMiscellaneous: '',
    actualSurgeonFee: '', actualAssistantCost: '', actualAnaesthetistFee: '',
    actualOtCost: '', actualConsumables: '', actualPharmacy: '', actualMiscellaneous: '',
    quotedPrice: '',
  });

  const [selectedPatient, setSelectedPatient] = useState<Patient | null>(null);
  const [patientSearch, setPatientSearch] = useState('');
  const [newPatientOpen, setNewPatientOpen] = useState(false);
  const [excludeOutliers, setExcludeOutliers] = useState(true);
  const [overrideReasons, setOverrideReasons] = useState<Record<string, string>>({});
  const [overridePrompt, setOverridePrompt] = useState<OverridePrompt | null>(null);
  const [statusConfirm, setStatusConfirm] = useState<SurgeryStatus | null>(null);
  const [cancelDialogOpen, setCancelDialogOpen] = useState(false);
  const [saveError, setSaveError] = useState<string | null>(null);

  // Auto-populate branchId for new surgery
  useEffect(() => {
    if (!isEdit && branches && branches.length > 0 && !form.branchId) {
      setForm((f) => ({ ...f, branchId: f.branchId || branches[0].branchId }));
    }
  }, [branches, isEdit]);

  // Pre-fill patientId from navigation state
  useEffect(() => {
    if (!isEdit && location.state?.patientId && !form.patientId) {
      setForm((f) => ({ ...f, patientId: location.state.patientId }));
    }
  }, [isEdit, location.state?.patientId]);

  // Hydrate form from existing surgery
  useEffect(() => {
    if (existingQuery.data) {
      const s = existingQuery.data;
      setForm((f) => ({
        ...f,
        branchId: s.branchId,
        departmentId: s.departmentId || '',
        patientId: s.patientId,
        surgeonId: s.surgeonId,
        anaesthetistId: s.anaesthetistId || '',
        surgeryTypeId: s.surgeryTypeId,
        otRoomId: s.otRoomId || '',
        patientAgeYears: s.patientAgeYears ?? '',
        patientGender: s.patientGender || 'UNKNOWN',
        asaGrade: s.asaGrade ?? '', asaEmergency: Boolean(s.asaEmergency), comorbidities: s.comorbidities ?? '',
        pacDate: s.pacDate?.slice(0,10) ?? '', pacByStaffId: s.pacByStaffId ?? '', fitnessRemark: s.fitnessRemark ?? '',
        specialPrecautions: s.specialPrecautions ?? '', plannedOtType: s.plannedOtType ?? '', payerType: s.payerType ?? 'SELF',
        payerName: s.payerName ?? '', payerReference: s.payerReference ?? '', preauthAmount: s.preauthAmount ?? '', hisUhid: s.hisUhid ?? '',
        surgeryDate: s.surgeryDate?.slice(0, 10) || '',
        ipOp: s.ipOp || 'OP',
        admissionNumber: s.admissionNumber || '',
        technicianType: s.technicianType || '',
        diagnosis: s.diagnosis || '',
        plannedProcedure: s.plannedProcedure || '',
        sideSite: s.sideSite || '',
        clinicalNotes: s.clinicalNotes || '',
        comments: s.comments || '',
        budgetSurgeonFee: s.budgetSurgeonFee,
        budgetAssistantCost: s.budgetAssistantCost,
        budgetAnaesthetistFee: s.budgetAnaesthetistFee,
        budgetOtCost: s.budgetOtCost,
        budgetConsumables: s.budgetConsumables,
        budgetPharmacy: s.budgetPharmacy,
        budgetMiscellaneous: s.budgetMiscellaneous,
        actualSurgeonFee: s.actualSurgeonFee ?? '',
        actualAssistantCost: s.actualAssistantCost ?? '',
        actualAnaesthetistFee: s.actualAnaesthetistFee ?? '',
        actualOtCost: s.actualOtCost ?? '',
        actualConsumables: s.actualConsumables ?? '',
        actualPharmacy: s.actualPharmacy ?? '',
        actualMiscellaneous: s.actualMiscellaneous ?? '',
        quotedPrice: s.quotedPrice ?? '',
      }));
      if (s.patient) setSelectedPatient(s.patient as Patient);
    }
  }, [existingQuery.data]);

  // Auto-fetch age/gender when patient selected
  function handlePatientSelect(patient: Patient | null) {
    setSelectedPatient(patient);
    if (patient) {
      // Compute age from date_of_birth
      let age: number | string = '';
      if (patient.dateOfBirth) {
        const dob = new Date(patient.dateOfBirth);
        const today = new Date();
        age = today.getFullYear() - dob.getFullYear();
        const m = today.getMonth() - dob.getMonth();
        if (m < 0 || (m === 0 && today.getDate() < dob.getDate())) age--;
      }
      setForm((f) => ({
        ...f,
        patientId: patient.patientId,
        branchId: patient.branchId || f.branchId,
        patientAgeYears: age,
        patientGender: patient.gender || 'UNKNOWN',
      }));
    } else {
      setForm((f) => ({ ...f, patientId: '', patientAgeYears: '', patientGender: 'UNKNOWN' }));
    }
  }

  // Auto-fetch department when surgery type selected
  function handleSurgeryTypeChange(surgeryTypeId: string) {
    const st = surgeryTypes?.find((t) => t.surgeryTypeId === surgeryTypeId);
    setForm((f) => ({
      ...f,
      surgeryTypeId,
      departmentId: st?.departmentId || f.departmentId,
    }));
  }

  const patientSearchQuery = useQuery({
    queryKey: ['patients', 'search', patientSearch],
    queryFn: () =>
      patientSearch.length >= 2
        ? mastersApi.listPatients({ search: patientSearch, limit: 50 })
        : mastersApi.listPatients({ limit: 200, isActive: 'true' }),
    staleTime: 0,
  });

  const prefilledPatientId = !isEdit ? (location.state?.patientId as string | undefined) : undefined;
  useEffect(() => {
    if (!prefilledPatientId || selectedPatient) return;
    const found = patientSearchQuery.data?.find((p: Patient) => p.patientId === prefilledPatientId);
    if (found) handlePatientSelect(found);
  }, [patientSearchQuery.data, prefilledPatientId]);

  // Only fire when both IDs look like real UUIDs — prevents 422 during partial form entry
  const isUuid = (v: string) => /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(v);
  const canRecommend = isUuid(form.surgeonId) && isUuid(form.surgeryTypeId);
  const recommendationQuery = useQuery({
    queryKey: ['recommendation', isEdit ? id : 'preview', form.surgeonId, form.surgeryTypeId, form.anaesthetistId, excludeOutliers],
    queryFn: () =>
      isEdit
        ? recommendationsApi.generateRecommendationForSurgery(id!, { excludeOutliers, persist: false })
        : recommendationsApi.previewRecommendation({
            surgeonId: form.surgeonId,
            surgeryTypeId: form.surgeryTypeId,
            anaesthetistId: form.anaesthetistId || undefined,
            patientAgeYears: form.patientAgeYears ? Number(form.patientAgeYears) : undefined,
            patientGender: form.patientGender !== 'UNKNOWN' ? form.patientGender : undefined,
            departmentId: form.departmentId || undefined,
            excludeOutliers,
          }),
    enabled: canRecommend,
  });

  function round(v: number | null | undefined) { return v == null ? 0 : Math.round(v * 100) / 100; }

  function applyAllFromRecommendation() {
    const overall = recommendationQuery.data?.overall;
    if (!overall) return;
    setForm((f) => ({
      ...f,
      budgetSurgeonFee: round(overall.recommendedSurgeonFee),
      budgetAssistantCost: round(overall.recommendedAssistantBudget),
      budgetAnaesthetistFee: round(overall.recommendedAnaesthetistBudget),
      budgetOtCost: round(overall.recommendedOTBudget),
      budgetConsumables: round(overall.recommendedConsumables),
      budgetPharmacy: round(overall.recommendedPharmacy),
      budgetMiscellaneous: round(overall.recommendedMiscellaneous),
      quotedPrice: round(overall.recommendedPatientQuote),
    }));
  }

  // --- Validation ---
  function validateForm(): string | null {
    // Core required fields (only checked on create — on edit they're immutable)
    if (!isEdit) {
      if (!isUuid(form.patientId))     return 'Please select a patient.';
      if (!isUuid(form.surgeonId))     return 'Please select a surgeon.';
      if (!isUuid(form.surgeryTypeId)) return 'Please select a surgery type / procedure.';
    }
    for (const f of BUDGET_FIELDS) {
      const v = Number(form[f.key]);
      if (!isNaN(v) && v < 0) return `${f.label} cannot be negative.`;
    }
    for (const f of ACTUAL_FIELDS) {
      const v = form[f.key];
      if (v !== '' && v !== null && v !== undefined && Number(v) < 0) return `${f.label} (Actual) cannot be negative.`;
    }
    return null;
  }

  // --- Save ---
  const saveMutation = useMutation({
    mutationFn: async () => {
      const err = validateForm();
      if (err) throw new Error(err);
      const payload = buildPayload(form, overrideReasons, isEdit);
      if (isEdit) return surgeriesApi.updateSurgery(id!, payload);
      return surgeriesApi.createSurgery(payload);
    },
    onSuccess: (surgery) => {
      queryClient.invalidateQueries({ queryKey: ['surgeries'] });
      setSaveError(null);
      setOverrideReasons({});
      if (!isEdit) {
        navigate(`/surgeries/${surgery.surgeryId}`);
      } else {
        existingQuery.refetch();
        // Scroll to top so user sees the updated header/status
        setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
      }
    },
    onError: (err: any) => {
      const details = err?.response?.data?.details;
      if (details?.field) {
        setOverridePrompt({
          field: details.field,
          fieldLabel: FIELD_LABELS[details.field] || details.field,
          recommendedValue: details.recommendedValue,
          newValue: details.newValue,
        });
      } else {
        setSaveError(err?.message || getErrorMessage(err));
      }
    },
  });

  const statusMutation = useMutation({
    mutationFn: (payload: { status: SurgeryStatus; cancelReason?: string }) =>
      surgeriesApi.changeSurgeryStatus(id!, payload.status, payload.cancelReason),
    onSuccess: () => {
      existingQuery.refetch();
      queryClient.invalidateQueries({ queryKey: ['surgeries'] });
      setStatusConfirm(null);
      setCancelDialogOpen(false);
      setTimeout(() => topRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 100);
    },
    onError: (err) => setSaveError(getErrorMessage(err)),
  });

  const currentStatus = existingQuery.data?.status;
  const isLocked = ['COMPLETED', 'CLOSED', 'CANCELLED', 'DELETED'].includes(currentStatus || '');
  const isBudgetLocked = BUDGET_LOCKED_STATUSES.has(currentStatus as any) || isLocked;

  const patientOptions = useMemo(() => {
    const base = patientSearchQuery.data || [];
    if (selectedPatient && !base.find((p) => p.patientId === selectedPatient.patientId)) {
      return [selectedPatient, ...base];
    }
    return base;
  }, [patientSearchQuery.data, selectedPatient]);

  if (isEdit && existingQuery.isLoading) return <LoadingState label="Loading surgery…" minHeight={400} />;
  if (masterDataLoading) return <LoadingState label="Loading master data…" minHeight={400} />;

  const nextStatuses = existingQuery.data ? (ALLOWED_TRANSITIONS_HINT[existingQuery.data.status] || []) : [];

  return (
    <>
      <div ref={topRef} />
      <PageHeader
        title={isEdit ? 'Edit Surgery Entry' : 'New Surgery Entry'}
        subtitle={
          isEdit && existingQuery.data
            ? `${existingQuery.data.surgeryType?.name ?? ''}${existingQuery.data.surgeryNumber ? ` · ${existingQuery.data.surgeryNumber}` : ''}`
            : 'Create a new surgery entry with AI-assisted budget recommendations'
        }
        actions={
          <>
            <Button startIcon={<ArrowBack />} onClick={() => navigate('/surgeries')} color="inherit">Back</Button>
            {isEdit && existingQuery.data && <StatusChip status={existingQuery.data.status} />}
          </>
        }
      />

      {saveError && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setSaveError(null)}>{saveError}</Alert>}
      {isLocked && <Alert severity="info" sx={{ mb: 2 }}>This surgery is <strong>{currentStatus}</strong> — no further edits are possible.</Alert>}

      <Grid container spacing={2.5}>
        <Grid item xs={12} md={8}>
          <Stack spacing={2.5}>

            {/* ── 1. CASE DETAILS ──────────────────────────────────────── */}
            <SectionCard title="Case Details">
              <Grid container spacing={2}>
                {/* Patient row with New Patient button beside dropdown */}
                <Grid item xs={12} sm={6}>
                  <Stack direction="row" spacing={1} alignItems="flex-start">
                    <Autocomplete
                      sx={{ flex: 1 }}
                      options={patientOptions}
                      getOptionLabel={(p) => `${p.fullName} (${p.mrNumber})`}
                      value={selectedPatient}
                      onChange={(_, v) => handlePatientSelect(v)}
                      onInputChange={(_, v) => setPatientSearch(v)}
                      disabled={isLocked}
                      renderInput={(params) => <TextField {...params} label="Patient *" placeholder="Search by name or MR number" />}
                      noOptionsText="No patients found"
                    />
                    <Button
                      startIcon={<Add />}
                      onClick={() => setNewPatientOpen(true)}
                      disabled={isLocked}
                      sx={{ mt: 0.5, whiteSpace: 'nowrap', flexShrink: 0 }}
                      variant="outlined"
                      size="small"
                    >
                      New Patient
                    </Button>
                  </Stack>
                </Grid>

                {/* Age — readonly, auto-fetched from patient */}
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Age (yrs)"
                    fullWidth value={form.patientAgeYears}
                    InputProps={{ readOnly: true }}
                    helperText="Auto from patient"
                    size="small"
                  />
                </Grid>

                {/* Gender — readonly, auto-fetched from patient */}
                <Grid item xs={6} sm={3}>
                  <TextField
                    label="Gender"
                    fullWidth value={form.patientGender}
                    InputProps={{ readOnly: true }}
                    helperText="Auto from patient"
                    size="small"
                  />
                </Grid>

                {/* Surgeon */}
                <Grid item xs={12} sm={6}>
                  <TextField select label="Surgeon *" fullWidth required value={form.surgeonId}
                    onChange={(e) => setForm((f) => ({ ...f, surgeonId: e.target.value }))}
                    disabled={isLocked}>
                    {surgeons?.map((s) => <MenuItem key={s.surgeonId} value={s.surgeonId}>{s.fullName}</MenuItem>)}
                  </TextField>
                </Grid>

                {/* Surgery Type / Planned Procedure — auto-fills Department */}
                <Grid item xs={12} sm={6}>
                  <TextField select label="Surgery Type / Planned Procedure *" fullWidth required value={form.surgeryTypeId}
                    onChange={(e) => handleSurgeryTypeChange(e.target.value)}
                    disabled={isLocked}>
                    {surgeryTypes?.map((t) => <MenuItem key={t.surgeryTypeId} value={t.surgeryTypeId}>{t.name}</MenuItem>)}
                  </TextField>
                </Grid>

                {/* Anaesthetist */}
                <Grid item xs={12} sm={6}>
                  <TextField select label="Anaesthetist" fullWidth value={form.anaesthetistId}
                    onChange={(e) => setForm((f) => ({ ...f, anaesthetistId: e.target.value }))}
                    disabled={isLocked}>
                    <MenuItem value="">None</MenuItem>
                    {anaesthetists?.map((a) => <MenuItem key={a.anaesthetistId} value={a.anaesthetistId}>{a.fullName}</MenuItem>)}
                  </TextField>
                </Grid>

                {/* Department — auto-filled from Surgery Type, readonly */}
                <Grid item xs={12} sm={6}>
                  <TextField select label="Department" fullWidth value={form.departmentId}
                    onChange={(e) => setForm((f) => ({ ...f, departmentId: e.target.value }))}
                    disabled={isLocked}
                    helperText="Auto-filled from Surgery Type">
                    <MenuItem value="">None</MenuItem>
                    {departments?.map((d) => <MenuItem key={d.departmentId} value={d.departmentId}>{d.departmentName}</MenuItem>)}
                  </TextField>
                </Grid>

                {/* OT Room */}
                <Grid item xs={12} sm={6}>
                  <TextField select label="OT Room" fullWidth value={form.otRoomId}
                    onChange={(e) => setForm((f) => ({ ...f, otRoomId: e.target.value }))}
                    disabled={isLocked}>
                    <MenuItem value="">None</MenuItem>
                    {otRooms?.map((r) => <MenuItem key={r.otRoomId} value={r.otRoomId}>{r.roomName}{r.roomType ? ` (${r.roomType})` : ''}</MenuItem>)}
                  </TextField>
                </Grid>

                {/* Surgery Date */}
                <Grid item xs={12} sm={6}>
                  <DateInput label="Surgery Date" fullWidth value={form.surgeryDate}
                    onChange={(v) => setForm((f) => ({ ...f, surgeryDate: v }))}
                    disabled={isLocked} />
                </Grid>

                {/* IP/OP Status */}
                <Grid item xs={12} sm={6}>
                  <TextField select label="IP / OP Status" fullWidth value={form.ipOp}
                    onChange={(e) => setForm((f) => ({ ...f, ipOp: e.target.value }))}
                    disabled={isLocked}>
                    <MenuItem value="OP">Outpatient (OP)</MenuItem>
                    <MenuItem value="IP">Inpatient (IP)</MenuItem>
                  </TextField>
                </Grid>

                {/* Side / Site */}
                <Grid item xs={12} sm={6}>
                  <TextField select label="Side / Site" fullWidth value={form.sideSite}
                    onChange={(e) => setForm((f) => ({ ...f, sideSite: e.target.value }))}
                    disabled={isLocked}>
                    <MenuItem value="">— Select —</MenuItem>
                    {SIDE_SITE_OPTIONS.map((o) => <MenuItem key={o} value={o}>{o}</MenuItem>)}
                  </TextField>
                </Grid>

                {/* Technician Type — full-width row directly below IP / OP */}
                <Grid item xs={12}>
                  <TextField select label="Technician" fullWidth value={form.technicianType || ''}
                    onChange={(e) => setForm((f) => ({ ...f, technicianType: e.target.value }))}
                    disabled={isLocked}>
                    <MenuItem value="">— Select Technician Type —</MenuItem>
                    <MenuItem value="IN_HOUSE">In-house</MenuItem>
                    <MenuItem value="OUTSOURCED">Outsourced</MenuItem>
                  </TextField>
                </Grid>

                {/* Diagnosis / Clinical Notes */}
                <Grid item xs={12}>
                  <TextField label="Diagnosis / Clinical Notes" fullWidth multiline rows={2}
                    value={form.clinicalNotes}
                    onChange={(e) => setForm((f) => ({ ...f, clinicalNotes: e.target.value }))}
                    disabled={isLocked} />
                </Grid>
              </Grid>
            </SectionCard>

            {/* ── Patient condition, ASA risk and payer ───────────────── */}
            <SectionCard title="Patient Condition & Payer" subtitle="Clinical risk and payer reference only. Warnings do not block saving.">
              <Grid container spacing={2}>
                <Grid item xs={12} sm={3}><TextField select label="ASA Grade" fullWidth size="small" value={form.asaGrade} disabled={isLocked} onChange={e=>setForm(f=>({...f,asaGrade:e.target.value}))}><MenuItem value="">Not recorded</MenuItem>{[1,2,3,4,5,6].map(n=><MenuItem key={n} value={n}>{['','I','II','III','IV','V','VI'][n]}</MenuItem>)}</TextField></Grid>
                <Grid item xs={12} sm={3}><TextField select label="Emergency (E)" fullWidth size="small" value={form.asaEmergency?'true':'false'} disabled={isLocked} onChange={e=>setForm(f=>({...f,asaEmergency:e.target.value==='true'}))}><MenuItem value="false">No</MenuItem><MenuItem value="true">Yes</MenuItem></TextField></Grid>
                <Grid item xs={12} sm={3}><TextField select label="Planned OT Type" fullWidth size="small" value={form.plannedOtType} disabled={isLocked} onChange={e=>setForm(f=>({...f,plannedOtType:e.target.value}))}><MenuItem value="">Not selected</MenuItem>{['Major','Minor','Cath Lab'].map(t=><MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField></Grid>
                <Grid item xs={12} sm={3}><TextField label="PAC Date" type="date" fullWidth size="small" InputLabelProps={{shrink:true}} value={form.pacDate} disabled={isLocked} onChange={e=>setForm(f=>({...f,pacDate:e.target.value}))}/></Grid>
                <Grid item xs={12} sm={6}><TextField select label="PAC By (Staff / Anaesthetist)" fullWidth size="small" value={form.pacByStaffId} disabled={isLocked} onChange={e=>setForm(f=>({...f,pacByStaffId:e.target.value}))}><MenuItem value="">Not selected</MenuItem>{(clinicalStaff?.data??[]).filter(st=>st.isActive!==false&&['Anaesthetist','Visiting Specialist'].includes(st.staffType)).map(st=><MenuItem key={st.staffId} value={st.staffId}>{st.name} — {st.staffType}</MenuItem>)}</TextField></Grid>
                <Grid item xs={12} sm={6}><TextField label="Hospital M.No / HIS UHID" fullWidth size="small" value={form.hisUhid || selectedPatient?.mrNumber || ''} InputProps={{readOnly:true}} helperText="Auto-filled from patient M.No"/></Grid>
                <Grid item xs={12}><TextField label="Comorbidities" fullWidth multiline rows={2} value={form.comorbidities} disabled={isLocked} onChange={e=>setForm(f=>({...f,comorbidities:e.target.value}))}/></Grid>
                <Grid item xs={12} sm={6}><TextField label="Fitness Remark" fullWidth multiline rows={2} value={form.fitnessRemark} disabled={isLocked} onChange={e=>setForm(f=>({...f,fitnessRemark:e.target.value}))}/></Grid>
                <Grid item xs={12} sm={6}><TextField label="Special Precautions" fullWidth multiline rows={2} value={form.specialPrecautions} disabled={isLocked} onChange={e=>setForm(f=>({...f,specialPrecautions:e.target.value}))}/></Grid>
                <Grid item xs={12} sm={3}><TextField select label="Payer Type" fullWidth size="small" value={form.payerType} disabled={isLocked} onChange={e=>setForm(f=>({...f,payerType:e.target.value}))}>{['SELF','INSURANCE','SCHEME','CORPORATE'].map(t=><MenuItem key={t} value={t}>{t}</MenuItem>)}</TextField></Grid>
                <Grid item xs={12} sm={3}><TextField label="Payer / Insurer Name" fullWidth size="small" value={form.payerName} disabled={isLocked} onChange={e=>setForm(f=>({...f,payerName:e.target.value}))}/></Grid>
                <Grid item xs={12} sm={3}><TextField label="Policy / Pre-auth Reference" fullWidth size="small" value={form.payerReference} disabled={isLocked} onChange={e=>setForm(f=>({...f,payerReference:e.target.value}))}/></Grid>
                <Grid item xs={12} sm={3}><TextField label="Pre-auth Amount (₹)" type="number" fullWidth size="small" value={form.preauthAmount} disabled={isLocked} onChange={e=>setForm(f=>({...f,preauthAmount:e.target.value}))}/></Grid>
              </Grid>
              {Number(form.asaGrade)>=3&&form.plannedOtType==='Minor'&&<Alert severity="warning" sx={{mt:2}}>ASA grade III or higher with a Minor OT plan requires clinical review. Saving is allowed.</Alert>}
              {[...(existingQuery.data?.warnings ?? []), ...(saveMutation.data?.warnings ?? [])].filter((warning:string,index:number,all:string[])=>all.indexOf(warning)===index).map((warning:string)=><Alert key={warning} severity="warning" sx={{mt:1}}>{warning}</Alert>)}
            </SectionCard>

            {/* ── 2. STATUS ────────────────────────────────────────────── */}
            {isEdit && existingQuery.data && (
              <SectionCard title="Status">
                <Stack direction="row" spacing={1.5} flexWrap="wrap" alignItems="center">
                  <Typography variant="body2" color="text.secondary">
                    Current: <StatusChip status={existingQuery.data.status} />
                  </Typography>
                  <Divider orientation="vertical" flexItem />
                  {nextStatuses.filter((nextStatus) => {
                    if (['BUDGET_APPROVED','REVISE_BUDGET'].includes(nextStatus)) return hasPermission('APPROVE_BUDGET');
                    if (['SURGERY_COMPLETED','COMPLETED'].includes(nextStatus)) return hasPermission('MARK_SURGERY_COMPLETED');
                    return true;
                  }).map((nextStatus) => (
                    <Button
                      key={nextStatus}
                      size="small"
                      variant={APPROVAL_ACTIONS.includes(nextStatus) ? 'contained' : 'outlined'}
                      color={
                        nextStatus === 'CANCELLED' ? 'error'
                        : nextStatus === 'REVISE_BUDGET' ? 'warning'
                        : APPROVAL_ACTIONS.includes(nextStatus) ? 'success'
                        : 'primary'
                      }
                      onClick={() => {
                        if (nextStatus === 'CANCELLED') {
                          setCancelDialogOpen(true);
                        } else {
                          setStatusConfirm(nextStatus);
                        }
                      }}
                    >
                      {STATUS_ACTION_LABELS[nextStatus] || nextStatus.replace(/_/g, ' ')}
                    </Button>
                  ))}
                </Stack>
                {existingQuery.data.cancelReason && (
                  <Alert severity="warning" sx={{ mt: 1.5 }}>
                    <strong>Cancellation Reason:</strong> {existingQuery.data.cancelReason}
                  </Alert>
                )}
              </SectionCard>
            )}

            {/* ── 3. COMMENTS ──────────────────────────────────────────── */}
            <SectionCard title="Comments" subtitle="Optional notes about this surgery entry">
              <TextField
                label="Comments"
                fullWidth multiline rows={3}
                value={form.comments}
                onChange={(e) => setForm((f) => ({ ...f, comments: e.target.value }))}
                disabled={isLocked}
                placeholder="Add any notes, remarks or instructions here…"
              />
            </SectionCard>

            {/* ── 4. BUDGET ────────────────────────────────────────────── */}
            <SectionCard
              title="Budget"
              subtitle={isBudgetLocked ? 'Budget locked after approval — use Revise Budget to make changes' : 'Estimated costs — apply recommendations from the panel on the right'}
            >
              <Grid container spacing={2}>
                {BUDGET_FIELDS.map((f) => (
                  <Grid item xs={12} sm={6} key={f.key}>
                    <TextField
                      label={f.label} type="number" fullWidth
                      value={form[f.key]}
                      onChange={(e) => {
                        const v = e.target.value;
                        setForm((prev) => ({ ...prev, [f.key]: v }));
                      }}
                      onWheel={blockWheel}
                      disabled={isLocked || isBudgetLocked}
                      inputProps={{ min: 0 }}
                      error={Number(form[f.key]) < 0}
                      helperText={Number(form[f.key]) < 0 ? 'Cannot be negative' : ''}
                      InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>₹</span> }}
                    />
                  </Grid>
                ))}
                <Grid item xs={12} sm={6}>
                  <TextField
                    label="Quoted Price" type="number" fullWidth
                    value={form.quotedPrice}
                    onChange={(e) => setForm((f) => ({ ...f, quotedPrice: e.target.value }))}
                    onWheel={blockWheel}
                    disabled={isLocked || isBudgetLocked}
                    inputProps={{ min: 0 }}
                    InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>₹</span> }}
                  />
                </Grid>
                <Grid item xs={12} sm={6} sx={{ display: 'flex', alignItems: 'center' }}>
                  <Chip
                    label={`Budget Total: ${formatCurrency(BUDGET_FIELDS.reduce((sum, f) => sum + (Number(form[f.key]) || 0), 0))}`}
                    color="primary" variant="outlined"
                  />
                </Grid>
              </Grid>
            </SectionCard>

            {/* ── 5. ACTUAL COST ───────────────────────────────────────── */}
            {isEdit && (
              <SectionCard title="Actual Cost" subtitle="Fill in once the surgery is performed">
                <Grid container spacing={2}>
                  {ACTUAL_FIELDS.map((f) => (
                    <Grid item xs={12} sm={6} key={f.key}>
                      <TextField
                        label={f.label} type="number" fullWidth
                        value={form[f.key]}
                        onChange={(e) => setForm((prev) => ({ ...prev, [f.key]: e.target.value }))}
                        onWheel={blockWheel}
                        disabled={isLocked}
                        inputProps={{ min: 0 }}
                        error={form[f.key] !== '' && Number(form[f.key]) < 0}
                        helperText={form[f.key] !== '' && Number(form[f.key]) < 0 ? 'Cannot be negative' : ''}
                        InputProps={{ startAdornment: <span style={{ marginRight: 4 }}>₹</span> }}
                      />
                    </Grid>
                  ))}
                </Grid>
              </SectionCard>
            )}

            {/* OT Schedule readonly section */}
            {isEdit && existingQuery.data && existingQuery.data.otScheduleId && (
              <SectionCard title="OT Scheduling (Readonly)" subtitle="Managed from OT Scheduling page">
                <Grid container spacing={2}>
                  <Grid item xs={12} sm={4}>
                    <TextField label="OT Date" fullWidth size="small"
                      value={existingQuery.data.otPlannedDate ? existingQuery.data.otPlannedDate.slice(0,10) : '—'}
                      InputProps={{ readOnly: true }} />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField label="OT Start Time" fullWidth size="small"
                      value={existingQuery.data.otPlannedStartTime || '—'}
                      InputProps={{ readOnly: true }} helperText="Set from OT Scheduling" />
                  </Grid>
                  <Grid item xs={12} sm={4}>
                    <TextField label="Expected Duration (min)" fullWidth size="small"
                      value={existingQuery.data.otExpectedDurationMin != null ? String(existingQuery.data.otExpectedDurationMin) : '—'}
                      InputProps={{ readOnly: true }} helperText="Set from OT Scheduling" />
                  </Grid>
                  <Grid item xs={12}>
                    <Button size="small" variant="outlined"
                      onClick={() => navigate(`/scheduling/${existingQuery.data!.otScheduleId}`)}>
                      Open OT Scheduling →
                    </Button>
                  </Grid>
                </Grid>
              </SectionCard>
            )}

            <Stack direction="row" spacing={2} justifyContent="flex-end">
              <Button
                variant="contained" size="large" startIcon={<Save />}
                onClick={() => saveMutation.mutate()}
                disabled={isLocked || saveMutation.isPending || !form.patientId || !form.surgeonId || !form.surgeryTypeId}
              >
                {saveMutation.isPending ? 'Saving…' : isEdit ? 'Save Changes' : 'Create Surgery Entry'}
              </Button>
            </Stack>
          </Stack>
        </Grid>

        <Grid item xs={12} md={4}>
          <RecommendationPanel
            result={recommendationQuery.data}
            isLoading={recommendationQuery.isFetching}
            excludeOutliers={excludeOutliers}
            onToggleOutliers={setExcludeOutliers}
            onApplyAll={applyAllFromRecommendation}
            onApplyField={(field, value) => setForm((f) => ({ ...f, [field]: Math.round(value * 100) / 100 }))}
            disabled={isLocked}
          />
        </Grid>
      </Grid>

      {/* Dialogs */}
      <NewPatientDialog
        open={newPatientOpen}
        branchId={form.branchId}
        onClose={() => setNewPatientOpen(false)}
        onCreated={(patient) => {
          handlePatientSelect(patient);
          setNewPatientOpen(false);
          queryClient.invalidateQueries({ queryKey: ['patients'] });
        }}
      />

      <OverrideReasonDialog
        prompt={overridePrompt}
        onCancel={() => setOverridePrompt(null)}
        onSubmit={(reason) => {
          if (overridePrompt) setOverrideReasons((r) => ({ ...r, [overridePrompt.field]: reason }));
          setOverridePrompt(null);
          setTimeout(() => saveMutation.mutate(), 0);
        }}
      />

      {/* Cancel Surgery dialog — mandatory reason */}
      <CancelReasonDialog
        open={cancelDialogOpen}
        onClose={() => setCancelDialogOpen(false)}
        loading={statusMutation.isPending}
        onConfirm={(reason) => statusMutation.mutate({ status: 'CANCELLED', cancelReason: reason })}
      />

      {/* Other status confirmations */}
      <ConfirmDialog
        open={!!statusConfirm}
        title={statusConfirm ? (STATUS_ACTION_LABELS[statusConfirm] || `Change to ${statusConfirm?.replace(/_/g, ' ')}`) + '?' : ''}
        description={
          statusConfirm === 'SURGERY_COMPLETED'
            ? 'Actual cost fields (Surgeon Fee, OT Cost) must be filled in before marking as completed.'
            : statusConfirm === 'SENT_FOR_BUDGET_APPROVAL'
            ? 'Budget section must have at least one value filled in.'
            : statusConfirm === 'BUDGET_APPROVED'
            ? 'Approving the budget will lock all budget fields.'
            : statusConfirm === 'SCHEDULED'
            ? 'This will auto-create an OT Scheduling record. You can set the exact time from OT Scheduling.'
            : statusConfirm === 'CLOSED'
            ? 'Closing this surgery is final. No further changes will be possible.'
            : undefined
        }
        confirmLabel={statusConfirm === 'CLOSED' ? 'Close Surgery' : 'Confirm'}
        onConfirm={() => statusConfirm && statusMutation.mutate({ status: statusConfirm })}
        onCancel={() => setStatusConfirm(null)}
        loading={statusMutation.isPending}
      />
    </>
  );
}

function buildPayload(form: Record<string, any>, overrideReasons: Record<string, string>, isEdit = false) {
  const numeric = (v: any) => (v === '' || v === null || v === undefined ? undefined : Number(v));

  // Fields allowed only on CREATE (not updatable)
  const createOnlyFields = isEdit ? {} : {
    branchId: form.branchId || undefined,
    patientId: form.patientId,
    surgeryTypeId: form.surgeryTypeId,
  };

  return {
    ...createOnlyFields,
    departmentId: form.departmentId || undefined,
    surgeonId: form.surgeonId,
    anaesthetistId: form.anaesthetistId || undefined,
    otRoomId: form.otRoomId || undefined,
    patientAgeYears: numeric(form.patientAgeYears),
    patientGender: form.patientGender,
    surgeryDate: form.surgeryDate || undefined,
    ipOp: form.ipOp || 'OP',
    technicianType: form.technicianType || undefined,
    admissionNumber: form.admissionNumber || undefined,
    diagnosis: form.diagnosis || undefined,
    plannedProcedure: form.plannedProcedure || undefined,
    sideSite: form.sideSite || undefined,
    clinicalNotes: form.clinicalNotes || undefined,
    comments: form.comments || undefined,
    asaGrade: numeric(form.asaGrade), asaEmergency: Boolean(form.asaEmergency), comorbidities: form.comorbidities || undefined,
    pacDate: form.pacDate || undefined, pacByStaffId: form.pacByStaffId || undefined, fitnessRemark: form.fitnessRemark || undefined,
    specialPrecautions: form.specialPrecautions || undefined, plannedOtType: form.plannedOtType || undefined, payerType: form.payerType || 'SELF',
    payerName: form.payerName || undefined, payerReference: form.payerReference || undefined, preauthAmount: numeric(form.preauthAmount), hisUhid: form.hisUhid || undefined,
    budgetSurgeonFee: numeric(form.budgetSurgeonFee) ?? 0,
    budgetAssistantCost: numeric(form.budgetAssistantCost) ?? 0,
    budgetAnaesthetistFee: numeric(form.budgetAnaesthetistFee) ?? 0,
    budgetOtCost: numeric(form.budgetOtCost) ?? 0,
    budgetConsumables: numeric(form.budgetConsumables) ?? 0,
    budgetPharmacy: numeric(form.budgetPharmacy) ?? 0,
    budgetMiscellaneous: numeric(form.budgetMiscellaneous) ?? 0,
    actualSurgeonFee: numeric(form.actualSurgeonFee),
    actualAssistantCost: numeric(form.actualAssistantCost),
    actualAnaesthetistFee: numeric(form.actualAnaesthetistFee),
    actualOtCost: numeric(form.actualOtCost),
    actualConsumables: numeric(form.actualConsumables),
    actualPharmacy: numeric(form.actualPharmacy),
    actualMiscellaneous: numeric(form.actualMiscellaneous),
    quotedPrice: numeric(form.quotedPrice),
    overrideReasons: Object.keys(overrideReasons).length > 0 ? overrideReasons : undefined,
  };
}
