import { useEffect, useMemo, useState } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import {
  Alert, Box, Button, Chip, CircularProgress, Divider, Grid, MenuItem, Paper,
  Stack, Table, TableBody, TableCell, TableContainer, TableHead, TableRow,
  TextField, Typography, Autocomplete,
} from '@mui/material';
import ArrowBackIcon from '@mui/icons-material/ArrowBack';
import SaveIcon from '@mui/icons-material/Save';
import PlayArrowIcon from '@mui/icons-material/PlayArrow';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import CheckCircleIcon from '@mui/icons-material/CheckCircle';
import { PageHeader } from '@/components/common/PageHeader';
import { useAuth } from '@/auth/AuthContext';
import * as actualsApi from '@/api/actuals.api';
import * as schedulingApi from '@/api/scheduling.api';
import * as surgeriesApi from '@/api/surgeries.api';
import { useStaff } from '@/hooks/useMasterData';
import { getErrorMessage } from '@/api/client';
import type { SurgeryActuals as ActualsData, Staff } from '@/api/types';

const EVENTS = [
  ['PATIENT_ENTERED_OT', 'Patient Entered OT'],
  ['ANAESTHESIA_STARTED', 'Anaesthesia Started'],
  ['SURGERY_STARTED', 'Surgery Started'],
  ['ADDITIONAL_PROCEDURE', 'Additional Procedure'],
  ['SURGERY_COMPLETED', 'Surgery Completed'],
  ['ANAESTHESIA_COMPLETED', 'Anaesthesia Completed'],
  ['PATIENT_SHIFTED_OUT', 'Patient Shifted Out of OT'],
] as const;

const TEAM_ROLES = [
  ['PRIMARY_SURGEON', 'Primary Surgeon'], ['CO_SURGEON', 'Co-Surgeon'], ['ASSISTANT', 'Assistant'],
  ['ANAESTHETIST', 'Anaesthetist'], ['OT_ASSISTANT', 'OT Assistant'], ['OTHER', 'Other'],
] as const;

const emptyForm = {
  actualSurgeryDate: '', otRoomId: '', actualStartTime: '', procedurePerformedText: '',
  procedureModifiedFlag: false, additionalProcedureText: '', emergencyUnplannedFlag: false,
  anaesthesiaType: '', complications: '', equipmentUsed: '', implantsUsed: '', suturesUsed: '',
  staplersStaplesUsed: '', otherMaterialsUsed: '', specialInstructions: '', postOpInstructions: '', remarks: '',
};

function toDateInput(value?: string | null) { return value ? String(value).slice(0, 10) : ''; }
function toTimeInput(value?: string | null) { return value ? String(value).slice(0, 5) : ''; }
function isValidDateInput(value: string) {
  if (!value) return true;
  if (!/^\d{4}-\d{2}-\d{2}$/.test(value)) return false;
  const date = new Date(`${value}T00:00:00Z`);
  return !Number.isNaN(date.getTime()) && date.toISOString().slice(0, 10) === value;
}

