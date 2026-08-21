/**
 * MasterCrudTable — generic admin CRUD table.
 * Renders a searchable table with Add / Edit / Deactivate actions.
 * All data fetching and mutation is handled by the parent via props.
 */
import { useState } from 'react';
import {
  Box, Button, TextField, InputAdornment, Table, TableHead, TableBody,
  TableRow, TableCell, TableContainer, Paper, IconButton, Chip,
  Dialog, DialogTitle, DialogContent, DialogActions, Typography,
  CircularProgress, Stack,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import AddIcon from '@mui/icons-material/Add';
import EditIcon from '@mui/icons-material/Edit';
import BlockIcon from '@mui/icons-material/Block';
import CheckCircleOutlineIcon from '@mui/icons-material/CheckCircleOutline';

export interface ColumnDef<T> {
  header: string;
  render: (row: T) => React.ReactNode;
  width?: number | string;
}

export interface FieldDef {
  key: string;
  label: string;
  required?: boolean;
  type?: 'text' | 'select' | 'email' | 'password';
  options?: { value: string; label: string }[];
  defaultValue?: string;
  helperText?: string;
}

interface Props<T extends { isActive?: unknown }> {
  title: string;
  columns: ColumnDef<T>[];
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  rows: any[];
  loading?: boolean;
  fields: FieldDef[];
  idKey: keyof T;
  onSearch: (q: string) => void;
  onCreate: (data: Record<string, string>) => Promise<unknown>;
  onUpdate: (id: string, data: Record<string, string>) => Promise<unknown>;
  onDeactivate: (id: string) => Promise<unknown>;
  onActivate?: (id: string) => Promise<unknown>;
  getInitialValues?: (row: T) => Record<string, string>;
}

// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function MasterCrudTable<T extends { isActive?: unknown } = any>({
  title, columns, rows, loading, fields, idKey,
  onSearch, onCreate, onUpdate, onDeactivate, onActivate, getInitialValues,
}: Props<T>) {
  const [search, setSearch] = useState('');
  const [dialogOpen, setDialogOpen] = useState(false);
  const [editRow, setEditRow] = useState<T | null>(null);
  const [form, setForm] = useState<Record<string, string>>({});
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  function openAdd() {
    const initial: Record<string, string> = {};
    fields.forEach((f) => { initial[f.key] = f.defaultValue ?? ''; });
    setForm(initial);
    setEditRow(null);
    setError('');
    setDialogOpen(true);
  }

  function openEdit(row: T) {
    const initial = getInitialValues ? getInitialValues(row) : {};
    fields.forEach((f) => {
      if (initial[f.key] === undefined) initial[f.key] = String((row as Record<string, unknown>)[f.key] ?? '');
    });
    setForm(initial);
    setEditRow(row);
    setError('');
    setDialogOpen(true);
  }

  async function handleSave() {
    setSaving(true);
    setError('');
    try {
      if (editRow) {
        await onUpdate(String(editRow[idKey]), form);
      } else {
        await onCreate(form);
      }
      setDialogOpen(false);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  async function handleDeactivate(row: T) {
    if (!window.confirm(`Deactivate this ${title.replace(/s$/, '')}?`)) return;
    try { await onDeactivate(String(row[idKey])); } catch { /* ignore */ }
  }

  async function handleActivate(row: T) {
    if (!window.confirm(`Activate this ${title.replace(/s$/, '')}?`)) return;
    try { if (onActivate) await onActivate(String(row[idKey])); } catch { /* ignore */ }
  }

  return (
    <Box>
      <Box sx={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', mb: 2 }}>
        <TextField
          size="small" placeholder={`Search ${title}…`}
          value={search}
          onChange={(e) => { setSearch(e.target.value); onSearch(e.target.value); }}
          InputProps={{ startAdornment: <InputAdornment position="start"><SearchIcon fontSize="small" /></InputAdornment> }}
          sx={{ width: 280 }}
        />
        <Button variant="contained" startIcon={<AddIcon />} onClick={openAdd}>
          Add {title.replace(/s$/, '')}
        </Button>
      </Box>

      <TableContainer component={Paper} variant="outlined">
        <Table size="small">
          <TableHead>
            <TableRow>
              {columns.map((c) => <TableCell key={c.header} sx={{ fontWeight: 700, width: c.width }}>{c.header}</TableCell>)}
              <TableCell sx={{ fontWeight: 700, width: 100 }}>Status</TableCell>
              <TableCell sx={{ fontWeight: 700, width: 90 }}>Actions</TableCell>
            </TableRow>
          </TableHead>
          <TableBody>
            {loading
              ? <TableRow><TableCell colSpan={columns.length + 2} align="center"><CircularProgress size={22} sx={{ my: 2 }} /></TableCell></TableRow>
              : rows.length === 0
              ? <TableRow><TableCell colSpan={columns.length + 2} align="center" sx={{ py: 3, color: 'text.secondary' }}>No records found</TableCell></TableRow>
              : rows.map((row, i) => (
                <TableRow key={i} hover>
                  {columns.map((c) => <TableCell key={c.header}>{c.render(row)}</TableCell>)}
                  <TableCell>
                    <Chip
                      label={row.isActive === false ? 'Inactive' : 'Active'}
                      color={row.isActive === false ? 'default' : 'success'}
                      size="small"
                    />
                  </TableCell>
                  <TableCell sx={{ whiteSpace: 'nowrap', width: 90 }}>
                    <Stack direction="row" spacing={0}>
                      <IconButton size="small" onClick={() => openEdit(row)} title="Edit"><EditIcon fontSize="small" /></IconButton>
                      {row.isActive !== false
                        ? (
                          <IconButton size="small" onClick={() => handleDeactivate(row)} title="Deactivate" color="warning"><BlockIcon fontSize="small" /></IconButton>
                        ) : (
                          onActivate && (
                            <IconButton size="small" onClick={() => handleActivate(row)} title="Activate" color="success"><CheckCircleOutlineIcon fontSize="small" /></IconButton>
                          )
                        )
                      }
                    </Stack>
                  </TableCell>
                </TableRow>
              ))
            }
          </TableBody>
        </Table>
      </TableContainer>

      <Dialog open={dialogOpen} onClose={() => setDialogOpen(false)} maxWidth="sm" fullWidth>
        <DialogTitle>{editRow ? 'Edit' : 'Add'} {title.replace(/s$/, '')}</DialogTitle>
        <DialogContent sx={{ pt: '16px !important', display: 'flex', flexDirection: 'column', gap: 2 }}>
          {error && <Typography color="error" variant="body2">{error}</Typography>}
          {fields.map((f) => f.type === 'select' ? (
            <TextField
              key={f.key} select label={f.label} required={f.required}
              value={form[f.key] ?? ''} size="small" fullWidth
              onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              SelectProps={{ native: true }}
              helperText={f.helperText}
            >
              <option value=""></option>
              {f.options?.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
            </TextField>
          ) : (
            <TextField
              key={f.key} label={f.label} required={f.required}
              type={f.type === 'password' && editRow ? 'text' : (f.type ?? 'text')}
              placeholder={f.type === 'password' && editRow ? '(unchanged)' : undefined}
              value={form[f.key] ?? ''} size="small" fullWidth
              onChange={(e) => setForm((p) => ({ ...p, [f.key]: e.target.value }))}
              helperText={f.helperText}
            />
          ))}
        </DialogContent>
        <DialogActions sx={{ px: 3, pb: 2 }}>
          <Button onClick={() => setDialogOpen(false)}>Cancel</Button>
          <Button variant="contained" onClick={handleSave} disabled={saving}>
            {saving ? 'Saving…' : 'Save'}
          </Button>
        </DialogActions>
      </Dialog>
    </Box>
  );
}
