import { Paper, Stack, Button } from '@mui/material';
import { FilterAltOff } from '@mui/icons-material';
import type { ReactNode } from 'react';

interface FilterBarProps {
  children: ReactNode;
  onClear?: () => void;
  dense?: boolean;
}

/**
 * A consistent, responsive filter toolbar shell. Each screen supplies
 * its own filter controls (selects, date pickers, text fields) as
 * children — this component just handles the wrapping card, spacing,
 * wrap-on-mobile behaviour, and the optional "clear filters" action.
 */
export function FilterBar({ children, onClear, dense = false }: FilterBarProps) {
  return (
    <Paper variant="outlined" sx={{ p: dense ? 1.5 : 2, mb: 2.5 }}>
      <Stack direction="row" spacing={1.5} useFlexGap flexWrap="wrap" alignItems="center">
        {children}
        {onClear && (
          <Button
            size="small"
            color="inherit"
            startIcon={<FilterAltOff fontSize="small" />}
            onClick={onClear}
            sx={{ ml: 'auto' }}
          >
            Clear filters
          </Button>
        )}
      </Stack>
    </Paper>
  );
}
