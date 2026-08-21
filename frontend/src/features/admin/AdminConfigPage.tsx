import { useState } from 'react';
import { useQuery, useMutation, useQueryClient } from '@tanstack/react-query';
import {
  Box, Tabs, Tab, Alert, Button, Chip, Dialog, DialogTitle,
  DialogContent, DialogActions, TextField, MenuItem, Select,
  FormControl, InputLabel, IconButton, Typography, Stack,
  Table, TableHead, TableBody, TableRow, TableCell, TableContainer,
  Paper, CircularProgress, Switch, FormControlLabel,
} from '@mui/material';
import {
  MedicalServices, MeetingRoom, LocalHospital,
  PeopleAlt, Bloodtype, BadgeOutlined, Checklist,
  Add, Delete, Edit, CheckCircle, Cancel,
} from '@mui/icons-material';
import { PageHeader } from '@/components/common/PageHeader';
import { MasterCrudTable } from '@/components/common/MasterCrudTable';
import {
  departmentsCrud, otRoomsCrud, proceduresCrud,
  appUsersCrud, bloodGroupsCrud, staffCrud,
} from '@/api/masters.api';
import { useDepartments } from '@/hooks/useMasterData';
import type { Department, OtRoom, SurgeryType, AppUser, BloodGroupOption, Staff, PreOpChecklistTemplate } from '@/api/types';
import * as preopApi from '@/api/preop.api';
import { getErrorMessage } from '@/api/client';

const MAIN_BRANCH = '00000000-0000-0000-0000-000000000001';

// ── Departments ───────────────────────────────────────────────────────────────
function DepartmentsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'departments', search],
    queryFn: () => departmentsCrud.list({ search, limit: 200 }),
  });
  const rows: Department[] = (data?.data ?? []) as Department[];

  const create  = useMutation({ mutationFn: (d: Record<string, unknown>) => departmentsCrud.create(d),              onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }) });
  const update  = useMutation({ mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => departmentsCrud.update(id, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }) });
  const deact   = useMutation({ mutationFn: (id: string) => departmentsCrud.deactivate(id),                         onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }) });
  const activate = useMutation({ mutationFn: (id: string) => departmentsCrud.activate(id),                          onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'departments'] }) });

  return (
    <MasterCrudTable<Department>
      title="Departments" idKey="departmentId" loading={isLoading} rows={rows} onSearch={setSearch}
      columns={[
        { header: 'Code', render: (r) => r.departmentCode },
        { header: 'Name', render: (r) => r.departmentName },
      ]}
      fields={[
        { key: 'departmentCode', label: 'Department Code', required: true },
        { key: 'departmentName', label: 'Department Name', required: true },
      ]}
      onCreate={(d) => create.mutateAsync({ branchId: MAIN_BRANCH, departmentCode: d.departmentCode, departmentName: d.departmentName })}
      onUpdate={(id, d) => update.mutateAsync({ id, d: { departmentCode: d.departmentCode, departmentName: d.departmentName } })}
      onDeactivate={(id) => deact.mutateAsync(id)}
      onActivate={(id) => activate.mutateAsync(id)}
      getInitialValues={(r) => ({ departmentCode: r.departmentCode, departmentName: r.departmentName })}
    />
  );
}

// ── OT Rooms ──────────────────────────────────────────────────────────────────
const OT_ROOM_TYPES = ['Major', 'Minor', 'Cath Lab'];

function OtRoomsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'ot-rooms', search],
    queryFn: () => otRoomsCrud.list({ search, limit: 200 }),
  });
  const rows: OtRoom[] = (data?.data ?? []) as OtRoom[];

  const create   = useMutation({ mutationFn: (d: Record<string, unknown>) => otRoomsCrud.create(d),              onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ot-rooms'] }) });
  const update   = useMutation({ mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => otRoomsCrud.update(id, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ot-rooms'] }) });
  const deact    = useMutation({ mutationFn: (id: string) => otRoomsCrud.deactivate(id),                         onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ot-rooms'] }) });
  const activate = useMutation({ mutationFn: (id: string) => otRoomsCrud.activate(id),                          onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'ot-rooms'] }) });

  return (
    <MasterCrudTable<OtRoom>
      title="OT Rooms" idKey="otRoomId" loading={isLoading} rows={rows} onSearch={setSearch}
      columns={[
        { header: 'Code',      render: (r) => r.roomCode, width: 80 },
        { header: 'Name',      render: (r) => r.roomName },
        { header: 'Type',      render: (r) => r.roomType ?? 'Major', width: 90 },
        { header: '₹/min',     render: (r) => Number(r.costPerMinute).toFixed(2), width: 80 },
      ]}
      fields={[
        { key: 'roomCode',       label: 'Room Code',              required: true },
        { key: 'roomName',       label: 'Room Name / Number',     required: true },
        { key: 'roomType',       label: 'Room Type',              required: true, type: 'select',
          options: OT_ROOM_TYPES.map((t) => ({ value: t, label: t })), defaultValue: 'Major' },
        { key: 'costPerMinute',  label: 'Cost per Minute (₹)',    type: 'text' },
      ]}
      onCreate={(d) => create.mutateAsync({ branchId: MAIN_BRANCH, roomCode: d.roomCode, roomName: d.roomName, roomType: d.roomType || 'Major', costPerMinute: Number(d.costPerMinute) || 0 })}
      onUpdate={(id, d) => update.mutateAsync({ id, d: { roomCode: d.roomCode, roomName: d.roomName, roomType: d.roomType || 'Major', costPerMinute: Number(d.costPerMinute) || 0 } })}
      onDeactivate={(id) => deact.mutateAsync(id)}
      onActivate={(id) => activate.mutateAsync(id)}
      getInitialValues={(r) => ({ roomCode: r.roomCode, roomName: r.roomName, roomType: r.roomType ?? 'Major', costPerMinute: String(r.costPerMinute) })}
    />
  );
}

// ── Procedures ────────────────────────────────────────────────────────────────
function ProceduresTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const { data: deptData } = useDepartments();
  const departments = deptData ?? [];

  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'procedures', search],
    queryFn: () => proceduresCrud.list({ search, limit: 200 }),
  });
  const rows: SurgeryType[] = (data?.data ?? []) as SurgeryType[];

  const create   = useMutation({ mutationFn: (d: Record<string, unknown>) => proceduresCrud.create(d),              onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'procedures'] }) });
  const update   = useMutation({ mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => proceduresCrud.update(id, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'procedures'] }) });
  const deact    = useMutation({ mutationFn: (id: string) => proceduresCrud.deactivate(id),                         onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'procedures'] }) });
  const activate = useMutation({ mutationFn: (id: string) => proceduresCrud.activate(id),                          onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'procedures'] }) });

  const deptName = (id?: string | null) =>
    departments.find((d) => d.departmentId === id)?.departmentName ?? '—';

  return (
    <MasterCrudTable<SurgeryType>
      title="Procedures" idKey="surgeryTypeId" loading={isLoading} rows={rows} onSearch={setSearch}
      columns={[
        { header: 'Code',        render: (r) => r.code, width: 80 },
        { header: 'Procedure',   render: (r) => r.name },
        { header: 'Department',  render: (r) => deptName(r.departmentId) },
        { header: 'Duration',    render: (r) => r.defaultDurationMin ? `${r.defaultDurationMin} min` : '—', width: 90 },
      ]}
      fields={[
        { key: 'code',               label: 'Procedure Code',        required: true },
        { key: 'name',               label: 'Procedure Name',        required: true },
        { key: 'departmentId',       label: 'Department',            type: 'select',
          options: departments.map((d) => ({ value: d.departmentId, label: d.departmentName })) },
        { key: 'defaultDurationMin', label: 'Default Duration (min)', type: 'text' },
        { key: 'packageName',        label: 'Package Name' },
      ]}
      onCreate={(d) => create.mutateAsync({
        code: d.code, name: d.name,
        departmentId: d.departmentId || undefined,
        defaultDurationMin: d.defaultDurationMin ? Number(d.defaultDurationMin) : undefined,
        packageName: d.packageName || undefined,
      })}
      onUpdate={(id, d) => update.mutateAsync({ id, d: {
        code: d.code, name: d.name,
        departmentId: d.departmentId || undefined,
        defaultDurationMin: d.defaultDurationMin ? Number(d.defaultDurationMin) : undefined,
        packageName: d.packageName || undefined,
      }})}
      onDeactivate={(id) => deact.mutateAsync(id)}
      onActivate={(id) => activate.mutateAsync(id)}
      getInitialValues={(r) => ({
        code: r.code, name: r.name,
        departmentId: r.departmentId ?? '',
        defaultDurationMin: String(r.defaultDurationMin ?? ''),
        packageName: r.packageName ?? '',
      })}
    />
  );
}

