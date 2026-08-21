import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Grid, TextField, MenuItem, Button, Alert, Typography,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, IconButton, Chip, Dialog, DialogTitle, DialogContent,
  DialogActions, InputAdornment, Stack, Collapse, Divider,
  CircularProgress,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import DeleteIcon from '@mui/icons-material/Delete';
import AssignmentIndIcon from '@mui/icons-material/AssignmentInd';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import { PageHeader } from '@/components/common/PageHeader';
import { DateInput } from '@/components/common/DateInput';
import { StatusChip } from '@/components/common/StatusChip';
import { patientsCrud, deletePatient, listBloodGroups } from '@/api/masters.api';
import { getPatientSurgeries } from '@/api/surgeries.api';
import { getErrorMessage } from '@/api/client';
import { formatDate, formatCurrency } from '@/utils/format';
import type { Patient, Surgery } from '@/api/types';

const MAIN_BRANCH = '00000000-0000-0000-0000-000000000001';
const GENDER_OPTIONS = ['MALE', 'FEMALE', 'OTHER', 'UNKNOWN'];

const EMPTY_FORM = {
  mrNumber: '', fullName: '', dateOfBirth: '', gender: 'UNKNOWN',
  phone: '', bloodGroup: '', emergencyContactPhone: '',
};

function isValidPhone(val: string): boolean {
  if (!val) return true;
  return /^\d{10}$/.test(val);
}

