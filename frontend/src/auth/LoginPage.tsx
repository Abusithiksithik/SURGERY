import { useRef, useState, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import {
  Box,
  Paper,
  TextField,
  Button,
  Typography,
  Alert,
  Stack,
  InputAdornment,
  IconButton,
} from '@mui/material';
import { LocalHospital, Visibility, VisibilityOff } from '@mui/icons-material';
import { useAuth } from './AuthContext';
import { getErrorMessage } from '@/api/client';
import { palette, typography } from '@/theme/tokens';

export function LoginPage() {
  const { login } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const usernameRef = useRef<HTMLInputElement>(null);
  const passwordRef = useRef<HTMLInputElement>(null);
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);

  const from = (location.state as { from?: Location })?.from?.pathname || '/';

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setError(null);
    setSubmitting(true);
    try {
      const username = usernameRef.current?.value ?? '';
      const password = passwordRef.current?.value ?? '';
      await login(username.trim(), password);
      navigate(from, { replace: true });
    } catch (err) {
      setError(getErrorMessage(err));
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <Box
      sx={{
        minHeight: '100vh',
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        background: `linear-gradient(160deg, ${palette.slate800} 0%, ${palette.slate700} 55%, ${palette.teal600} 130%)`,
        p: 2,
      }}
    >
      <Paper elevation={0} sx={{ width: 420, maxWidth: '100%', p: 5, borderRadius: 3 }}>
        <Stack spacing={0.5} sx={{ mb: 4, alignItems: 'center' }}>
          <Box
            sx={{
              width: 52,
              height: 52,
              borderRadius: 2,
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center',
              bgcolor: palette.teal100,
              color: palette.teal600,
              mb: 1,
            }}
          >
            <LocalHospital fontSize="large" />
          </Box>
          <Typography variant="h5" fontFamily={typography.display} fontWeight={700}>
            Surgery Cost Intelligence
          </Typography>
          <Typography variant="body2" color="text.secondary" textAlign="center">
            Sign in to access budgets, recommendations, and dashboards
          </Typography>
        </Stack>

        {error && (
          <Alert severity="error" sx={{ mb: 3 }}>
            {error}
          </Alert>
        )}

        {/* autoComplete="off" on form suppresses the browser saved-login dropdown */}
        <form onSubmit={handleSubmit} autoComplete="off">
          <Stack spacing={2.5}>
            <TextField
              label="Username"
              name="username"
              inputRef={usernameRef}
              autoComplete="off"
              autoFocus
              fullWidth
              required
            />
            <TextField
              label="Password"
              name="password"
              type={showPassword ? 'text' : 'password'}
              inputRef={passwordRef}
              autoComplete="new-password"
              fullWidth
              required
              InputProps={{
                endAdornment: (
                  <InputAdornment position="end">
                    <IconButton
                      onClick={() => setShowPassword((v) => !v)}
                      edge="end"
                      size="small"
                      tabIndex={-1}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                    >
                      {showPassword ? <VisibilityOff fontSize="small" /> : <Visibility fontSize="small" />}
                    </IconButton>
                  </InputAdornment>
                ),
              }}
            />
            <Button type="submit" variant="contained" size="large" disabled={submitting} sx={{ py: 1.2 }}>
              {submitting ? 'Signing in…' : 'Sign in'}
            </Button>
          </Stack>
        </form>
      </Paper>
    </Box>
  );
}
