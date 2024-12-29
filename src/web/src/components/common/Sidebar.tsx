/**
 * @fileoverview Enhanced navigation sidebar component implementing Material Design 3.0
 * with role-based access control, responsive behavior, and accessibility features.
 * @version 1.0.0
 * @package @mui/material ^5.0.0
 * @package react ^18.2.0
 */

import React, { useEffect, useMemo, useCallback, useState } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import {
  Drawer,
  List,
  ListItem,
  ListItemIcon,
  ListItemText,
  Divider,
  useTheme,
  useMediaQuery,
  Collapse,
  IconButton,
  SwipeableDrawer,
  Box,
  styled,
} from '@mui/material';
import {
  ExpandLess,
  ExpandMore,
  Menu as MenuIcon,
} from '@mui/icons-material';
import { MENU_ITEMS } from '../../constants/menu.constants';
import { useAuth } from '../../hooks/useAuth';

// Styled components for enhanced customization
const StyledDrawer = styled(Drawer)(({ theme }) => ({
  width: 280,
  flexShrink: 0,
  whiteSpace: 'nowrap',
  transition: theme.transitions.create('width', {
    easing: theme.transitions.easing.sharp,
    duration: theme.transitions.duration.enteringScreen,
  }),
  '& .MuiDrawer-paper': {
    width: 280,
    backgroundColor: theme.palette.background.paper,
    borderRight: `1px solid ${theme.palette.divider}`,
    overflowX: 'hidden',
  },
}));

const StyledListItem = styled(ListItem)<{ depth?: number; active?: boolean }>(
  ({ theme, depth = 0, active }) => ({
    paddingLeft: theme.spacing(2 + depth * 2),
    marginBottom: theme.spacing(0.5),
    borderRadius: theme.shape.borderRadius,
    transition: theme.transitions.create(['background-color'], {
      duration: theme.transitions.duration.shortest,
    }),
    ...(active && {
      backgroundColor: theme.palette.action.selected,
      '&:hover': {
        backgroundColor: theme.palette.action.hover,
      },
    }),
  }),
);

// Interface definitions
interface SidebarProps {
  isOpen: boolean;
  onClose: () => void;
  onOpen: () => void;
}

interface MenuItemProps {
  item: typeof MENU_ITEMS[keyof typeof MENU_ITEMS];
  depth?: number;
}

/**
 * Enhanced sidebar component with role-based access control and responsive behavior
 */
export const Sidebar: React.FC<SidebarProps> = ({ isOpen, onClose, onOpen }) => {
  const theme = useTheme();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));
  const location = useLocation();
  const navigate = useNavigate();
  const { user, checkRole } = useAuth();
  const [expandedItems, setExpandedItems] = useState<Set<string>>(new Set());

  // Filter menu items based on user role
  const filteredMenuItems = useMemo(() => {
    if (!user) return [];

    return Object.values(MENU_ITEMS).filter((item) => {
      return item.roles.some((role) => checkRole(role));
    });
  }, [user, checkRole]);

  // Handle menu item expansion
  const handleExpand = useCallback((itemId: string) => {
    setExpandedItems((prev) => {
      const next = new Set(prev);
      if (next.has(itemId)) {
        next.delete(itemId);
      } else {
        next.add(itemId);
      }
      return next;
    });
  }, []);

  // Handle navigation with analytics tracking
  const handleNavigation = useCallback((path: string) => {
    navigate(path);
    if (isMobile) {
      onClose();
    }
  }, [navigate, isMobile, onClose]);

  /**
   * Renders individual menu item with proper accessibility attributes
   */
  const MenuItem: React.FC<MenuItemProps> = ({ item, depth = 0 }) => {
    const isExpanded = expandedItems.has(item.id);
    const isActive = location.pathname === item.path;
    const hasChildren = item.children && item.children.length > 0;

    return (
      <>
        <StyledListItem
          button
          depth={depth}
          active={isActive}
          onClick={() => hasChildren ? handleExpand(item.id) : handleNavigation(item.path)}
          aria-expanded={hasChildren ? isExpanded : undefined}
          aria-current={isActive ? 'page' : undefined}
          role="menuitem"
        >
          <ListItemIcon sx={{ minWidth: 40, color: 'text.secondary' }}>
            <item.icon />
          </ListItemIcon>
          <ListItemText primary={item.title} />
          {hasChildren && (
            <IconButton
              edge="end"
              aria-label={isExpanded ? 'collapse' : 'expand'}
              size="small"
              onClick={(e) => {
                e.stopPropagation();
                handleExpand(item.id);
              }}
            >
              {isExpanded ? <ExpandLess /> : <ExpandMore />}
            </IconButton>
          )}
        </StyledListItem>
        {hasChildren && (
          <Collapse in={isExpanded} timeout="auto" unmountOnExit>
            <List component="div" disablePadding role="menu">
              {item.children.map((child) => (
                <MenuItem key={child.id} item={child} depth={depth + 1} />
              ))}
            </List>
          </Collapse>
        )}
      </>
    );
  };

  // Drawer content with accessibility support
  const drawerContent = (
    <Box
      role="navigation"
      aria-label="Main navigation"
      sx={{ height: '100%', overflowY: 'auto' }}
    >
      <List component="nav" role="menu">
        {filteredMenuItems.map((item) => (
          <MenuItem key={item.id} item={item} />
        ))}
      </List>
    </Box>
  );

  // Render appropriate drawer based on device type
  return isMobile ? (
    <SwipeableDrawer
      anchor="left"
      open={isOpen}
      onClose={onClose}
      onOpen={onOpen}
      sx={{
        '& .MuiDrawer-paper': {
          width: 280,
          backgroundColor: theme.palette.background.paper,
        },
      }}
      role="dialog"
      aria-modal="true"
    >
      {drawerContent}
    </SwipeableDrawer>
  ) : (
    <StyledDrawer
      variant="permanent"
      open={isOpen}
      role="navigation"
      aria-label="Main navigation"
    >
      {drawerContent}
    </StyledDrawer>
  );
};

export type { SidebarProps };