// ── Staff (unified: Surgeon, Anaesthetist, Assistant, Technician, Other) ──────
const STAFF_TYPES = ['Surgeon', 'Anaesthetist', 'Assistant', 'Technician', 'Other'];

function StaffTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'staff', search],
    queryFn: () => staffCrud.list({ search, limit: 200 }),
  });
  const rows: Staff[] = (data?.data ?? []) as Staff[];

  const create   = useMutation({ mutationFn: (d: Record<string, unknown>) => staffCrud.create(d),              onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'staff'] }); qc.invalidateQueries({ queryKey: ['masters'] }); } });
  const update   = useMutation({ mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => staffCrud.update(id, d), onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'staff'] }); qc.invalidateQueries({ queryKey: ['masters'] }); } });
  const deact    = useMutation({ mutationFn: (id: string) => staffCrud.deactivate(id),                         onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'staff'] }); qc.invalidateQueries({ queryKey: ['masters'] }); } });
  const activate = useMutation({ mutationFn: (id: string) => staffCrud.activate(id),                          onSuccess: () => { qc.invalidateQueries({ queryKey: ['admin', 'staff'] }); qc.invalidateQueries({ queryKey: ['masters'] }); } });

  return (
    <MasterCrudTable<Staff>
      title="Staff" idKey="staffId" loading={isLoading} rows={rows} onSearch={setSearch}
      columns={[
        { header: 'Name',       render: (r) => r.name },
        { header: 'Type',       render: (r) => r.staffType, width: 110 },
        { header: 'Emp. Code',  render: (r) => r.employeeCode ?? '—', width: 90 },
      ]}
      fields={[
        { key: 'name',         label: 'Full Name',    required: true },
        { key: 'staffType',    label: 'Staff Type',   required: true, type: 'select',
          options: STAFF_TYPES.map((t) => ({ value: t, label: t })), defaultValue: 'Surgeon' },
        { key: 'employeeCode', label: 'Employee Code' },
      ]}
      onCreate={(d) => create.mutateAsync({ branchId: MAIN_BRANCH, name: d.name, staffType: d.staffType, employeeCode: d.employeeCode || undefined })}
      onUpdate={(id, d) => update.mutateAsync({ id, d: { name: d.name, staffType: d.staffType, employeeCode: d.employeeCode || undefined } })}
      onDeactivate={(id) => deact.mutateAsync(id)}
      onActivate={(id) => activate.mutateAsync(id)}
      getInitialValues={(r) => ({ name: r.name, staffType: r.staffType, employeeCode: r.employeeCode ?? '' })}
    />
  );
}

// ── App Users ─────────────────────────────────────────────────────────────────
const ROLES = ['ADMIN','FINANCE','VIEWER','OT_COORDINATOR','DOCTOR','MANAGER'];

function AppUsersTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'app-users', search],
    queryFn: () => appUsersCrud.list({ search, limit: 200 }),
  });
  const rows: AppUser[] = (data?.data ?? []) as AppUser[];

  const create = useMutation({ mutationFn: (d: Record<string, unknown>) => appUsersCrud.create(d), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'app-users'] }) });
  const update = useMutation({ mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => appUsersCrud.update(id, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'app-users'] }) });
  const deact  = useMutation({ mutationFn: (id: string) => appUsersCrud.deactivate(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'app-users'] }) });

  return (
    <MasterCrudTable<AppUser>
      title="App Users" idKey="userId" loading={isLoading} rows={rows} onSearch={setSearch}
      columns={[
        { header: 'Username',  render: (r) => r.username },
        { header: 'Full Name', render: (r) => r.fullName },
        { header: 'Email',     render: (r) => r.email },
        { header: 'Role',      render: (r) => r.role },
      ]}
      fields={[
        { key: 'username', label: 'Username',  required: true },
        { key: 'fullName', label: 'Full Name', required: true },
        { key: 'email',    label: 'Email',     required: true, type: 'email' as const },
        { key: 'password', label: 'Password',  required: true, type: 'password' as const, helperText: 'Leave blank to keep unchanged' },
        { key: 'role',     label: 'Role',      required: true, type: 'select' as const, defaultValue: 'VIEWER',
          options: ROLES.map((r) => ({ value: r, label: r })) },
      ]}
      onCreate={(d) => create.mutateAsync({ username: d.username, fullName: d.fullName, email: d.email, password: d.password, role: d.role })}
      onUpdate={(id, d) => update.mutateAsync({ id, d: { fullName: d.fullName, email: d.email, role: d.role } })}
      onDeactivate={(id) => deact.mutateAsync(id)}
      getInitialValues={(r) => ({ username: r.username, fullName: r.fullName, email: r.email, password: '', role: r.role })}
    />
  );
}

