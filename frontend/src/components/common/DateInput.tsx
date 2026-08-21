/**
 * DateInput — calendar date picker with:
 * • Native browser date picker (calendar popup on click / icon click).
 * • Strict 4-digit year enforcement (1900–2099).
 * • Small, clearly visible white calendar icon button.
 * • Values stored / exposed as YYYY-MM-DD strings.
 * • Styled as MUI TextField so it fits all existing call-sites.
 */
import { useCallback, useRef } from 'react';
import TextField from '@mui/material/TextField';
import InputAdornment from '@mui/material/InputAdornment';
import IconButton from '@mui/material/IconButton';
import CalendarMonthIcon from '@mui/icons-material/CalendarMonth';
import type { TextFieldProps } from '@mui/material/TextField';

const MIN_DATE = '1900-01-01';
const MAX_DATE = '2099-12-31';

type OwnProps = {
  /** ISO date string YYYY-MM-DD (or empty string / undefined) */
  value: string | undefined | null;
  /** Called with YYYY-MM-DD when a complete, valid date is entered;
   *  called with '' when the field is cleared. */
  onChange: (isoValue: string) => void;
  label?: string;
  disabled?: boolean;
  required?: boolean;
  size?: TextFieldProps['size'];
  fullWidth?: boolean;
  sx?: TextFieldProps['sx'];
};

export function DateInput({
  value,
  onChange,
  label,
  disabled,
  required,
  size,
  fullWidth,
  sx,
}: OwnProps) {
  const inputRef = useRef<HTMLInputElement>(null);
  const safeValue = value || '';

  // Validate: year must be 4 digits and within 1900–2099
  const isError = (() => {
    if (!safeValue) return false;
    const m = safeValue.match(/^(\d{4})-(\d{2})-(\d{2})$/);
    if (!m) return true;
    const year = parseInt(m[1], 10);
    return year < 1900 || year > 2099;
  })();

  const handleChange = useCallback(
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const raw = e.target.value; // '' or 'YYYY-MM-DD'
      if (!raw) { onChange(''); return; }
      const m = raw.match(/^(\d{4})-(\d{2})-(\d{2})$/);
      if (!m) { onChange(''); return; }
      const year = parseInt(m[1], 10);
      if (year < 1900 || year > 2099) { onChange(''); return; }
      onChange(raw);
    },
    [onChange],
  );

  function openPicker() {
    if (disabled) return;
    // showPicker() is the modern API; fall back to focus+click for older browsers
    try {
      (inputRef.current as HTMLInputElement & { showPicker?: () => void })?.showPicker?.();
    } catch {
      inputRef.current?.click();
    }
  }

  return (
    <TextField
      label={label}
      type="date"
      value={safeValue}
      onChange={handleChange}
      inputRef={inputRef}
      inputProps={{ min: MIN_DATE, max: MAX_DATE }}
      InputLabelProps={{ shrink: true }}
      InputProps={{
        endAdornment: (
          <InputAdornment position="end">
            <IconButton
              size="small"
              onClick={openPicker}
              disabled={disabled}
              tabIndex={-1}
              sx={{
                color: 'white',
                bgcolor: 'primary.main',
                borderRadius: '4px',
                width: 26,
                height: 26,
                '&:hover': { bgcolor: 'primary.dark' },
                '&.Mui-disabled': { bgcolor: 'action.disabledBackground', color: 'action.disabled' },
              }}
            >
              <CalendarMonthIcon sx={{ fontSize: 15 }} />
            </IconButton>
          </InputAdornment>
        ),
        // Hide the native browser calendar icon so we only show our custom one
        sx: {
          '& input::-webkit-calendar-picker-indicator': {
            display: 'none',
          },
          '& input[type="date"]::-webkit-inner-spin-button': {
            display: 'none',
          },
        },
      }}
      disabled={disabled}
      required={required}
      size={size}
      fullWidth={fullWidth}
      sx={sx}
      error={isError}
      helperText={isError ? 'Year must be between 1900 and 2099' : undefined}
    />
  );
}
