/**
 * PreOpChecklistPage — Module 4
 *
 * Flow:
 *   Surgery Entry → OT Scheduling (list) → [Checklist icon] → PreOpChecklistPage
 *
 * URL: /scheduling/:scheduleId/preop-checklist
 *
 * 1. Reads :scheduleId from route params.
 * 2. Fetches the schedule to get the surgery_id and surgery context.
 * 3. Calls GET /preop/surgery/:surgeryId which:
 *      - looks up the surgery's procedure (surgery_type_id)
 *      - finds the active checklist template for that procedure
 *      - returns template + items ordered by sort_order
 * 4. Displays the read-only checklist (items from template, no hardcoding).
 * 5. Tracks per-item completion state locally (checked / unchecked).
 *
 * No new surgery is created. Uses the existing surgery_id linked to the schedule.
 */

import { useState, useEffect, useCallback } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Paper, Typography, Stack, Chip, Alert, CircularProgress,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Checkbox, Divider, Button, LinearProgress, Snackbar,
} from '@mui/material';
import ArrowBackIcon      from '@mui/icons-material/ArrowBack';
import CheckCircleIcon    from '@mui/icons-material/CheckCircle';
import SaveIcon           from '@mui/icons-material/Save';
import AssignmentTurnedInIcon from '@mui/icons-material/AssignmentTurnedIn';
import InfoOutlinedIcon   from '@mui/icons-material/InfoOutlined';
import * as schedApi      from '@/api/scheduling.api';
import * as preopApi      from '@/api/preop.api';
import type { SurgeryPreOpChecklist } from '@/api/types';
import type { CompletionMap } from '@/api/preop.api';
import { formatDate }     from '@/utils/format';

// ── helpers ───────────────────────────────────────────────────────────────────

const STATUS_COLOR: Record<string, 'default' | 'info' | 'warning' | 'success' | 'error'> = {
  DRAFT: 'info', CONFIRMED: 'success', IN_PROGRESS: 'warning',
  COMPLETED: 'success', POSTPONED: 'warning', CANCELLED: 'error',
};

// ── Page ──────────────────────────────────────────────────────────────────────

