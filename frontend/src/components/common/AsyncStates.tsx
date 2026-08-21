import { Box, CircularProgress, Typography, Button, Stack } from '@mui/material';
import { InboxOutlined, ErrorOutline, RefreshOutlined } from '@mui/icons-material';
import type { ReactNode } from 'react';

export function LoadingState({ label = 'Loading…', minHeight = 240 }: { label?: string; minHeight?: number }) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ minHeight, width: '100%' }}>
      <CircularProgress size={28} />
      <Typography variant="body2" color="text.secondary">
        {label}
      </Typography>
    </Stack>
  );
}

export function EmptyState({
  title = 'Nothing here yet',
  description,
  action,
}: {
  title?: string;
  description?: string;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1} sx={{ minHeight: 220, py: 4, textAlign: 'center' }}>
      <InboxOutlined sx={{ fontSize: 40, color: 'text.disabled' }} />
      <Typography variant="subtitle1" fontWeight={600}>
        {title}
      </Typography>
      {description && (
        <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 360 }}>
          {description}
        </Typography>
      )}
      {action && (
        <Button size="small" variant="outlined" onClick={action.onClick} sx={{ mt: 1 }}>
          {action.label}
        </Button>
      )}
    </Stack>
  );
}

export function ErrorState({
  message = 'Something went wrong while loading this data.',
  onRetry,
}: {
  message?: string;
  onRetry?: () => void;
}) {
  return (
    <Stack alignItems="center" justifyContent="center" spacing={1.5} sx={{ minHeight: 220, py: 4, textAlign: 'center' }}>
      <ErrorOutline sx={{ fontSize: 40, color: 'error.main' }} />
      <Typography variant="body2" color="text.secondary" sx={{ maxWidth: 380 }}>
        {message}
      </Typography>
      {onRetry && (
        <Button size="small" startIcon={<RefreshOutlined />} onClick={onRetry}>
          Try again
        </Button>
      )}
    </Stack>
  );
}

export function CenteredBox({ children }: { children: ReactNode }) {
  return (
    <Box sx={{ display: 'flex', alignItems: 'center', justifyContent: 'center', width: '100%' }}>
      {children}
    </Box>
  );
}
