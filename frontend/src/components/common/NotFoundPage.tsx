import { Box, Typography, Button } from '@mui/material';
import { useNavigate } from 'react-router-dom';

export function NotFoundPage() {
  const navigate = useNavigate();
  return (
    <Box sx={{ textAlign: 'center', py: 10 }}>
      <Typography variant="h2" fontWeight={800} color="text.disabled">
        404
      </Typography>
      <Typography variant="h6" sx={{ mb: 2 }}>
        This page doesn't exist.
      </Typography>
      <Button variant="contained" onClick={() => navigate('/')}>
        Back to Dashboard
      </Button>
    </Box>
  );
}