export function PreOpChecklistPage() {
  const { scheduleId } = useParams<{ scheduleId?: string }>();
  const navigate = useNavigate();

  // ── Standalone sidebar route: /preop-checklist (no scheduleId) ──────────
  if (!scheduleId) {
    return (
      <Box sx={{ py: 6, textAlign: 'center' }}>
        <InfoOutlinedIcon sx={{ fontSize: 48, color: 'text.secondary', mb: 2 }} />
        <Typography variant="h6" fontWeight={700} gutterBottom>
          Open Pre-Op Checklist from OT Scheduling
        </Typography>
        <Typography variant="body2" color="text.secondary" mb={3}>
          Click the checklist icon <AssignmentTurnedInIcon fontSize="small" sx={{ verticalAlign: 'middle' }} /> on
          any surgery row in OT Scheduling to view its Pre-Op Checklist.
        </Typography>
        <Button variant="contained" onClick={() => navigate('/scheduling')}>
          Go to OT Scheduling
        </Button>
      </Box>
    );
  }

  // ── 1. Fetch the schedule (to get surgery_id + patient context) ──────────
  const {
    data: schedule,
    isLoading: schedLoading,
    isError: schedError,
  } = useQuery({
    queryKey: ['schedule', scheduleId],
    queryFn: () => schedApi.getSchedule(scheduleId!),
    enabled: !!scheduleId,
  });

  const surgeryId = schedule?.surgeryId;

  // ── 2. Fetch the Pre-Op Checklist for the surgery ────────────────────────
  const {
    data: checklist,
    isLoading: clLoading,
    isError: clError,
  } = useQuery<SurgeryPreOpChecklist>({
    queryKey: ['preop-checklist', surgeryId],
    queryFn: () => preopApi.getChecklistForSurgery(surgeryId!),
    enabled: !!surgeryId,
  });

  // ── 3. Fetch persisted completion state ──────────────────────────────────
  const {
    data: savedCompletion,
    isLoading: compLoading,
  } = useQuery<CompletionMap>({
    queryKey: ['preop-completion', surgeryId],
    queryFn: () => preopApi.getCompletion(surgeryId!),
    enabled: !!surgeryId,
  });

  // ── 4. Local checked state, seeded from savedCompletion ──────────────────
  const [checked, setChecked] = useState<Record<string, boolean>>({});
  const [snack, setSnack] = useState('');

  // Seed from DB when completion data arrives
  useEffect(() => {
    if (!savedCompletion) return;
    const initial: Record<string, boolean> = {};
    for (const [itemId, val] of Object.entries(savedCompletion)) {
      initial[itemId] = val.isChecked;
    }
    setChecked(initial);
  }, [savedCompletion]);

  // ── 5. Save mutation ──────────────────────────────────────────────────────
  const qc = useQueryClient();
  const saveMutation = useMutation({
    mutationFn: (completions: { itemId: string; isChecked: boolean }[]) =>
      preopApi.saveCompletion(surgeryId!, completions),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ['preop-completion', surgeryId] });
      setSnack('Checklist saved.');
    },
  });

  const handleSave = useCallback(() => {
    const items = checklist?.items ?? [];
    const completions = items.map((item) => ({
      itemId: item.itemId,
      isChecked: !!checked[item.itemId],
    }));
    saveMutation.mutate(completions);
  }, [checklist, checked, saveMutation]);

  function toggleItem(itemId: string) {
    setChecked((prev) => ({ ...prev, [itemId]: !prev[itemId] }));
  }

  // ── CANCELLED guard — show info but block all editing ────────────────────
  const isCancelled = schedule?.status === 'CANCELLED';

  const items = checklist?.items ?? [];
  const checkedCount = items.filter((i) => checked[i.itemId]).length;
  const totalCount   = items.length;
  const progressPct  = totalCount > 0 ? Math.round((checkedCount / totalCount) * 100) : 0;
  const allDone      = totalCount > 0 && checkedCount === totalCount;

  // ── Render ────────────────────────────────────────────────────────────────

  const isLoading = schedLoading || clLoading || compLoading;
  const isError   = schedError || clError;

  return (
    <Box>
      {/* Header */}
      <Stack direction="row" alignItems="center" spacing={1.5} sx={{ mb: 2 }}>
        <Button
          startIcon={<ArrowBackIcon />}
          variant="outlined"
          size="small"
          onClick={() => navigate('/scheduling')}
        >
          Back to OT Scheduling
        </Button>
        <Box>
          <Typography variant="h6" fontWeight={700} lineHeight={1.2}>
            Pre-Op Checklist
          </Typography>
          <Typography variant="caption" color="text.secondary">
            Verify all pre-operative checklist items before proceeding to surgery.
          </Typography>
        </Box>
      </Stack>

      {/* Surgery Context Card */}
      {schedule && (
        <Paper variant="outlined" sx={{ px: 2, py: 1.25, mb: 2 }}>
          <Stack direction="row" spacing={2.5} flexWrap="wrap" useFlexGap>
            <Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>Surgery ID</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 700, fontFamily: 'monospace', lineHeight: 1.4 }}>
                {schedule.surgeryNumber ?? schedule.surgeryId?.slice(0, 8)}
              </Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>Patient</Typography>
              <Typography sx={{ fontSize: 13, fontWeight: 600, lineHeight: 1.4 }}>{schedule.patientFullName ?? '—'}</Typography>
              {schedule.mrNumber && (
                <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.2 }}>{schedule.mrNumber}</Typography>
              )}
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>Surgery Date</Typography>
              <Typography sx={{ fontSize: 13, lineHeight: 1.4 }}>{formatDate(schedule.plannedDate)}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>OT Room</Typography>
              <Typography sx={{ fontSize: 13, lineHeight: 1.4 }}>{schedule.roomName ?? '—'}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3 }}>Surgeon</Typography>
              <Typography sx={{ fontSize: 13, lineHeight: 1.4 }}>{schedule.primarySurgeonName ?? '—'}</Typography>
            </Box>
            <Box>
              <Typography sx={{ fontSize: 11, color: 'text.secondary', lineHeight: 1.3, mb: 0.25 }}>Status</Typography>
              <Chip
                label={schedule.status}
                color={STATUS_COLOR[schedule.status] ?? 'default'}
                size="small"
              />
            </Box>
          </Stack>
        </Paper>
      )}

      {/* Cancelled banner — shown immediately after context card, blocks editing */}
      {!isLoading && isCancelled && (
        <Alert severity="error" sx={{ mb: 2 }}>
          This surgery has been <strong>CANCELLED</strong>. The checklist is shown for reference only
          and cannot be edited.
        </Alert>
      )}

      {/* Loading */}
      {isLoading && (
        <Box sx={{ py: 6, textAlign: 'center' }}>
          <CircularProgress size={32} />
          <Typography variant="body2" color="text.secondary" mt={2}>
            Loading checklist…
          </Typography>
        </Box>
      )}

      {/* Error */}
      {!isLoading && isError && (
        <Alert severity="error">Failed to load the Pre-Op Checklist. Please try again.</Alert>
      )}

      {/* No template */}
      {!isLoading && !isError && checklist && !checklist.template && (
        <Alert severity="info" sx={{ mt: 2 }}>
          {checklist.message ?? 'No active Pre-Op Checklist template found for this procedure.'}
          <br />
          <Typography variant="caption">
            Go to <strong>Master Config → Pre-Op Checklist Template</strong> to configure one.
          </Typography>
        </Alert>
      )}

      {/* Checklist */}
      {!isLoading && !isError && checklist?.template && (
        <Paper variant="outlined" sx={{ p: 2 }}>
          {/* Template info */}
          <Stack direction="row" spacing={1.5} alignItems="center" mb={1.5}>
            <AssignmentTurnedInIcon color="primary" />
            <Box flex={1}>
              <Typography variant="subtitle1" fontWeight={700}>
                {checklist.template.procedureName}
              </Typography>
              <Typography variant="caption" color="text.secondary">
                Template ID: {checklist.template.templateId?.slice(0, 8)}… &nbsp;·&nbsp;
                Procedure Code: {checklist.template.procedureCode}
              </Typography>
            </Box>
            <Chip
              label={checklist.template.isActive ? 'Active Template' : 'Inactive Template'}
              color={checklist.template.isActive ? 'success' : 'default'}
              size="small"
            />
          </Stack>

          <Divider sx={{ mb: 2 }} />

          {/* Progress bar */}
          {totalCount > 0 && (
            <Box sx={{ mb: 2.5 }}>
              <Stack direction="row" justifyContent="space-between" mb={0.5}>
                <Typography variant="caption" color="text.secondary">
                  Completion Progress
                </Typography>
                <Typography variant="caption" fontWeight={700} color={allDone ? 'success.main' : 'text.primary'}>
                  {checkedCount} / {totalCount} items &nbsp;({progressPct}%)
                </Typography>
              </Stack>
              <LinearProgress
                variant="determinate"
                value={progressPct}
                color={allDone ? 'success' : 'primary'}
                sx={{ height: 8, borderRadius: 4 }}
              />
              {allDone && (
                <Stack direction="row" spacing={1} alignItems="center" mt={1}>
                  <CheckCircleIcon color="success" fontSize="small" />
                  <Typography variant="caption" color="success.main" fontWeight={600}>
                    All items completed — patient is ready for surgery.
                  </Typography>
                </Stack>
              )}
            </Box>
          )}

          {/* No items */}
          {totalCount === 0 && (
            <Alert severity="warning">
              This template has no checklist items. Add items in Master Config → Pre-Op Checklist Template.
            </Alert>
          )}

          {/* Items table */}
          {totalCount > 0 && (
            <TableContainer>
              <Table size="small">
                <TableHead>
                  <TableRow sx={{ bgcolor: 'grey.50' }}>
                    <TableCell sx={{ fontWeight: 700, width: 60 }}>#</TableCell>
                    <TableCell sx={{ fontWeight: 700 }}>Checklist Item</TableCell>
                    <TableCell sx={{ fontWeight: 700, width: 100, textAlign: 'center' }}>Done</TableCell>
                  </TableRow>
                </TableHead>
                <TableBody>
                  {items.map((item) => {
                    const isDone = !!checked[item.itemId];
                    return (
                      <TableRow
                        key={item.itemId}
                        hover={!isCancelled}
                        sx={{
                          cursor: isCancelled ? 'default' : 'pointer',
                          bgcolor: isDone ? 'success.50' : undefined,
                          '&:hover': isCancelled ? {} : { bgcolor: isDone ? 'success.100' : 'action.hover' },
                        }}
                        onClick={() => !isCancelled && toggleItem(item.itemId)}
                      >
                        <TableCell>
                          <Chip label={item.sortOrder} size="small" variant="outlined" />
                        </TableCell>
                        <TableCell>
                          <Typography
                            fontSize={13}
                            sx={{
                              textDecoration: isDone ? 'line-through' : 'none',
                              color: isDone ? 'text.secondary' : 'text.primary',
                            }}
                          >
                            {item.checklistItem}
                          </Typography>
                        </TableCell>
                        <TableCell sx={{ textAlign: 'center' }}>
                          <Checkbox
                            checked={isDone}
                            onChange={() => !isCancelled && toggleItem(item.itemId)}
                            onClick={(e) => e.stopPropagation()}
                            color="success"
                            size="small"
                            disabled={isCancelled}
                          />
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </TableContainer>
          )}

          {/* Save button */}
          {totalCount > 0 && (
            <Stack direction="row" justifyContent="flex-end" mt={2}>
              <Button
                variant="contained"
                color={allDone ? 'success' : 'primary'}
                startIcon={saveMutation.isPending
                  ? <CircularProgress size={16} color="inherit" />
                  : allDone ? <CheckCircleIcon /> : <SaveIcon />}
                onClick={handleSave}
                disabled={saveMutation.isPending || isCancelled}
              >
                {saveMutation.isPending ? 'Saving…' : allDone ? 'Save — All Done' : 'Save Progress'}
              </Button>
            </Stack>
          )}
        </Paper>
      )}

      {/* Snackbar feedback */}
      <Snackbar
        open={!!snack}
        autoHideDuration={3000}
        onClose={() => setSnack('')}
        message={snack}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
      />
    </Box>
  );
}
