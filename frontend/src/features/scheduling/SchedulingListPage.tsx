import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, TextField, MenuItem, Button, Stack, Typography, Chip,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, InputAdornment, IconButton,
  Dialog, DialogTitle, DialogContent, DialogActions, Grid, Alert,
  CircularProgress,
} from '@mui/material';
import SearchIcon        from '@mui/icons-material/Search';
import EditIcon          from '@mui/icons-material/Edit';
import SaveIcon          from '@mui/icons-material/Save';
import AssignmentIcon    from '@mui/icons-material/Assignment';
import FolderOpenIcon    from '@mui/icons-material/FolderOpen';
import InfoOutlinedIcon  from '@mui/icons-material/InfoOutlined';
import DeleteOutlineIcon from '@mui/icons-material/DeleteOutline';
import Tooltip           from '@mui/material/Tooltip';
import { PageHeader }  from '@/components/common/PageHeader';
import { DateInput }   from '@/components/common/DateInput';
import * as schedApi   from '@/api/scheduling.api';
import type { ScheduleStatus, SchedulePriority } from '@/api/scheduling.api';
import { useOtRooms }  from '@/hooks/useMasterData';
import { formatDate }  from '@/utils/format';
import { getErrorMessage } from '@/api/client';
import { StatusChip } from '@/components/common/StatusChip';


const PRIORITY_COLOR: Record<SchedulePriority, 'default' | 'warning' | 'error'> = {
  ROUTINE: 'default', URGENT: 'warning', EMERGENCY: 'error',
};

