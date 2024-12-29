// React core - version ^18.2.0
import React, { useCallback, useMemo } from 'react';
// Material UI components - version ^5.0.0
import { 
  Breadcrumbs as MuiBreadcrumbs, 
  Link, 
  Typography, 
  useMediaQuery 
} from '@mui/material';
// Material UI icons - version ^5.0.0
import NavigateNextIcon from '@mui/icons-material/NavigateNext';
// React Router - version ^6.0.0
import { useLocation, Link as RouterLink } from 'react-router-dom';

// Internal imports
import { Theme, useTheme } from '../../hooks/useTheme';
import { trackNavigation } from '../../hooks/useAnalytics';

/**
 * Interface for individual breadcrumb items with enhanced type safety
 */
export interface BreadcrumbItem {
  /** Display text for the breadcrumb */
  label: string;
  /** Navigation path for the breadcrumb */
  path: string;
  /** Optional icon to display */
  icon?: React.ReactNode;
  /** Data test ID for testing */
  testId?: string;
}

/**
 * Props interface for the Breadcrumbs component with comprehensive type safety
 */
export interface BreadcrumbsProps {
  /** Array of breadcrumb items to display */
  items: BreadcrumbItem[];
  /** Optional CSS class name for custom styling */
  className?: string;
  /** Maximum number of items to display before collapsing */
  maxItems?: number;
  /** Custom aria-label for accessibility */
  ariaLabel?: string;
}

/**
 * A responsive breadcrumb navigation component that provides hierarchical page location context
 * following Material Design 3.0 specifications with comprehensive accessibility features.
 *
 * @component
 * @example
 * ```tsx
 * const items = [
 *   { label: 'Home', path: '/' },
 *   { label: 'Requests', path: '/requests' },
 *   { label: 'Details', path: '/requests/123' }
 * ];
 * 
 * return <Breadcrumbs items={items} />;
 * ```
 */
export const Breadcrumbs: React.FC<BreadcrumbsProps> = React.memo(({
  items,
  className,
  maxItems = 4,
  ariaLabel = 'breadcrumb'
}) => {
  // Hooks
  const { theme, isDarkMode } = useTheme();
  const location = useLocation();
  const isMobile = useMediaQuery(theme.breakpoints.down('sm'));

  // Adjust maxItems for mobile
  const effectiveMaxItems = useMemo(() => 
    isMobile ? Math.min(3, maxItems) : maxItems,
  [isMobile, maxItems]);

  // Styles
  const styles = useMemo(() => ({
    root: {
      padding: theme.spacing(1, 0),
      color: theme.palette.text.secondary,
      direction: theme.direction === 'rtl' ? 'rtl' : 'ltr',
    },
    separator: {
      marginLeft: theme.spacing(1),
      marginRight: theme.spacing(1),
      transform: theme.direction === 'rtl' ? 'rotate(180deg)' : 'none',
    },
    link: {
      display: 'flex',
      alignItems: 'center',
      color: theme.palette.primary.main,
      textDecoration: 'none',
      transition: 'color 0.2s ease',
      '&:hover': {
        textDecoration: 'underline',
        color: theme.palette.primary.dark,
      },
      '&:focus': {
        outline: `2px solid ${theme.palette.primary.main}`,
        outlineOffset: '2px',
      },
    },
    icon: {
      marginRight: theme.spacing(0.5),
      width: '20px',
      height: '20px',
      flexShrink: 0,
    },
    current: {
      color: theme.palette.text.primary,
      fontWeight: 500,
      maxWidth: {
        xs: '120px',
        sm: '200px',
        md: 'none',
      },
      overflow: 'hidden',
      textOverflow: 'ellipsis',
      whiteSpace: 'nowrap',
    },
  }), [theme, isDarkMode]);

  /**
   * Handles breadcrumb click events and tracks navigation
   */
  const handleClick = useCallback((path: string, label: string) => {
    trackNavigation({
      type: 'breadcrumb',
      path,
      label,
      timestamp: new Date().toISOString(),
    });
  }, []);

  /**
   * Renders a single breadcrumb item with proper accessibility attributes
   */
  const renderBreadcrumbItem = useCallback((item: BreadcrumbItem, index: number, total: number) => {
    const isLast = index === total - 1;

    if (isLast) {
      return (
        <Typography
          key={item.path}
          sx={styles.current}
          aria-current="page"
          data-testid={item.testId || `breadcrumb-current`}
        >
          {item.icon && (
            <span style={styles.icon} aria-hidden="true">
              {item.icon}
            </span>
          )}
          {item.label}
        </Typography>
      );
    }

    return (
      <Link
        key={item.path}
        component={RouterLink}
        to={item.path}
        sx={styles.link}
        onClick={() => handleClick(item.path, item.label)}
        data-testid={item.testId || `breadcrumb-${index}`}
        aria-label={`Navigate to ${item.label}`}
      >
        {item.icon && (
          <span style={styles.icon} aria-hidden="true">
            {item.icon}
          </span>
        )}
        {item.label}
      </Link>
    );
  }, [styles, handleClick]);

  // Validate items array
  if (!items?.length) {
    return null;
  }

  return (
    <nav aria-label={ariaLabel} className={className} style={styles.root}>
      <MuiBreadcrumbs
        maxItems={effectiveMaxItems}
        itemsAfterCollapse={2}
        itemsBeforeCollapse={1}
        separator={
          <NavigateNextIcon
            fontSize="small"
            sx={styles.separator}
            aria-hidden="true"
          />
        }
        aria-label={ariaLabel}
      >
        {items.map((item, index) => 
          renderBreadcrumbItem(item, index, items.length)
        )}
      </MuiBreadcrumbs>
    </nav>
  );
});

// Display name for debugging
Breadcrumbs.displayName = 'Breadcrumbs';

// Default export
export default Breadcrumbs;