// ─── Surgery History Panel ─────────────────────────────────────────────────────
function PatientSurgeryHistory({ patientId }: { patientId: string }) {
  const navigate = useNavigate();
  const { data: surgeries = [], isLoading } = useQuery({
    queryKey: ['patient-surgeries', patientId],
    queryFn: () => getPatientSurgeries(patientId),
    enabled: !!patientId,
  });

  if (isLoading) {
    return <Box sx={{ py: 2, display: 'flex', justifyContent: 'center' }}><CircularProgress size={20} /></Box>;
  }

  if (surgeries.length === 0) {
    return <Typography variant="body2" color="text.secondary" sx={{ py: 1 }}>No surgery records found.</Typography>;
  }

  return (
    <TableContainer>
      <Table size="small">
        <TableHead>
          <TableRow>
            <TableCell sx={{ fontWeight: 700 }}>Surgery ID</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Surgery Type</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Surgeon</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Date</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
            <TableCell sx={{ fontWeight: 700 }}>Budget Total</TableCell>
            <TableCell />
          </TableRow>
        </TableHead>
        <TableBody>
          {surgeries.map((s: Surgery) => (
            <TableRow key={s.surgeryId} hover>
              <TableCell>
                <Chip label={s.surgeryNumber || s.surgeryId.slice(0, 8)} size="small" variant="outlined" />
              </TableCell>
              <TableCell>{s.surgeryType?.name ?? '—'}</TableCell>
              <TableCell>{s.surgeon?.fullName ?? '—'}</TableCell>
              <TableCell>{s.surgeryDate ? formatDate(s.surgeryDate) : (s.scheduledDate ? formatDate(s.scheduledDate) : '—')}</TableCell>
              <TableCell><StatusChip status={s.status} /></TableCell>
              <TableCell>{formatCurrency(Number(s.budgetTotal || 0))}</TableCell>
              <TableCell>
                <Button size="small" onClick={() => navigate(`/surgeries/${s.surgeryId}`)}>
                  Open
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </TableContainer>
  );
}

// ─── PatientRow ────────────────────────────────────────────────────────────────
function PatientRow({
  patient, onEdit, onDelete, onNewSurgery,
}: {
  patient: Patient;
  onEdit: (p: Patient) => void;
  onDelete: (p: Patient) => void;
  onNewSurgery: (p: Patient) => void;
}) {
  const [expanded, setExpanded] = useState(false);

  return (
    <>
      <TableRow hover>
        <TableCell><Chip label={patient.mrNumber} size="small" variant="outlined" /></TableCell>
        <TableCell>{patient.fullName}</TableCell>
        <TableCell>{patient.dateOfBirth ? formatDate(patient.dateOfBirth) : '—'}</TableCell>
        <TableCell>{patient.gender}</TableCell>
        <TableCell>{patient.phone ?? '—'}</TableCell>
        <TableCell>{patient.bloodGroup ?? '—'}</TableCell>
        <TableCell>
          <Stack direction="row" spacing={0.5}>
            <IconButton size="small" onClick={() => onEdit(patient)} title="Edit Patient">
              <EditIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="error" onClick={() => onDelete(patient)} title="Delete Patient">
              <DeleteIcon fontSize="small" />
            </IconButton>
            <IconButton size="small" color="primary" onClick={() => onNewSurgery(patient)} title="Create Surgery">
              <AssignmentIndIcon fontSize="small" />
            </IconButton>
            <IconButton
              size="small"
              onClick={() => setExpanded((e) => !e)}
              title={expanded ? 'Hide Surgery History' : 'Show Surgery History'}
            >
              {expanded ? <ExpandLessIcon fontSize="small" /> : <ExpandMoreIcon fontSize="small" />}
            </IconButton>
          </Stack>
        </TableCell>
      </TableRow>
      {expanded && (
        <TableRow>
          <TableCell colSpan={7} sx={{ py: 0, bgcolor: 'action.hover' }}>
            <Collapse in={expanded} timeout="auto" unmountOnExit>
              <Box sx={{ px: 2, py: 1.5 }}>
                <Typography variant="subtitle2" sx={{ mb: 1, fontWeight: 700 }}>
                  Surgery History — {patient.fullName}
                </Typography>
                <PatientSurgeryHistory patientId={patient.patientId} />
              </Box>
            </Collapse>
          </TableCell>
        </TableRow>
      )}
    </>
  );
}

// ─── Main Page ─────────────────────────────────────────────────────────────────
export function PatientEntryPage() {
  const qc = useQueryClient();
  const navigate = useNavigate();
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [editPatient, setEditPatient] = useState<Patient | null>(null);
  const [deleteTarget, setDeleteTarget] = useState<Patient | null>(null);
  const [form, setForm] = useState({ ...EMPTY_FORM });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const { data: patients = [], isLoading } = useQuery({
    queryKey: ['patients', search],
    queryFn: async () => {
      const res = await patientsCrud.list({ search, limit: 200, isActive: 'true' });
      return res.data as Patient[];
    },
  });

  // Fetch blood groups from Master Config
  const { data: bloodGroupOptions = [] } = useQuery({
    queryKey: ['blood-groups'],
    queryFn: listBloodGroups,
    staleTime: 5 * 60 * 1000,
  });

  function set(k: string, v: string) { setForm((f) => ({ ...f, [k]: v })); }

  function openAdd() {
    setForm({ ...EMPTY_FORM });
    setEditPatient(null);
    setError('');
    setDialogOpen(true);
  }

  function openEdit(p: Patient) {
    setForm({
      mrNumber: p.mrNumber, fullName: p.fullName,
      dateOfBirth: p.dateOfBirth ?? '', gender: p.gender ?? 'UNKNOWN',
      phone: p.phone ?? '',
      bloodGroup: p.bloodGroup ?? '',
      emergencyContactPhone: p.emergencyContactPhone ?? '',
    });
    setEditPatient(p);
    setError('');
    setDialogOpen(true);
  }

  function openDelete(p: Patient) {
    setDeleteTarget(p);
    setDeleteDialogOpen(true);
  }

  const saveMutation = useMutation({
    mutationFn: async () => {
      const payload = {
        branchId: MAIN_BRANCH,
        mrNumber: form.mrNumber,
        fullName: form.fullName,
        dateOfBirth: form.dateOfBirth || undefined,
        gender: form.gender,
        phone: form.phone || undefined,
        bloodGroup: form.bloodGroup || undefined,
        emergencyContactPhone: form.emergencyContactPhone || undefined,
      } as Record<string, unknown>;
      if (editPatient) return patientsCrud.update(editPatient.patientId, payload);
      return patientsCrud.create(payload);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] });
      setDialogOpen(false);
    },
    onError: (e: unknown) => setError(getErrorMessage(e)),
  });

  const deleteMutation = useMutation({
    mutationFn: (id: string) => deletePatient(id),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['patients'] });
      setDeleteDialogOpen(false);
      setDeleteTarget(null);
    },
    onError: (e: unknown) => setError(getErrorMessage(e)),
  });

  async function handleSave() {
    if (!form.mrNumber || !form.fullName) { setError('MR Number and Full Name are required'); return; }
    if (form.phone && !isValidPhone(form.phone)) { setError('Phone must be exactly 10 digits'); return; }
    if (form.emergencyContactPhone && !isValidPhone(form.emergencyContactPhone)) { setError('Emergency Contact Phone must be exactly 10 digits'); return; }
    setSaving(true);
    setError('');
    try { await saveMutation.mutateAsync(); } finally { setSaving(false); }
  }

  return (
    <Box>
      <PageHeader title="Patient Entry" subtitle="Register new patients and manage patient records" />

      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <TextField
          size="small" placeholder="Search by name or MR number…"
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 300 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Register Patient
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight: 700 }}>MR Number</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Full Name</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Date of Birth</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Gender</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Phone</TableCell>
              <TableCell sx={{ fontWeight: 700 }}>Blood Group</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 160 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3 }}>Loading…</TableCell></TableRow>
              : patients.length === 0
              ? <TableRow><TableCell colSpan={7} align="center" sx={{ py: 3, color: 'text.secondary' }}>No patients found</TableCell></TableRow>
              : patients.map((p) => (
                <PatientRow
                  key={p.patientId}
                  patient={p}
                  onEdit={openEdit}
                  onDelete={openDelete}
                  onNewSurgery={(pat) => navigate('/surgeries/new', { state: { patientId: pat.patientId } })}
                />
              ))
            }
          </TableBody>
        </Table>
      </TableContainer>

      {/* Add/Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="md" fullWidth>
        <DialogTitle>{editPatient ? 'Edit Patient' : 'Register New Patient'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important' }}>
          {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
          <Grid container spacing={2}>
            <Grid item xs={12} sm={4}>
              <TextField label="MR Number" required value={form.mrNumber} onChange={(e) => set('mrNumber', e.target.value)} size="small" fullWidth disabled={!!editPatient} />
            </Grid>
            <Grid item xs={12} sm={8}>
              <TextField label="Full Name" required value={form.fullName} onChange={(e) => set('fullName', e.target.value)} size="small" fullWidth />
            </Grid>
            <Grid item xs={12} sm={4}>
              <DateInput label="Date of Birth" value={form.dateOfBirth} onChange={(v) => set('dateOfBirth', v)} size="small" fullWidth />
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Gender" select value={form.gender} onChange={(e) => set('gender', e.target.value)} size="small" fullWidth>
                {GENDER_OPTIONS.map((g) => <MenuItem key={g} value={g}>{g}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={4}>
              <TextField label="Blood Group" select value={form.bloodGroup} onChange={(e) => set('bloodGroup', e.target.value)} size="small" fullWidth>
                <MenuItem value="">— Select —</MenuItem>
                {bloodGroupOptions.map((b) => <MenuItem key={b.bloodGroupId} value={b.code}>{b.label}</MenuItem>)}
              </TextField>
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Phone Number"
                value={form.phone}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); set('phone', v); }}
                size="small" fullWidth
                inputProps={{ maxLength: 10, inputMode: 'numeric' }}
                error={!!form.phone && !isValidPhone(form.phone)}
                helperText={form.phone && !isValidPhone(form.phone) ? 'Must be exactly 10 digits' : '10 digits only'}
              />
            </Grid>
            <Grid item xs={12} sm={6}>
              <TextField
                label="Emergency Contact Phone"
                value={form.emergencyContactPhone}
                onChange={(e) => { const v = e.target.value.replace(/\D/g, '').slice(0, 10); set('emergencyContactPhone', v); }}
                size="small" fullWidth
                inputProps={{ maxLength: 10, inputMode: 'numeric' }}
                error={!!form.emergencyContactPhone && !isValidPhone(form.emergencyContactPhone)}
                helperText={form.emergencyContactPhone && !isValidPhone(form.emergencyContactPhone) ? 'Must be exactly 10 digits' : '10 digits only'}
              />
            </Grid>
          </Grid>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : editPatient ? 'Update Patient' : 'Register Patient'}
          </Button>
        </DialogActions>
      </Dialog>

      {/* Delete Confirmation Dialog */}
      <Dialog open={deleteDialogOpen} onClose={() => setDeleteDialogOpen(false)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Patient?</DialogTitle>
        <DialogContent>
          <Typography variant="body2">
            This will deactivate patient <strong>{deleteTarget?.fullName}</strong> ({deleteTarget?.mrNumber}).
            Their surgery records will be preserved and remain linked.
          </Typography>
          {error && <Alert severity="error" sx={{ mt: 2 }}>{error}</Alert>}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteDialogOpen(false)}>Cancel</Button>
          <Button
            variant="contained"
            color="error"
            onClick={() => deleteTarget && deleteMutation.mutate(deleteTarget.patientId)}
            disabled={deleteMutation.isPending}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete Patient'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
