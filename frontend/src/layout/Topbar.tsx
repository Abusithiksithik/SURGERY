import { useState } from 'react';
import {
  AppBar,
  Toolbar,
  IconButton,
  Typography,
  Box,
  Badge,
  Menu,
  MenuItem,
  Avatar,
  Tooltip,
  Divider,
  ListItemIcon,
} from '@mui/material';
import {
  Menu as MenuIcon,
  DarkMode,
  LightMode,
  NotificationsOutlined,
  Logout,
  Lock,
} from '@mui/icons-material';
import { useNavigate, useLocation } from 'react-router-dom';
import { useQuery } from '@tanstack/react-query';
import { useThemeMode } from '@/theme/ThemeModeContext';
import { useAuth } from '@/auth/AuthContext';
import { navItems } from './navConfig';
import { listAlerts } from '@/api/alerts.api';

export function Topbar({ onMenuClick }: { onMenuClick: () => void }) {
  const { mode, toggleMode } = useThemeMode();
  const { user, logout } = useAuth();
  const navigate = useNavigate();
  const location = useLocation();
  const [anchorEl, setAnchorEl] = useState<HTMLElement | null>(null);

  const currentPage = navItems.find((item) => item.path === location.pathname);

  const { data: unacknowledged } = useQuery({
    queryKey: ['alerts', 'unacknowledged-count'],
    queryFn: () => listAlerts({ isAcknowledged: false, severity: 'RED', limit: 1 }),
    refetchInterval: 60000,
  });

  return (
    <AppBar position="sticky" elevation={0} sx={{ borderBottom: 1, borderColor: 'divider' }}>
      <Toolbar sx={{ gap: 1 }}>
        <IconButton edge="start" onClick={onMenuClick} sx={{ display: { md: 'none' } }}>
          <MenuIcon />
        </IconButton>

        <Typography variant="subtitle1" fontWeight={700} sx={{ flexGrow: 1 }}>
          {currentPage?.label || 'Surgery Cost Intelligence'}
        </Typography>

        <Tooltip title="Alert Center">
          <IconButton onClick={() => navigate('/alerts')}>
            <Badge badgeContent={unacknowledged?.meta.totalCount || 0} color="error" max={99}>
              <NotificationsOutlined />
            </Badge>
          </IconButton>
        </Tooltip>

        <Tooltip title={mode === 'dark' ? 'Switch to light mode' : 'Switch to dark mode'}>
          <IconButton onClick={toggleMode}>{mode === 'dark' ? <LightMode /> : <DarkMode />}</IconButton>
        </Tooltip>

        <Tooltip title="Account">
          <IconButton onClick={(e) => setAnchorEl(e.currentTarget)} sx={{ ml: 0.5 }}>
            <Avatar sx={{ width: 32, height: 32, fontSize: 14, bgcolor: 'primary.main' }}>
              {user?.fullName?.charAt(0) || '?'}
            </Avatar>
          </IconButton>
        </Tooltip>
        <Menu anchorEl={anchorEl} open={!!anchorEl} onClose={() => setAnchorEl(null)}>
          <Box sx={{ px: 2, py: 1 }}>
            <Typography variant="body2" fontWeight={600}>
              {user?.fullName}
            </Typography>
            <Typography variant="caption" color="text.secondary">
              {user?.email}
            </Typography>
          </Box>
          <Divider />
          <MenuItem onClick={() => setAnchorEl(null)}>
            <ListItemIcon>
              <Lock fontSize="small" />
            </ListItemIcon>
            Change password
          </MenuItem>
          <MenuItem onClick={logout}>
            <ListItemIcon>
              <Logout fontSize="small" />
            </ListItemIcon>
            Sign out
          </MenuItem>
        </Menu>
      </Toolbar>
    </AppBar>
  );
}