// ── Inline Edit Modal ─────────────────────────────────────────────────────────
function EditScheduleModal({
  open, schedule, onClose, onSaved,
}: {
  open: boolean;
  schedule: any;
  onClose: () => void;
  onSaved: () => void;
}) {
  const { data: otRooms = [] } = useOtRooms();
  const [otRoomId, setOtRoomId]       = useState(schedule?.otRoomId ?? '');
  const [startTime, setStartTime]     = useState((schedule?.plannedStartTime ?? '').slice(0,5));
  const [duration, setDuration]       = useState<number>(schedule?.expectedDurationMin ?? 60);
  const [saving, setSaving]           = useState(false);
  const [error, setError]             = useState('');

  // Reset when schedule changes
  useState(() => {
    setOtRoomId(schedule?.otRoomId ?? '');
    setStartTime((schedule?.plannedStartTime ?? '').slice(0,5));
    setDuration(schedule?.expectedDurationMin ?? 60);
    setError('');
  });

  async function handleSave() {
    setSaving(true); setError('');
    try {
      await schedApi.updateScheduleTimeDuration(schedule.scheduleId, {
        otRoomId:            otRoomId || undefined,
        plannedStartTime:    startTime || undefined,
        expectedDurationMin: duration,
      });
      onSaved();
      onClose();
    } catch (e) {
      setError(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  if (!schedule) return null;

  return (
    <Dialog open={open} onClose={onClose} maxWidth="sm" fullWidth>
      <DialogTitle>
        Edit OT Schedule — {schedule.surgeryNumber ?? schedule.scheduleId?.slice(0, 8)}
      </DialogTitle>
      <DialogContent sx={{ pt: '16px !important' }}>
        {error && <Alert severity="error" sx={{ mb: 2 }}>{error}</Alert>}
        <Typography variant="body2" color="text.secondary" sx={{ mb: 2 }}>
          Patient: <strong>{schedule.patientFullName}</strong> &nbsp;·&nbsp;
          Surgery Date: <strong>{formatDate(schedule.plannedDate)}</strong> (readonly)
        </Typography>
        <Grid container spacing={2}>
          <Grid item xs={12}>
            <TextField select label="OT Room" fullWidth value={otRoomId}
              onChange={(e) => setOtRoomId(e.target.value)} size="small">
              <MenuItem value="">— No room assigned —</MenuItem>
              {otRooms.map((r) => (
                <MenuItem key={r.otRoomId} value={r.otRoomId}>
                  {r.roomName}{r.roomType ? ` (${r.roomType})` : ''}
                </MenuItem>
              ))}
            </TextField>
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Start Time" type="time" fullWidth size="small"
              value={startTime}
              onChange={(e) => setStartTime(e.target.value)}
              InputLabelProps={{ shrink: true }}
              inputProps={{ step: 300 }}
            />
          </Grid>
          <Grid item xs={6}>
            <TextField
              label="Duration (minutes)" type="number" fullWidth size="small"
              value={duration}
              onChange={(e) => setDuration(Number(e.target.value))}
              inputProps={{ min: 1 }}
            />
          </Grid>
        </Grid>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2 }}>
        <Button onClick={onClose} disabled={saving}>Cancel</Button>
        <Button
          variant="contained" startIcon={saving ? <CircularProgress size={16} color="inherit" /> : <SaveIcon />}
          onClick={handleSave} disabled={saving}
        >
          {saving ? 'Saving…' : 'Save'}
        </Button>
      </DialogActions>
    </Dialog>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────
export function SchedulingListPage() {
  const navigate = useNavigate();
  const qc = useQueryClient();
  const [dateFrom, setDateFrom] = useState('');
  const [dateTo,   setDateTo]   = useState('');
  const [status,   setStatus]   = useState('');
  const [search,   setSearch]   = useState('');
  const [editTarget,   setEditTarget]   = useState<any>(null);
  const [deleteTarget, setDeleteTarget] = useState<any>(null);

  const deleteMutation = useMutation({
    mutationFn: (scheduleId: string) => schedApi.deleteSchedule(scheduleId),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['schedules'] });
      setDeleteTarget(null);
    },
  });

  const { data, isLoading } = useQuery({
    queryKey: ['schedules', dateFrom, dateTo, status, search],
    queryFn: () => schedApi.listSchedules({
      dateFrom:  dateFrom || undefined,
      dateTo:    dateTo   || undefined,
      status:    status   || undefined,
      limit: 200,
    }),
  });

  const rows = data?.data ?? [];

  const filteredRows = search
    ? rows.filter((r: any) =>
        r.patientFullName?.toLowerCase().includes(search.toLowerCase()) ||
        r.mrNumber?.toLowerCase().includes(search.toLowerCase()) ||
        r.surgeryNumber?.toLowerCase().includes(search.toLowerCase())
      )
    : rows;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="flex-start" sx={{ mb: 3 }}>
        <PageHeader
          title="OT Scheduling"
          subtitle="OT schedules are auto-created when a Surgery Entry is marked Scheduled. Use Edit to set OT Room, Time and Duration."
        />
      </Stack>

      {/* Filters — no OT Room filter in the list per requirements */}
      <Stack direction="row" spacing={2} sx={{ mb: 2.5 }} flexWrap="wrap" useFlexGap>
        <TextField
          label="Search" size="small" sx={{ width: 240 }}
          value={search} onChange={(e) => setSearch(e.target.value)}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
        />
        <DateInput label="From" value={dateFrom} onChange={setDateFrom} size="small" sx={{ width: 170 }} />
        <DateInput label="To"   value={dateTo}   onChange={setDateTo}   size="small" sx={{ width: 170 }} />
        <TextField label="Status" select size="small" sx={{ minWidth: 150 }}
          value={status} onChange={(e) => setStatus(e.target.value)}>
          <MenuItem value="">All Statuses</MenuItem>
          {(['DRAFT','CONFIRMED','IN_PROGRESS','COMPLETED','POSTPONED','CANCELLED'] as ScheduleStatus[]).map((s) => (
            <MenuItem key={s} value={s}>{s}</MenuItem>
          ))}
        </TextField>
        <Button variant="text" size="small"
          onClick={() => { setDateFrom(''); setDateTo(''); setStatus(''); setSearch(''); }}>
          Clear
        </Button>
      </Stack>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              <TableCell sx={{ fontWeight:700 }}>Surgery ID</TableCell>
              <TableCell sx={{ fontWeight:700 }}>Patient</TableCell>
              <TableCell sx={{ fontWeight:700 }}>Surgery Date</TableCell>
              <TableCell sx={{ fontWeight:700 }}>Start Time</TableCell>
              <TableCell sx={{ fontWeight:700 }}>Duration</TableCell>
              <TableCell sx={{ fontWeight:700 }}>OT Room</TableCell>
              <TableCell sx={{ fontWeight:700 }}>Surgeon</TableCell>
              <TableCell sx={{ fontWeight:700 }}>Priority</TableCell>
              <TableCell sx={{ fontWeight:700 }}>Status</TableCell>
              <TableCell sx={{ fontWeight:700, width:160 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {isLoading
              ? <TableRow><TableCell colSpan={10} align="center" sx={{ py:3 }}>Loading…</TableCell></TableRow>
              : filteredRows.length === 0
              ? <TableRow><TableCell colSpan={10} align="center" sx={{ py:3, color:'text.secondary' }}>No schedules found</TableCell></TableRow>
              : filteredRows.map((sched: any) => (
                <TableRow key={sched.scheduleId} hover>
                  <TableCell>
                    <Typography variant="caption" sx={{ fontFamily:'monospace', fontWeight:700 }}>
                      {sched.surgeryNumber ?? '—'}
                    </Typography>
                  </TableCell>
                  <TableCell>
                    <Typography variant="body2">{sched.patientFullName}</Typography>
                    <Typography variant="caption" color="text.secondary">{sched.mrNumber}</Typography>
                  </TableCell>
                  <TableCell>{formatDate(sched.plannedDate)}</TableCell>
                  <TableCell>{(sched.plannedStartTime ?? '').slice(0,5) || '—'}</TableCell>
                  <TableCell>{sched.expectedDurationMin ? `${sched.expectedDurationMin} min` : '—'}</TableCell>
                  <TableCell>
                    {sched.roomName
                      ? <><Typography variant="body2">{sched.roomName}</Typography>
                          {sched.roomCode && <Typography variant="caption" color="text.secondary">{sched.roomCode}</Typography>}</>
                      : <Typography variant="body2" color="text.secondary">—</Typography>
                    }
                  </TableCell>
                  <TableCell>{sched.primarySurgeonName ?? '—'}</TableCell>
                  <TableCell>
                    <Chip label={sched.priority} color={PRIORITY_COLOR[sched.priority as SchedulePriority]} size="small" />
                  </TableCell>
                  <TableCell>
                    <StatusChip status={sched.status} />
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <Tooltip title="OT Details">
                        <IconButton
                          size="small"
                          onClick={() => navigate(`/scheduling/${sched.scheduleId}?tab=details`)}
                        >
                          <InfoOutlinedIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      {sched.status !== 'CANCELLED' && (
                        <Tooltip title="Edit OT Room / Time / Duration">
                          <IconButton size="small" onClick={() => setEditTarget(sched)}>
                            <EditIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      {sched.status === 'CANCELLED' && (
                        <Tooltip title="Delete cancelled schedule record">
                          <IconButton size="small" color="error" onClick={() => setDeleteTarget(sched)}>
                            <DeleteOutlineIcon fontSize="small" />
                          </IconButton>
                        </Tooltip>
                      )}
                      <Tooltip title="Pre-Op Checklist">
                        <IconButton
                          size="small"
                          color="primary"
                          onClick={() => navigate(`/scheduling/${sched.scheduleId}?tab=preop`)}
                        >
                          <AssignmentIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                      <Tooltip title="Documentation">
                        <IconButton
                          size="small"
                          color="secondary"
                          onClick={() => navigate(`/scheduling/${sched.scheduleId}?tab=docs`)}
                        >
                          <FolderOpenIcon fontSize="small" />
                        </IconButton>
                      </Tooltip>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </TableContainer>

      {/* Edit modal — OT Room editable only here */}
      <EditScheduleModal
        open={!!editTarget}
        schedule={editTarget}
        onClose={() => setEditTarget(null)}
        onSaved={() => {
          qc.invalidateQueries({ queryKey: ['schedules'] });
          setEditTarget(null);
        }}
      />

      {/* Delete confirmation — CANCELLED schedules only */}
      <Dialog open={!!deleteTarget} onClose={() => setDeleteTarget(null)} maxWidth="xs" fullWidth>
        <DialogTitle>Delete Cancelled Schedule?</DialogTitle>
        <DialogContent>
          {deleteMutation.isError && (
            <Alert severity="error" sx={{ mb: 2 }}>
              {getErrorMessage(deleteMutation.error as Error)}
            </Alert>
          )}
          <Typography variant="body2">
            This will permanently delete the OT schedule record for{' '}
            <strong>{deleteTarget?.surgeryNumber ?? deleteTarget?.scheduleId?.slice(0, 8)}</strong>{' '}
            ({deleteTarget?.patientFullName}).
          </Typography>
          <Typography variant="body2" color="text.secondary" sx={{ mt: 1 }}>
            The Surgery Entry record and patient will NOT be affected.
          </Typography>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDeleteTarget(null)} disabled={deleteMutation.isPending}>
            Cancel
          </Button>
          <Button
            variant="contained"
            color="error"
            disabled={deleteMutation.isPending}
            startIcon={deleteMutation.isPending ? <CircularProgress size={16} color="inherit" /> : undefined}
            onClick={() => deleteMutation.mutate(deleteTarget.scheduleId)}
          >
            {deleteMutation.isPending ? 'Deleting…' : 'Delete Schedule'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
