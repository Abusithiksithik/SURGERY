import { Box, Card, Stack, Typography } from '@mui/material';
import type { ReactNode } from 'react';

interface SectionCardProps {
  title: string;
  subtitle?: string;
  actions?: ReactNode;
  children: ReactNode;
  minHeight?: number;
  noPadding?: boolean;
}

export function SectionCard({ title, subtitle, actions, children, minHeight, noPadding }: SectionCardProps) {
  return (
    <Card sx={{ p: noPadding ? 0 : 2.5, height: '100%', display: 'flex', flexDirection: 'column' }}>
      <Stack
        direction="row"
        justifyContent="space-between"
        alignItems="flex-start"
        sx={{ px: noPadding ? 2.5 : 0, pt: noPadding ? 2.5 : 0, mb: 2 }}
      >
        <Box>
          <Typography variant="subtitle1" fontWeight={700}>
            {title}
          </Typography>
          {subtitle && (
            <Typography variant="caption" color="text.secondary">
              {subtitle}
            </Typography>
          )}
        </Box>
        {actions}
      </Stack>
      <Box sx={{ flex: 1, minHeight, px: noPadding ? 2.5 : 0, pb: noPadding ? 2.5 : 0 }}>{children}</Box>
    </Card>
  );
}
