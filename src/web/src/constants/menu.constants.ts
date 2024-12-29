// @mui/icons-material v5.0.0
import {
  Dashboard as DashboardIcon,
  Assignment as AssignmentIcon,
  Analytics as AnalyticsIcon,
  Settings as SettingsIcon,
  Add as AddIcon,
  List as ListIcon,
  Insights as InsightsIcon,
  Security as SecurityIcon,
} from '@mui/icons-material';
import { SvgIconProps } from '@mui/material';

/**
 * Enum defining all possible user roles in the system.
 * Used for role-based access control in menu visibility.
 */
export enum UserRole {
  HEALTHCARE_PROVIDER = 'HEALTHCARE_PROVIDER',
  INSURANCE_REVIEWER = 'INSURANCE_REVIEWER',
  ADMIN_STAFF = 'ADMIN_STAFF',
  PHARMACY_STAFF = 'PHARMACY_STAFF',
  SYSTEM_ADMIN = 'SYSTEM_ADMIN',
}

/**
 * Interface defining the structure of a menu item.
 * Ensures type safety for menu configuration.
 */
export interface MenuItemType {
  /** Unique identifier for the menu item */
  id: string;
  /** Display title of the menu item */
  title: string;
  /** Route path for navigation */
  path: string;
  /** Material UI icon component */
  icon: React.ComponentType<SvgIconProps>;
  /** Array of roles that can access this menu item */
  roles: UserRole[];
  /** Optional sub-menu items */
  children?: MenuItemType[];
  /** Flag to control menu item visibility */
  isVisible: boolean;
}

/**
 * Comprehensive menu structure with role-based access control.
 * Implements F-pattern layout and progressive disclosure for complex workflows.
 */
export const MENU_ITEMS: Record<string, MenuItemType> = {
  dashboard: {
    id: 'dashboard',
    title: 'Dashboard',
    path: '/dashboard',
    icon: DashboardIcon,
    roles: [
      UserRole.HEALTHCARE_PROVIDER,
      UserRole.INSURANCE_REVIEWER,
      UserRole.ADMIN_STAFF,
      UserRole.PHARMACY_STAFF,
      UserRole.SYSTEM_ADMIN,
    ],
    isVisible: true,
  },
  requests: {
    id: 'requests',
    title: 'Prior Authorizations',
    path: '/requests',
    icon: AssignmentIcon,
    roles: [
      UserRole.HEALTHCARE_PROVIDER,
      UserRole.INSURANCE_REVIEWER,
      UserRole.ADMIN_STAFF,
      UserRole.PHARMACY_STAFF,
      UserRole.SYSTEM_ADMIN,
    ],
    isVisible: true,
    children: [
      {
        id: 'new-request',
        title: 'New Request',
        path: '/requests/new',
        icon: AddIcon,
        roles: [
          UserRole.HEALTHCARE_PROVIDER,
          UserRole.ADMIN_STAFF,
          UserRole.PHARMACY_STAFF,
        ],
        isVisible: true,
      },
      {
        id: 'pending-requests',
        title: 'Pending Requests',
        path: '/requests/pending',
        icon: ListIcon,
        roles: [
          UserRole.HEALTHCARE_PROVIDER,
          UserRole.INSURANCE_REVIEWER,
          UserRole.ADMIN_STAFF,
          UserRole.PHARMACY_STAFF,
        ],
        isVisible: true,
      },
      {
        id: 'completed-requests',
        title: 'Completed Requests',
        path: '/requests/completed',
        icon: ListIcon,
        roles: [
          UserRole.HEALTHCARE_PROVIDER,
          UserRole.INSURANCE_REVIEWER,
          UserRole.ADMIN_STAFF,
          UserRole.PHARMACY_STAFF,
        ],
        isVisible: true,
      },
    ],
  },
  analytics: {
    id: 'analytics',
    title: 'Analytics',
    path: '/analytics',
    icon: AnalyticsIcon,
    roles: [
      UserRole.INSURANCE_REVIEWER,
      UserRole.SYSTEM_ADMIN,
    ],
    isVisible: true,
    children: [
      {
        id: 'performance',
        title: 'Performance Metrics',
        path: '/analytics/performance',
        icon: InsightsIcon,
        roles: [
          UserRole.INSURANCE_REVIEWER,
          UserRole.SYSTEM_ADMIN,
        ],
        isVisible: true,
      },
    ],
  },
  settings: {
    id: 'settings',
    title: 'Settings',
    path: '/settings',
    icon: SettingsIcon,
    roles: [UserRole.SYSTEM_ADMIN],
    isVisible: true,
    children: [
      {
        id: 'security',
        title: 'Security Settings',
        path: '/settings/security',
        icon: SecurityIcon,
        roles: [UserRole.SYSTEM_ADMIN],
        isVisible: true,
      },
    ],
  },
};