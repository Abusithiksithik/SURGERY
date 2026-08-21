import { List, ListItemButton, ListItemIcon, ListItemText, Box, Typography, Stack, Divider } from '@mui/material';
import { LocalHospital } from '@mui/icons-material';
import { useLocation, useNavigate } from 'react-router-dom';
import { navItems } from './navConfig';
import { useAuth } from '@/auth/AuthContext';
import { palette, typography } from '@/theme/tokens';

export function Sidebar({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();
  const navigate = useNavigate();
  const { user, hasRole } = useAuth();

  const visibleItems = navItems.filter((item) => !item.roles || hasRole(...item.roles));

  return (
    <Box sx={{ display: 'flex', flexDirection: 'column', height: '100%', bgcolor: palette.slate800 }}>
      <Stack direction="row" spacing={1.2} alignItems="center" sx={{ px: 2.5, py: 2.5 }}>
        <Box
          sx={{
            width: 34,
            height: 34,
            borderRadius: 1.5,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            bgcolor: palette.teal600,
            color: '#fff',
          }}
        >
          <LocalHospital fontSize="small" />
        </Box>
        <Box>
          <Typography sx={{ color: '#fff', fontFamily: typography.display, fontWeight: 700, fontSize: 15, lineHeight: 1.2 }}>
            Surgery Cost
          </Typography>
          <Typography sx={{ color: palette.slate500, fontSize: 11, fontWeight: 600, letterSpacing: 0.5 }}>
            INTELLIGENCE
          </Typography>
        </Box>
      </Stack>

      <List sx={{ flex: 1, px: 1.5, py: 1 }}>
        {visibleItems.map((item, idx) => {
          // Use exact match for items that are prefixes of other routes (e.g. /scheduling)
          // to prevent OT Scheduling from staying "active" when on /preop-checklist,
          // and to prevent Pre-Op Checklist from ever matching /scheduling/* sub-paths.
          const isExactMatch = item.path === '/scheduling' || item.path === '/preop-checklist';
          const active = isExactMatch
            ? location.pathname === item.path
            : location.pathname === item.path || location.pathname.startsWith(item.path + '/');
          const Icon = item.icon;
          // Insert a hairline separator between OT Scheduling and Pre-Op Checklist
          // so their touch areas are visually and physically separated.
          const prevItem = visibleItems[idx - 1];
          const needsMicroDivider =
            item.label === 'Pre-Op Checklist' && prevItem?.label === 'OT Scheduling';
          return (
            <span key={item.label}>
              {item.dividerBefore && (
                <Divider sx={{ my: 1, borderColor: 'rgba(255,255,255,0.1)' }} />
              )}
              {needsMicroDivider && (
                <Divider sx={{ my: 0.5, mx: 1, borderColor: 'rgba(255,255,255,0.07)' }} />
              )}
              <ListItemButton
                selected={active}
                onClick={() => {
                  navigate(item.path);
                  onNavigate?.();
                }}
                sx={{
                  borderRadius: 1.5,
                  mb: 0.25,
                  py: 0.6,           // tighter vertical padding (was MUI default ~8px, now ~4.8px)
                  minHeight: 36,     // explicit minimum so items never collapse or overlap
                  color: active ? '#fff' : palette.slate500,
                  '&.Mui-selected': {
                    bgcolor: 'rgba(15, 157, 140, 0.18)',
                    color: '#fff',
                    '&:hover': { bgcolor: 'rgba(15, 157, 140, 0.24)' },
                  },
                  '&:hover': { bgcolor: 'rgba(255,255,255,0.06)' },
                }}
              >
                <ListItemIcon sx={{ color: 'inherit', minWidth: 34 }}>
                  <Icon fontSize="small" />
                </ListItemIcon>
                <ListItemText
                  primary={item.label}
                  primaryTypographyProps={{ fontSize: 13, fontWeight: active ? 700 : 500, lineHeight: 1.3 }}
                />
              </ListItemButton>
            </span>
          );
        })}
      </List>

      <Box sx={{ px: 2.5, py: 2, borderTop: `1px solid ${palette.slate700}` }}>
        <Typography sx={{ color: '#fff', fontSize: 13, fontWeight: 600 }}>{user?.fullName}</Typography>
        <Typography sx={{ color: palette.slate500, fontSize: 11.5 }}>{user?.role}</Typography>
      </Box>
    </Box>
  );
}
