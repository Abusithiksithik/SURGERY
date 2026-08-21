import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogActions, Button, Stack, TextField, MenuItem } from '@mui/material';
import * as mastersApi from '@/api/masters.api';
import type { Patient } from '@/api/types';
import { DateInput } from '@/components/common/DateInput';

export function NewPatientDialog({
  open,
  branchId,
  onClose,
  onCreated,
}: {
  open: boolean;
  branchId: string;
  onClose: () => void;
  onCreated: (patient: Patient) => void;
}) {
  const [mrNumber, setMrNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [dateOfBirth, setDateOfBirth] = useState('');
  const [gender, setGender] = useState('UNKNOWN');
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSubmit() {
    setSubmitting(true);
    setError(null);
    try {
      const patient = await mastersApi.createPatient({
        branchId,
        mrNumber,
        fullName,
        dateOfBirth: dateOfBirth || undefined,
        gender,
      });
      onCreated(patient);
      setMrNumber('');
      setFullName('');
      setDateOfBirth('');
      setGender('UNKNOWN');
    } catch (err: any) {
      setError(err?.response?.data?.message || 'Could not register patient');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Dialog open={open} onClose={onClose} maxWidth="xs" fullWidth>
      <DialogTitle>Register New Patient</DialogTitle>
      <DialogContent>
        <Stack spacing={2} sx={{ mt: 1 }}>
          {error && <Stack sx={{ color: 'error.main', fontSize: 13 }}>{error}</Stack>}
          <TextField label="MR Number" value={mrNumber} onChange={(e) => setMrNumber(e.target.value)} fullWidth required />
          <TextField label="Full Name" value={fullName} onChange={(e) => setFullName(e.target.value)} fullWidth required />
          <DateInput
            label="Date of Birth"
            value={dateOfBirth}
            onChange={(v) => setDateOfBirth(v)}
            fullWidth
          />
          <TextField select label="Gender" value={gender} onChange={(e) => setGender(e.target.value)} fullWidth>
            <MenuItem value="UNKNOWN">Unknown</MenuItem>
            <MenuItem value="MALE">Male</MenuItem>
            <MenuItem value="FEMALE">Female</MenuItem>
            <MenuItem value="OTHER">Other</MenuItem>
          </TextField>
        </Stack>
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onClose} color="inherit">
          Cancel
        </Button>
        <Button
          onClick={handleSubmit}
          variant="contained"
          disabled={submitting || !mrNumber || !fullName}
        >
          Register
        </Button>
      </DialogActions>
    </Dialog>
  );
}