export function SurgeryDayActualsPage() {
  const { hasPermission } = useAuth();
  const canEdit = hasPermission('EDIT_SURGERY_ACTUALS');
  const canComplete = hasPermission('MARK_SURGERY_COMPLETED');
  const { surgeryId } = useParams();
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [form, setForm] = useState(emptyForm);
  const [initialized, setInitialized] = useState(false);
  const [team, setTeam] = useState<Record<string, string[]>>({});
  const [error, setError] = useState('');
  const [saved, setSaved] = useState(false);

  const { data, isLoading } = useQuery({
    queryKey: ['surgery-actuals', surgeryId],
    queryFn: () => actualsApi.getActuals(surgeryId!),
    enabled: !!surgeryId,
  });

  const { data: staff = [] } = useStaff();
  const { data: rooms = [] } = useQuery({
    queryKey: ['actuals-rooms'],
    queryFn: async () => (await import('@/api/masters.api')).listOtRooms({ limit: 500, isActive: true }),
  });

  const current = data as ActualsData | undefined;
  const actual = current?.actual;
  const currentTeam = current?.team ?? [];
  const currentEvents = current?.events ?? [];

  const initialValues = useMemo(() => ({
    ...emptyForm,
    actualSurgeryDate: toDateInput(actual?.actualSurgeryDate ?? current?.surgery.surgeryDate ?? current?.surgery.plannedDate),
    otRoomId: actual?.otRoomId ?? current?.surgery.otRoomId ?? '',
    actualStartTime: toTimeInput(actual?.actualStartTime),
    procedurePerformedText: actual?.procedurePerformedText ?? '',
    procedureModifiedFlag: actual?.procedureModifiedFlag ?? false,
    additionalProcedureText: actual?.additionalProcedureText ?? '',
    emergencyUnplannedFlag: actual?.emergencyUnplannedFlag ?? false,
    anaesthesiaType: actual?.anaesthesiaType ?? '', complications: actual?.complications ?? '',
    equipmentUsed: actual?.equipmentUsed ?? '', implantsUsed: actual?.implantsUsed ?? '',
    suturesUsed: actual?.suturesUsed ?? '', staplersStaplesUsed: actual?.staplersStaplesUsed ?? '',
    otherMaterialsUsed: actual?.otherMaterialsUsed ?? '', specialInstructions: actual?.specialInstructions ?? '',
    postOpInstructions: actual?.postOpInstructions ?? '', remarks: actual?.remarks ?? '',
  }), [actual, current]);

  useEffect(() => {
    if (!initialized && current) {
      setForm(initialValues);
      setTeam(Object.fromEntries(TEAM_ROLES.map(([role]) => [role, current.team.filter(m => m.teamRole === role).map(m => m.staffId)])));
      setInitialized(true);
    }
  }, [initialized, current, initialValues]);
  const values = form;

  if (!surgeryId) return <Alert severity="error">Surgery ID is missing.</Alert>;
  if (isLoading) return <Box sx={{ p: 3 }}><CircularProgress /></Box>;
  if (!current) return <Alert severity="error">Unable to load surgery actuals.</Alert>;

  async function save() {
    setError(''); setSaved(false);
    if (!isValidDateInput(values.actualSurgeryDate)) {
      setError('Enter a valid date in YYYY-MM-DD format (for example, 2026-10-28).');
      return;
    }
    try {
      await actualsApi.saveActuals(surgeryId!, {
        ...values,
        team: Object.entries(team).flatMap(([teamRole, staffIds]) => staffIds.map(staffId => ({ teamRole, staffId }))),
      });
      qc.invalidateQueries({ queryKey: ['surgery-actuals', surgeryId] });
      setSaved(true);
    } catch (e) { setError(getErrorMessage(e)); }
  }

  async function addEvent(eventType: string) {
    setError('');
    try {
      await actualsApi.addTimelineEvent(surgeryId!, { eventType });
      qc.invalidateQueries({ queryKey: ['surgery-actuals', surgeryId] });
    } catch (e) { setError(getErrorMessage(e)); }
  }

  async function removeEvent(eventId: string) {
    try { await actualsApi.deleteTimelineEvent(eventId); qc.invalidateQueries({ queryKey: ['surgery-actuals', surgeryId] }); }
    catch (e) { setError(getErrorMessage(e)); }
  }

  async function markCompleted() {
    const required = ['PATIENT_ENTERED_OT','ANAESTHESIA_STARTED','SURGERY_STARTED','SURGERY_COMPLETED','ANAESTHESIA_COMPLETED','PATIENT_SHIFTED_OUT'];
    const missing = required.filter(t => !currentEvents.some(e => e.eventType === t));
    if (missing.length) { setError(`Complete the required timeline events first: ${missing.map(t => EVENTS.find(e => e[0] === t)?.[1]).join(', ')}`); return; }
    try { await surgeriesApi.changeSurgeryStatus(surgeryId!, 'SURGERY_COMPLETED'); qc.invalidateQueries({ queryKey: ['surgery-actuals', surgeryId] }); }
    catch (e) { setError(getErrorMessage(e)); }
  }

  const update = (key: keyof typeof emptyForm, value: string | boolean) => setForm(f => ({ ...f, [key]: value }));
  const staffForRole = (role: string) => {
    const type = role === 'PRIMARY_SURGEON' || role === 'CO_SURGEON' ? 'Surgeon' : role === 'ANAESTHETIST' ? 'Anaesthetist' : role === 'ASSISTANT' ? 'Assistant' : undefined;
    return type ? staff.filter(s => s.staffType === type) : staff;
  };

  return (
    <Box>
      <Stack direction="row" spacing={1} alignItems="center" mb={2}>
        <Button startIcon={<ArrowBackIcon />} onClick={() => navigate('/surgery-day-actuals')}>Back</Button>
      </Stack>
      <PageHeader title="Surgery-Day Actuals & Timeline" subtitle={`${current.surgery.surgeryNumber ?? surgeryId.slice(0,8)} · ${current.surgery.patientName ?? 'Patient'} · ${current.surgery.mrNumber ?? ''}`} />
      {error && <Alert severity="error" sx={{ mb: 2 }} onClose={() => setError('')}>{error}</Alert>}
      {saved && <Alert severity="success" sx={{ mb: 2 }} onClose={() => setSaved(false)}>Actuals saved successfully.</Alert>}

      <Paper sx={{ p: 2.5, mb: 2.5 }}>
        <Typography fontWeight={700} mb={1.5}>Actual Surgery Details</Typography>
        <Grid container spacing={2}>
          <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Actual Surgery Date" type="text" placeholder="YYYY-MM-DD" value={values.actualSurgeryDate} onChange={e=>update('actualSurgeryDate',e.target.value)} inputProps={{ inputMode: 'numeric', maxLength: 10, 'aria-label': 'Actual Surgery Date (YYYY-MM-DD)' }} helperText="Type date as YYYY-MM-DD" InputLabelProps={{shrink:true}} /></Grid>
          <Grid item xs={12} md={4}><TextField select fullWidth size="small" label="Actual OT" value={values.otRoomId} onChange={e=>update('otRoomId',e.target.value)}><MenuItem value="">— Select OT —</MenuItem>{rooms.map(r=><MenuItem key={r.otRoomId} value={r.otRoomId}>{r.roomName} ({r.roomCode})</MenuItem>)}</TextField></Grid>
          <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Actual Start Time" type="time" value={values.actualStartTime} onChange={e=>update('actualStartTime',e.target.value)} InputLabelProps={{shrink:true}} /></Grid>
          <Grid item xs={12} md={6}><TextField fullWidth size="small" label="Procedure Actually Performed" value={values.procedurePerformedText} onChange={e=>update('procedurePerformedText',e.target.value)} /></Grid>
          <Grid item xs={12} md={3}><TextField select fullWidth size="small" label="Procedure Modified?" value={values.procedureModifiedFlag ? 'YES':'NO'} onChange={e=>update('procedureModifiedFlag',e.target.value==='YES')}><MenuItem value="NO">No</MenuItem><MenuItem value="YES">Yes</MenuItem></TextField></Grid>
          <Grid item xs={12} md={3}><TextField select fullWidth size="small" label="Emergency / Unplanned?" value={values.emergencyUnplannedFlag ? 'YES':'NO'} onChange={e=>update('emergencyUnplannedFlag',e.target.value==='YES')}><MenuItem value="NO">No</MenuItem><MenuItem value="YES">Yes</MenuItem></TextField></Grid>
          <Grid item xs={12}><TextField fullWidth size="small" multiline minRows={2} label="Additional Procedure" value={values.additionalProcedureText} onChange={e=>update('additionalProcedureText',e.target.value)} /></Grid>
          <Grid item xs={12} md={4}><TextField fullWidth size="small" label="Anaesthesia Type" value={values.anaesthesiaType} onChange={e=>update('anaesthesiaType',e.target.value)} /></Grid>
          <Grid item xs={12} md={8}><TextField fullWidth size="small" multiline minRows={2} label="Complications" value={values.complications} onChange={e=>update('complications',e.target.value)} /></Grid>
          {([
            ['equipmentUsed','Equipment Used'],['implantsUsed','Implants Used'],['suturesUsed','Sutures Used'],['staplersStaplesUsed','Staplers / Staples Used'],['otherMaterialsUsed','Other Materials Used'],['specialInstructions','Special Instructions'],['postOpInstructions','Post-Op Instructions'],['remarks','Remarks'],
          ] as const).map(([key,label])=><Grid item xs={12} md={6} key={key}><TextField fullWidth size="small" multiline minRows={2} label={label} value={values[key]} onChange={e=>update(key,e.target.value)} /></Grid>)}
        </Grid>
        {canEdit&&<Stack direction="row" justifyContent="flex-end" mt={2}><Button variant="contained" startIcon={<SaveIcon/>} onClick={save}>Save Actuals</Button></Stack>}
      </Paper>

      <Paper sx={{ p: 2.5, mb: 2.5 }}>
        <Typography fontWeight={700} mb={1.5}>Actual Surgical Team</Typography>
        <Grid container spacing={2}>{TEAM_ROLES.map(([role,label])=><Grid item xs={12} md={6} key={role}><Autocomplete multiple size="small" options={staffForRole(role)} getOptionLabel={(s: Staff)=>s.name} value={staffForRole(role).filter(s=>(team[role] ?? currentTeam.filter(m=>m.teamRole===role).map(m=>m.staffId)).includes(s.staffId))} onChange={(_,v)=>setTeam(t=>({...t,[role]:v.map(x=>x.staffId)}))} renderInput={params=><TextField {...params} label={label} placeholder="Select staff"/>}/></Grid>)}</Grid>
        <Typography variant="caption" color="text.secondary" display="block" mt={1}>Team selections are saved with the actuals.</Typography>
      </Paper>

      <Paper sx={{ p: 2.5 }}>
        <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1.5}>
          <Box><Typography fontWeight={700}>Timeline</Typography><Typography variant="caption" color="text.secondary">Actual duration: {current.actualDurationMinutes == null ? '—' : `${current.actualDurationMinutes} min`}</Typography></Box>
          <Button variant="contained" color="success" startIcon={<CheckCircleIcon/>} onClick={markCompleted} disabled={current.surgery.status==='SURGERY_COMPLETED'}>Mark Surgery Completed</Button>
        </Stack>
        <Divider sx={{mb:1}}/>
        <TableContainer><Table size="small"><TableHead><TableRow><TableCell>Event</TableCell><TableCell>Date / Time</TableCell><TableCell>Recorded By</TableCell><TableCell width={70}/></TableRow></TableHead><TableBody>{EVENTS.map(([type,label])=>{const e=currentEvents.find(x=>x.eventType===type);return <TableRow key={type} hover><TableCell><Stack direction="row" spacing={1} alignItems="center"><Chip size="small" label={e?'Done':'Pending'} color={e?'success':'default'}/><Typography fontSize={13}>{label}</Typography></Stack></TableCell><TableCell>{e ? new Date(e.eventDatetime).toLocaleString() : '—'}</TableCell><TableCell>{e?.recordedByName ?? '—'}</TableCell><TableCell>{canEdit&&(e ? <Button size="small" color="error" onClick={()=>removeEvent(e.eventId)}><DeleteOutlineIcon fontSize="small"/></Button> : <Button size="small" variant="outlined" startIcon={<PlayArrowIcon/>} onClick={()=>addEvent(type)}>Start</Button>)}</TableCell></TableRow>})}</TableBody></Table></TableContainer>
      </Paper>
    </Box>
  );
}