// ── Blood Groups ──────────────────────────────────────────────────────────────
function BloodGroupsTab() {
  const qc = useQueryClient();
  const [search, setSearch] = useState('');
  const { data, isLoading } = useQuery({
    queryKey: ['admin', 'blood-groups', search],
    queryFn: () => bloodGroupsCrud.list({ search, limit: 50 }),
  });
  const rows: BloodGroupOption[] = (data?.data ?? []) as BloodGroupOption[];

  const create = useMutation({ mutationFn: (d: Record<string, unknown>) => bloodGroupsCrud.create(d), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'blood-groups'] }) });
  const update = useMutation({ mutationFn: ({ id, d }: { id: string; d: Record<string, unknown> }) => bloodGroupsCrud.update(id, d), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'blood-groups'] }) });
  const deact  = useMutation({ mutationFn: (id: string) => bloodGroupsCrud.deactivate(id), onSuccess: () => qc.invalidateQueries({ queryKey: ['admin', 'blood-groups'] }) });

  return (
    <MasterCrudTable<BloodGroupOption>
      title="Blood Groups" idKey="bloodGroupId" loading={isLoading} rows={rows} onSearch={setSearch}
      columns={[
        { header: 'Code',  render: (r) => r.code, width: 80 },
        { header: 'Label', render: (r) => r.label },
        { header: 'Order', render: (r) => r.sortOrder, width: 60 },
      ]}
      fields={[
        { key: 'code',      label: 'Blood Group Code (e.g. A+)',      required: true },
        { key: 'label',     label: 'Display Label (e.g. A Positive)', required: true },
        { key: 'sortOrder', label: 'Sort Order', type: 'text' },
      ]}
      onCreate={(d) => create.mutateAsync({ code: d.code, label: d.label, sortOrder: Number(d.sortOrder) || 0 })}
      onUpdate={(id, d) => update.mutateAsync({ id, d: { code: d.code, label: d.label, sortOrder: Number(d.sortOrder) || 0 } })}
      onDeactivate={(id) => deact.mutateAsync(id)}
      getInitialValues={(r) => ({ code: r.code, label: r.label, sortOrder: String(r.sortOrder) })}
    />
  );
}

// ── Pre-Op Checklist Template ──────────────────────────────────────────────────

interface ItemRow { checklistItem: string }

interface TemplateFormState {
  procedureId: string;
  isActive: boolean;
  items: ItemRow[];
}

const EMPTY_TEMPLATE: TemplateFormState = {
  procedureId: '',
  isActive: true,
  items: [{ checklistItem: '' }],
};

