import { useState } from 'react';
import { Dialog, DialogTitle, DialogContent, DialogContentText, DialogActions, Button, TextField, Stack, Chip } from '@mui/material';
import { formatCurrency } from '@/utils/format';

export interface OverridePrompt {
  field: string;
  fieldLabel: string;
  recommendedValue: number;
  newValue: number;
}

export function OverrideReasonDialog({
  prompt,
  onSubmit,
  onCancel,
}: {
  prompt: OverridePrompt | null;
  onSubmit: (reason: string) => void;
  onCancel: () => void;
}) {
  const [reason, setReason] = useState('');

  if (!prompt) return null;

  return (
    <Dialog open={!!prompt} onClose={onCancel} maxWidth="xs" fullWidth>
      <DialogTitle>Explain this override</DialogTitle>
      <DialogContent>
        <DialogContentText sx={{ mb: 2 }}>
          You changed <strong>{prompt.fieldLabel}</strong> away from the system recommendation.
        </DialogContentText>
        <Stack direction="row" spacing={1} sx={{ mb: 2 }}>
          <Chip size="small" label={`Recommended: ${formatCurrency(prompt.recommendedValue)}`} />
          <Chip size="small" color="primary" label={`Your value: ${formatCurrency(prompt.newValue)}`} />
        </Stack>
        <TextField
          autoFocus
          multiline
          minRows={2}
          fullWidth
          label="Reason for override"
          placeholder="e.g. Complex case requiring additional surgeon time"
          value={reason}
          onChange={(e) => setReason(e.target.value)}
        />
      </DialogContent>
      <DialogActions sx={{ px: 3, pb: 2.5 }}>
        <Button onClick={onCancel} color="inherit">
          Cancel
        </Button>
        <Button onClick={() => onSubmit(reason)} variant="contained" disabled={!reason.trim()}>
          Save with reason
        </Button>
      </DialogActions>
    </Dialog>
  );
}