export function SurgeryDayActualsListPage() {
  const navigate = useNavigate();
  const { data, isLoading } = useQuery({ queryKey: ['actuals-schedules'], queryFn: () => schedulingApi.listSchedules({ limit: 200 }) });
  const rows = (data?.data ?? []).filter(s => ['CONFIRMED','IN_PROGRESS'].includes(s.status));
  return <Box><PageHeader title="Surgery-Day Actuals" subtitle="Record what actually happened during a scheduled surgery." />{isLoading?<CircularProgress/>:<TableContainer component={Paper}><Table><TableHead><TableRow><TableCell>Surgery</TableCell><TableCell>Patient</TableCell><TableCell>Planned Date</TableCell><TableCell>OT</TableCell><TableCell>Status</TableCell><TableCell/></TableRow></TableHead><TableBody>{rows.map(s=><TableRow key={s.surgeryId} hover><TableCell>{s.surgeryNumber ?? s.surgeryId.slice(0,8)}</TableCell><TableCell>{s.patientFullName ?? '—'}<Typography variant="caption" display="block" color="text.secondary">{s.mrNumber ?? ''}</Typography></TableCell><TableCell>{s.plannedDate}</TableCell><TableCell>{s.roomName ?? '—'}</TableCell><TableCell><Chip size="small" label={s.status}/></TableCell><TableCell><Button variant="outlined" size="small" onClick={()=>navigate(`/surgery-day-actuals/${s.surgeryId}`)}>Open Actuals</Button></TableCell></TableRow>)}</TableBody></Table></TableContainer>}</Box>;
}
