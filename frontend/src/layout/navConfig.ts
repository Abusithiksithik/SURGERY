import type { UserRole } from '@/api/types';
import type { ComponentType } from 'react';
import DashboardOutlined from '@mui/icons-material/DashboardOutlined';
import TravelExploreOutlined from '@mui/icons-material/TravelExploreOutlined';
import InsightsOutlined from '@mui/icons-material/InsightsOutlined';
import NotificationsActiveOutlined from '@mui/icons-material/NotificationsActiveOutlined';
import SummarizeOutlined from '@mui/icons-material/SummarizeOutlined';
import SettingsOutlined from '@mui/icons-material/SettingsOutlined';
import PersonAddOutlined from '@mui/icons-material/PersonAddOutlined';
import AssignmentOutlined from '@mui/icons-material/AssignmentOutlined';
import CalendarMonthOutlined from '@mui/icons-material/CalendarMonthOutlined';
import AssignmentTurnedInOutlined from '@mui/icons-material/AssignmentTurnedInOutlined';

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<{ fontSize?: 'small' | 'medium' | 'large' }>;
  roles?: UserRole[];
  dividerBefore?: boolean;
}

export const navItems: NavItem[] = [
  // ── Module 2 ──────────────────────────────────────────────────────
  { label: 'Patient Entry',  path: '/patients',   icon: PersonAddOutlined,      dividerBefore: false },
  { label: 'Surgery Entry',  path: '/surgeries',  icon: AssignmentOutlined,     dividerBefore: false },
  { label: 'OT Scheduling',  path: '/scheduling', icon: CalendarMonthOutlined,  dividerBefore: false },
  // Pre-Op Checklist is integrated inside OT Scheduling — no separate nav entry needed

  // ── Existing modules ──────────────────────────────────────────────
  { label: 'Dashboard',                path: '/',                icon: DashboardOutlined,           dividerBefore: true },
  { label: 'Similar Surgery Explorer', path: '/explorer',        icon: TravelExploreOutlined },
  { label: 'Benchmarks',               path: '/benchmarks',      icon: InsightsOutlined },
  { label: 'Alert Center',             path: '/alerts',           icon: NotificationsActiveOutlined },
  {
    label: 'Reports',
    path: '/reports',
    icon: SummarizeOutlined,
    roles: ['ADMIN', 'FINANCE', 'MANAGEMENT'],
  },

  // ── Master Config LAST ─────────────────────────────────────────────
  {
    label: 'Master Config',
    path: '/admin/config',
    icon: SettingsOutlined,
    roles: ['ADMIN'],
    dividerBefore: true,
  },
];