function PreOpChecklistTab() {
  const qc = useQueryClient();
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editing, setEditing]       = useState<PreOpChecklistTemplate | null>(null);
  const [form, setForm]             = useState<TemplateFormState>(EMPTY_TEMPLATE);
  const [saving, setSaving]         = useState(false);
  const [saveErr, setSaveErr]       = useState('');
  const [toggleErr, setToggleErr]   = useState('');

  // Fetch procedures (surgery_types)
  const { data: procData } = useQuery({
    queryKey: ['admin', 'procedures'],
    queryFn: () => proceduresCrud.list({ limit: 200 }),
  });
  const procedures: SurgeryType[] = (procData?.data ?? []) as SurgeryType[];

  // Fetch templates
  const { data: templates = [], isLoading } = useQuery<PreOpChecklistTemplate[]>({
    queryKey: ['admin', 'preop-templates'],
    queryFn: () => preopApi.listTemplates(),
  });

  function openCreate() {
    setEditing(null);
    setForm(EMPTY_TEMPLATE);
    setSaveErr('');
    setDialogOpen(true);
  }

  function openEdit(t: PreOpChecklistTemplate) {
    setEditing(t);
    setForm({
      procedureId: t.procedureId,
      isActive: t.isActive,
      items: t.items.length > 0
        ? t.items.map((i) => ({ checklistItem: i.checklistItem }))
        : [{ checklistItem: '' }],
    });
    setSaveErr('');
    setDialogOpen(true);
  }

  async function handleSave() {
    const validItems = form.items.filter((i) => i.checklistItem.trim());
    if (!form.procedureId) { setSaveErr('Please select a procedure.'); return; }
    if (validItems.length === 0) { setSaveErr('Add at least one checklist item.'); return; }
    setSaving(true); setSaveErr('');
    try {
      if (editing) {
        await preopApi.updateTemplate(editing.templateId, {
          procedureId: form.procedureId,
          isActive: form.isActive,
          items: validItems,
        });
      } else {
        await preopApi.createTemplate({
          procedureId: form.procedureId,
          isActive: form.isActive,
          items: validItems,
        });
      }
      qc.invalidateQueries({ queryKey: ['admin', 'preop-templates'] });
      setDialogOpen(false);
    } catch (e: unknown) {
      setSaveErr(getErrorMessage(e));
    } finally {
      setSaving(false);
    }
  }

  async function handleToggleActive(t: PreOpChecklistTemplate) {
    try {
      if (t.isActive) {
        await preopApi.deactivateTemplate(t.templateId);
      } else {
        await preopApi.activateTemplate(t.templateId);
      }
      qc.invalidateQueries({ queryKey: ['admin', 'preop-templates'] });
    } catch (e: unknown) {
      setToggleErr(getErrorMessage(e));
    }
  }

  // ── item helpers
  function setItem(idx: number, val: string) {
    setForm((f) => {
      const items = [...f.items];
      items[idx] = { checklistItem: val };
      return { ...f, items };
    });
  }
  function addItem() {
    setForm((f) => ({ ...f, items: [...f.items, { checklistItem: '' }] }));
  }
  function removeItem(idx: number) {
    setForm((f) => ({ ...f, items: f.items.filter((_, i) => i !== idx) }));
  }

  if (isLoading) return <Box sx={{ p: 3 }}><CircularProgress size={24} /></Box>;

  return (
    <Box>
      <Stack direction="row" justifyContent="space-between" alignItems="center" mb={2}>
        <Typography variant="h6" fontWeight={600}>Pre-Op Checklist Templates</Typography>
        <Button variant="contained" startIcon={<Add />} onClick={openCreate}>
          Add Template
        </Button>
      </Stack>

      {toggleErr && (
        <Alert severity="error" sx={{ mb: 1 }} onClose={() => setToggleErr('')}>{toggleErr}</Alert>
      )}
      {templates.length === 0 ? (
        <Alert severity="info">No templates yet. Click "Add Template" to create one.</Alert>
      ) : (
        <TableContainer component={Paper} variant="outlined">
          <Table size="small">
            <TableHead>
              <TableRow sx={{ bgcolor: 'action.hover' }}>
                <TableCell sx={{ fontWeight: 700 }}>Procedure</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Status</TableCell>
                <TableCell sx={{ fontWeight: 700 }}>Checklist Items</TableCell>
                <TableCell sx={{ fontWeight: 700, width: 140 }}>Actions</TableCell>
              </TableRow>
            </TableHead>
            <TableBody>
              {templates.map((t) => (
                <TableRow key={t.templateId} hover>
                  <TableCell>
                    <Typography fontWeight={600} fontSize={13}>{t.procedureName}</Typography>
                    <Typography fontSize={11} color="text.secondary">{t.procedureCode}</Typography>
                  </TableCell>
                  <TableCell>
                    <Chip
                      label={t.isActive ? 'Active' : 'Inactive'}
                      color={t.isActive ? 'success' : 'default'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell>
                    {t.items.length === 0 ? (
                      <Typography fontSize={12} color="text.secondary">No items</Typography>
                    ) : (
                      <Stack spacing={0.3}>
                        {t.items.map((item, idx) => (
                          <Typography key={item.itemId} fontSize={12}>
                            {idx + 1}. {item.checklistItem}
                          </Typography>
                        ))}
                      </Stack>
                    )}
                  </TableCell>
                  <TableCell>
                    <Stack direction="row" spacing={0.5}>
                      <IconButton size="small" title="Edit" onClick={() => openEdit(t)}>
                        <Edit fontSize="small" />
                      </IconButton>
                      <IconButton
                        size="small"
                        title={t.isActive ? 'Deactivate' : 'Activate'}
                        color={t.isActive ? 'error' : 'success'}
                        onClick={() => handleToggleActive(t)}
                      >
                        {t.isActive ? <Cancel fontSize="small" /> : <CheckCircle fontSize="small" />}
                      </IconButton>
                    </Stack>
                  </TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </TableContainer>
      )}

      {/* Create / Edit Dialog */}
      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editing ? 'Edit Template' : 'New Pre-Op Checklist Template'}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {saveErr && <Alert severity="error">{saveErr}</Alert>}

          {!editing && (
            <Alert severity="info" sx={{ py: 0.5 }}>
              One active template per procedure only. To modify an existing template, use the Edit (✏️) button on the list.
            </Alert>
          )}

          {/* Procedure dropdown */}
          <FormControl fullWidth required size="small">
            <InputLabel>Procedure</InputLabel>
            <Select
              label="Procedure"
              value={form.procedureId}
              onChange={(e) => setForm((f) => ({ ...f, procedureId: e.target.value }))}
            >
              {procedures.filter((p) => p.isActive).map((p) => (
                <MenuItem key={p.surgeryTypeId} value={p.surgeryTypeId}>
                  {p.name} ({p.code})
                </MenuItem>
              ))}
            </Select>
          </FormControl>

          {/* Status */}
          <FormControlLabel
            control={
              <Switch
                checked={form.isActive}
                onChange={(e) => setForm((f) => ({ ...f, isActive: e.target.checked }))}
              />
            }
            label={form.isActive ? 'Active' : 'Inactive'}
          />

          {/* Checklist Items */}
          <Box>
            <Stack direction="row" justifyContent="space-between" alignItems="center" mb={1}>
              <Typography fontWeight={600} fontSize={13}>Checklist Items</Typography>
              <Button size="small" startIcon={<Add />} onClick={addItem}>Add Item</Button>
            </Stack>
            <Stack spacing={1}>
              {form.items.map((item, idx) => (
                <Stack key={idx} direction="row" spacing={1} alignItems="center">
                  <Typography fontSize={12} color="text.secondary" minWidth={24}>{idx + 1}.</Typography>
                  <TextField
                    size="small"
                    fullWidth
                    placeholder={`Checklist item ${idx + 1}`}
                    value={item.checklistItem}
                    onChange={(e) => setItem(idx, e.target.value)}
                  />
                  <IconButton
                    size="small"
                    color="error"
                    onClick={() => removeItem(idx)}
                    disabled={form.items.length === 1}
                  >
                    <Delete fontSize="small" />
                  </IconButton>
                </Stack>
              ))}
            </Stack>
          </Box>
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save Template'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}

// ── Main Page ─────────────────────────────────────────────────────────────────
const TABS = [
  { label: 'Department',            icon: <LocalHospital fontSize="small" />,   component: <DepartmentsTab /> },
  { label: 'OT Room',               icon: <MeetingRoom fontSize="small" />,     component: <OtRoomsTab /> },
  { label: 'Procedure',             icon: <MedicalServices fontSize="small" />, component: <ProceduresTab /> },
  { label: 'Pre-Op Checklist',      icon: <Checklist fontSize="small" />,       component: <PreOpChecklistTab /> },
  { label: 'Staff',                 icon: <BadgeOutlined fontSize="small" />,   component: <StaffTab /> },
  { label: 'App Users',             icon: <PeopleAlt fontSize="small" />,       component: <AppUsersTab /> },
  { label: 'Blood Groups',          icon: <Bloodtype fontSize="small" />,       component: <BloodGroupsTab /> },
];

export function AdminConfigPage() {
  const [tab, setTab] = useState(0);

  return (
    <Box>
      <PageHeader
        title="Master Configuration"
        subtitle="Manage reference data: departments, OT rooms, procedures, staff, and system users"
      />
      <Alert severity="info" sx={{ mb: 2 }}>
        Changes here affect dropdowns throughout the system. Use Activate/Deactivate to control visibility.
        Inactive records remain visible in existing surgery entries but are hidden from new entry dropdowns.
      </Alert>
      <Box sx={{ borderBottom: 1, borderColor: 'divider', mb: 3 }}>
        <Tabs value={tab} onChange={(_, v) => setTab(v)} variant="scrollable" scrollButtons="auto">
          {TABS.map((t, i) => (
            <Tab key={i} label={t.label} icon={t.icon} iconPosition="start" sx={{ minHeight: 48, fontSize: 13 }} />
          ))}
        </Tabs>
      </Box>
      {TABS[tab].component}
    </Box>
  );
}
