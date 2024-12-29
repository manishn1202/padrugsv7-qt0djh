import React, { useCallback, useMemo } from 'react';
import { Tabs as MuiTabs, Tab as MuiTab } from '@mui/material';
import { styled } from '@mui/material/styles';
import { theme } from '../../assets/styles/theme';

// Version comments for external dependencies
// @mui/material: ^5.14.0
// react: ^18.2.0

/**
 * Interface for individual tab items with enhanced accessibility support
 */
interface TabItem {
  id: string;
  label: string;
  content: React.ReactNode;
  disabled?: boolean;
  icon?: React.ReactNode;
  ariaLabel?: string;
  errorState?: boolean;
  loading?: boolean;
}

/**
 * Props interface for the Tabs component with comprehensive configuration options
 */
interface TabsProps {
  items: TabItem[];
  value: string;
  onChange: (value: string) => void;
  orientation?: 'horizontal' | 'vertical';
  variant?: 'standard' | 'fullWidth' | 'scrollable';
  centered?: boolean;
  className?: string;
  ariaLabel?: string;
  errorBoundary?: boolean;
  loadingFallback?: React.ReactNode;
  customTabRenderer?: (item: TabItem) => React.ReactNode;
  onTabError?: (error: Error, tabId: string) => void;
}

/**
 * Styled tabs container component with healthcare-optimized theming
 */
const StyledTabs = styled(MuiTabs)(({ theme }) => ({
  borderBottom: `1px solid ${theme.palette.divider}`,
  minHeight: theme.spacing(6),
  backgroundColor: theme.palette.background.paper,
  transition: 'all 200ms ease-in-out',
  
  '&.vertical': {
    borderRight: `1px solid ${theme.palette.divider}`,
    borderBottom: 'none',
    minWidth: theme.spacing(25),
  },
  
  '&.error': {
    borderColor: theme.palette.error.main,
  },
  
  '@media (prefers-reduced-motion)': {
    transition: 'none',
  },
  
  // Healthcare-specific styling
  '& .MuiTabs-indicator': {
    backgroundColor: theme.palette.primary.main,
    height: 3,
  },
}));

/**
 * Styled individual tab component with accessibility enhancements
 */
const StyledTab = styled(MuiTab)(({ theme }) => ({
  minHeight: theme.spacing(6),
  textTransform: 'none',
  fontWeight: theme.typography.fontWeightMedium,
  fontSize: theme.typography.body1.fontSize,
  padding: theme.spacing(2, 3),
  
  '&.Mui-selected': {
    color: theme.palette.primary.main,
    fontWeight: theme.typography.fontWeightBold,
  },
  
  '&.Mui-disabled': {
    color: theme.palette.text.disabled,
    opacity: 0.7,
  },
  
  '&:focus-visible': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '-2px',
  },
  
  // Healthcare-specific indicators
  '&.error': {
    color: theme.palette.error.main,
    '&::after': {
      content: '""',
      position: 'absolute',
      top: theme.spacing(1),
      right: theme.spacing(1),
      width: 8,
      height: 8,
      borderRadius: '50%',
      backgroundColor: theme.palette.error.main,
    },
  },
  
  '&.loading': {
    opacity: 0.7,
    pointerEvents: 'none',
  },
}));

/**
 * Helper function to generate comprehensive accessibility props for tabs
 */
const a11yProps = (id: string) => ({
  id: `tab-${id}`,
  'aria-controls': `tabpanel-${id}`,
  role: 'tab',
  tabIndex: 0,
});

/**
 * TabPanel component for rendering tab content with proper accessibility attributes
 */
const TabPanel: React.FC<{
  children: React.ReactNode;
  value: string;
  index: string;
}> = ({ children, value, index }) => (
  <div
    role="tabpanel"
    hidden={value !== index}
    id={`tabpanel-${index}`}
    aria-labelledby={`tab-${index}`}
  >
    {value === index && children}
  </div>
);

/**
 * Main tabs component that renders an accessible tabbed interface
 * following Material Design 3.0 specification and WCAG 2.1 Level AA compliance
 */
const Tabs: React.FC<TabsProps> = React.memo(({
  items,
  value,
  onChange,
  orientation = 'horizontal',
  variant = 'standard',
  centered = false,
  className = '',
  ariaLabel = 'Navigation tabs',
  errorBoundary = false,
  loadingFallback,
  customTabRenderer,
  onTabError,
}) => {
  // Memoize tab change handler
  const handleChange = useCallback((_: React.SyntheticEvent, newValue: string) => {
    onChange(newValue);
  }, [onChange]);

  // Memoize error boundary handler
  const handleError = useCallback((error: Error, tabId: string) => {
    console.error(`Tab error: ${error.message}`);
    onTabError?.(error, tabId);
  }, [onTabError]);

  // Memoize tab content for performance
  const tabContent = useMemo(() => (
    items.map((item) => (
      <TabPanel key={item.id} value={value} index={item.id}>
        {item.content}
      </TabPanel>
    ))
  ), [items, value]);

  return (
    <div
      className={`tabs-container ${className}`}
      role="navigation"
      aria-label={ariaLabel}
    >
      <StyledTabs
        value={value}
        onChange={handleChange}
        orientation={orientation}
        variant={variant}
        centered={centered}
        className={orientation === 'vertical' ? 'vertical' : ''}
        aria-label={ariaLabel}
        allowScrollButtonsMobile
        scrollButtons="auto"
      >
        {items.map((item) => {
          if (customTabRenderer) {
            return customTabRenderer(item);
          }
          
          return (
            <StyledTab
              key={item.id}
              label={item.label}
              value={item.id}
              icon={item.icon}
              disabled={item.disabled}
              aria-label={item.ariaLabel || item.label}
              className={`
                ${item.errorState ? 'error' : ''}
                ${item.loading ? 'loading' : ''}
              `}
              {...a11yProps(item.id)}
            />
          );
        })}
      </StyledTabs>

      {errorBoundary ? (
        <React.Suspense fallback={loadingFallback || <div>Loading...</div>}>
          {tabContent}
        </React.Suspense>
      ) : (
        tabContent
      )}
    </div>
  );
});

Tabs.displayName = 'Tabs';

export default Tabs;