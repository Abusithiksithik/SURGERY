import { Box, Card, Stack, Typography, useTheme } from '@mui/material';
import { ArrowUpward, ArrowDownward } from '@mui/icons-material';
import type { ReactNode } from 'react';
import { typography } from '@/theme/tokens';

interface KpiCardProps {
  label: string;
  value: string;
  icon?: ReactNode;
  trend?: { direction: 'UP' | 'DOWN' | 'FLAT'; label: string; positiveIsGood?: boolean };
  accentColor?: string;
}

export function KpiCard({ label, value, icon, trend, accentColor }: KpiCardProps) {
  const theme = useTheme();
  const accent = accentColor || theme.palette.primary.main;

  let trendColor = theme.palette.text.secondary;
  if (trend && trend.direction !== 'FLAT') {
    const isPositive = trend.direction === 'UP';
    const isGood = trend.positiveIsGood !== false ? isPositive : !isPositive;
    trendColor = isGood ? theme.palette.success.main : theme.palette.error.main;
  }

  return (
    <Card sx={{ p: 2.5, height: '100%', position: 'relative', overflow: 'hidden' }}>
      <Box sx={{ position: 'absolute', top: 0, left: 0, width: 4, height: '100%', bgcolor: accent }} />
      <Stack spacing={1} sx={{ pl: 0.5 }}>
        <Stack direction="row" alignItems="center" justifyContent="space-between">
          <Typography variant="body2" color="text.secondary" fontWeight={600}>
            {label}
          </Typography>
          {icon && (
            <Box sx={{ color: accent, display: 'flex', opacity: 0.85 }}>{icon}</Box>
          )}
        </Stack>
        <Typography
          variant="h4"
          fontFamily={typography.mono}
          fontWeight={700}
          sx={{ fontVariantNumeric: 'tabular-nums' }}
        >
          {value}
        </Typography>
        {trend && (
          <Stack direction="row" spacing={0.5} alignItems="center">
            {trend.direction === 'UP' && <ArrowUpward sx={{ fontSize: 15, color: trendColor }} />}
            {trend.direction === 'DOWN' && <ArrowDownward sx={{ fontSize: 15, color: trendColor }} />}
            <Typography variant="caption" sx={{ color: trendColor, fontWeight: 600 }}>
              {trend.label}
            </Typography>
          </Stack>
        )}
      </Stack>
    </Card>
  );
}
