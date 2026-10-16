import type { ReactNode } from 'react';
import { Navigate, useLocation } from 'react-router-dom';
import { Box, Typography, Button } from '@mui/material';
import { useAuth } from './AuthContext';
import type { UserRole } from '@/api/types';

export function ProtectedRoute({
  children,
  roles,
  permissions,
}: {
  children: ReactNode;
  roles?: UserRole[];
  permissions?: string[];
}) {
  const { isAuthenticated, hasRole, user, hasPermission } = useAuth();
  const location = useLocation();

  if (!isAuthenticated) {
    return <Navigate to="/login" state={{ from: location }} replace />;
  }

  if (roles && roles.length > 0 && !hasRole(...roles)) {
    return (
      <Box sx={{ p: 6, textAlign: 'center' }}>
        <Typography variant="h5" gutterBottom>
          Access restricted
        </Typography>
        <Typography color="text.secondary" sx={{ mb: 3 }}>
          Your role ({user?.role}) doesn't have permission to view this page.
        </Typography>
        <Button href="/" variant="contained">
          Back to Dashboard
        </Button>
      </Box>
    );
  }

  if (permissions?.length && !permissions.some(hasPermission)) {
    return <Box sx={{ p: 6, textAlign: 'center' }}><Typography variant="h5" gutterBottom>Access restricted</Typography><Typography color="text.secondary" sx={{ mb: 3 }}>Your account does not have the required permission.</Typography><Button href="/" variant="contained">Back to Dashboard</Button></Box>;
  }

  return <>{children}</>;
}
