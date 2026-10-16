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
import FactCheckOutlined from '@mui/icons-material/FactCheckOutlined';
import MonitorHeartOutlined from '@mui/icons-material/MonitorHeartOutlined';
import SecurityOutlined from '@mui/icons-material/SecurityOutlined';
import ManageAccountsOutlined from '@mui/icons-material/ManageAccountsOutlined';

export interface NavItem {
  label: string;
  path: string;
  icon: ComponentType<{ fontSize?: 'small' | 'medium' | 'large' }>;
  roles?: UserRole[];
  permission?: string;
  dividerBefore?: boolean;
}

export const navItems: NavItem[] = [
  // ── Module 2 ──────────────────────────────────────────────────────
  { label: 'Patient Entry',  path: '/patients',   icon: PersonAddOutlined,      dividerBefore: false },
  { label: 'Surgery Entry',  path: '/surgeries',  icon: AssignmentOutlined,     dividerBefore: false },
  { label: 'OT Scheduling',  path: '/scheduling', icon: CalendarMonthOutlined,  dividerBefore: false },
  { label: 'Pre-Op Checklist', path: '/preop-checklist', icon: FactCheckOutlined, dividerBefore: false },
  { label: 'Surgery-Day Actuals', path: '/surgery-day-actuals', icon: MonitorHeartOutlined, permission: 'VIEW_SURGERY_ACTUALS', dividerBefore: false },

  // ── Existing modules ──────────────────────────────────────────────
  { label: 'Dashboard',                path: '/',                icon: DashboardOutlined,           dividerBefore: true },
  { label: 'Cost Intelligence', path: '/cost-intelligence', icon: InsightsOutlined, permission: 'VIEW_FINANCIALS' },
  { label: 'Similar Surgery Explorer', path: '/explorer',        icon: TravelExploreOutlined },
  { label: 'Benchmarks',               path: '/benchmarks',      icon: InsightsOutlined },
  { label: 'Alert Center',             path: '/alerts',           icon: NotificationsActiveOutlined },
  {
    label: 'Reports',
    path: '/reports',
    icon: SummarizeOutlined,
    permission: 'VIEW_FINANCIALS',
  },

  // ── Master Config LAST ─────────────────────────────────────────────
  { label: 'Audit Trail', path: '/audit', icon: SecurityOutlined, permission: 'VIEW_AUDIT_TRAIL', dividerBefore: true },
  { label: 'Roles & Permissions', path: '/permissions', icon: ManageAccountsOutlined, permission: 'MANAGE_ROLE_PERMISSIONS' },
  {
    label: 'Master Config',
    path: '/admin/config',
    icon: SettingsOutlined,
    permission: 'EDIT_MASTERS',
    dividerBefore: true,
  },
];
