import React, { useCallback, useMemo, useState } from 'react';
import {
  Table as MuiTable,
  TableBody,
  TableCell,
  TableContainer,
  TableHead,
  TablePagination,
  TableRow,
  TableSortLabel,
  Paper,
  Box,
  useTheme,
  Checkbox,
  Tooltip,
  Typography,
} from '@mui/material';
import { styled } from '@mui/material/styles';
import { visuallyHidden } from '@mui/utils';
import { Loading } from './Loading';
import { PaginationParams, SortOrder } from '../../types/common.types';

// Constants for table configuration
const DEFAULT_PAGE_SIZES = [10, 25, 50, 100] as const;
const MIN_COLUMN_WIDTH = '100px';
const COMPACT_ROW_HEIGHT = '48px';
const STANDARD_ROW_HEIGHT = '64px';
const VIRTUALIZATION_THRESHOLD = 100;
const SCROLL_THRESHOLD = '80vh';

// ARIA labels for sorting states
const ARIA_SORT_LABELS = {
  asc: 'sorted ascending',
  desc: 'sorted descending',
  none: 'not sorted',
} as const;

// Styled components for enhanced table features
const StyledTableContainer = styled(TableContainer)(({ theme }) => ({
  position: 'relative',
  maxHeight: SCROLL_THRESHOLD,
  '&:focus': {
    outline: `2px solid ${theme.palette.primary.main}`,
    outlineOffset: '2px',
  },
}));

const StyledTableRow = styled(TableRow, {
  shouldForwardProp: (prop) => prop !== 'compact' && prop !== 'isSelected',
})<{ compact?: boolean; isSelected?: boolean }>(({ theme, compact, isSelected }) => ({
  height: compact ? COMPACT_ROW_HEIGHT : STANDARD_ROW_HEIGHT,
  cursor: 'pointer',
  '&:hover': {
    backgroundColor: theme.palette.action.hover,
  },
  ...(isSelected && {
    backgroundColor: theme.palette.action.selected,
    '&:hover': {
      backgroundColor: theme.palette.action.selected,
    },
  }),
}));

// Interface definitions
export interface TableColumn {
  id: string;
  label: string;
  sortable?: boolean;
  width?: string | number;
  align?: 'left' | 'center' | 'right';
  renderCell?: (row: any) => React.ReactNode;
  headerProps?: { 'aria-label'?: string; className?: string };
  cellProps?: { 'aria-label'?: string; className?: string };
  sortComparator?: (a: any, b: any) => number;
  filter?: { type: 'text' | 'select' | 'date'; options?: any[] };
}

export interface TableProps {
  columns: TableColumn[];
  data: any[];
  loading?: boolean;
  pagination: PaginationParams;
  onPaginationChange: (params: PaginationParams) => void;
  onRowClick?: (row: any) => void;
  selectedRows?: string[];
  onRowSelect?: (ids: string[]) => void;
  compact?: boolean;
  stickyHeader?: boolean;
  virtualized?: boolean;
  rowHeight?: number;
  emptyStateComponent?: React.ReactNode;
  errorStateComponent?: React.ReactNode;
  ariaLabel?: string;
  className?: string;
  testId?: string;
}

export const Table: React.FC<TableProps> = ({
  columns,
  data,
  loading = false,
  pagination,
  onPaginationChange,
  onRowClick,
  selectedRows = [],
  onRowSelect,
  compact = false,
  stickyHeader = true,
  virtualized = false,
  rowHeight,
  emptyStateComponent,
  errorStateComponent,
  ariaLabel = 'Data table',
  className,
  testId = 'data-table',
}) => {
  const theme = useTheme();
  const [hoveredRowId, setHoveredRowId] = useState<string | null>(null);

  // Memoized sort handlers
  const handleSort = useCallback(
    (columnId: string) => {
      const column = columns.find((col) => col.id === columnId);
      if (!column?.sortable) return;

      const isAsc = pagination.sortBy === columnId && pagination.sortOrder === 'asc';
      const newOrder: SortOrder = isAsc ? 'desc' : 'asc';

      onPaginationChange({
        ...pagination,
        sortBy: columnId,
        sortOrder: newOrder,
        page: 0, // Reset to first page on sort change
      });
    },
    [columns, pagination, onPaginationChange]
  );

  // Handle page change with accessibility announcement
  const handlePageChange = useCallback(
    (event: unknown, newPage: number) => {
      onPaginationChange({
        ...pagination,
        page: newPage,
      });

      // Announce page change to screen readers
      const announcement = `Page ${newPage + 1} of ${Math.ceil(
        data.length / pagination.pageSize
      )}`;
      const ariaLive = document.createElement('div');
      ariaLive.setAttribute('aria-live', 'polite');
      ariaLive.textContent = announcement;
      document.body.appendChild(ariaLive);
      setTimeout(() => document.body.removeChild(ariaLive), 1000);
    },
    [pagination, onPaginationChange, data.length]
  );

  // Handle row selection
  const handleRowSelect = useCallback(
    (id: string) => {
      if (!onRowSelect) return;
      const newSelected = selectedRows.includes(id)
        ? selectedRows.filter((rowId) => rowId !== id)
        : [...selectedRows, id];
      onRowSelect(newSelected);
    },
    [selectedRows, onRowSelect]
  );

  // Render table header
  const renderHeader = useMemo(
    () => (
      <TableHead>
        <TableRow>
          {onRowSelect && (
            <TableCell padding="checkbox">
              <Checkbox
                indeterminate={
                  selectedRows.length > 0 && selectedRows.length < data.length
                }
                checked={data.length > 0 && selectedRows.length === data.length}
                onChange={() =>
                  onRowSelect(
                    selectedRows.length === data.length
                      ? []
                      : data.map((row) => row.id)
                  )
                }
                aria-label="Select all rows"
              />
            </TableCell>
          )}
          {columns.map((column) => (
            <TableCell
              key={column.id}
              align={column.align || 'left'}
              style={{ width: column.width || MIN_COLUMN_WIDTH }}
              {...column.headerProps}
            >
              {column.sortable ? (
                <TableSortLabel
                  active={pagination.sortBy === column.id}
                  direction={
                    pagination.sortBy === column.id
                      ? pagination.sortOrder
                      : 'asc'
                  }
                  onClick={() => handleSort(column.id)}
                >
                  {column.label}
                  {pagination.sortBy === column.id && (
                    <Box component="span" sx={visuallyHidden}>
                      {ARIA_SORT_LABELS[pagination.sortOrder]}
                    </Box>
                  )}
                </TableSortLabel>
              ) : (
                column.label
              )}
            </TableCell>
          ))}
        </TableRow>
      </TableHead>
    ),
    [columns, pagination, handleSort, onRowSelect, selectedRows, data]
  );

  // Render empty or error state
  if (!loading && data.length === 0) {
    return (
      <Box
        display="flex"
        justifyContent="center"
        alignItems="center"
        p={4}
        data-testid={`${testId}-empty`}
      >
        {emptyStateComponent || (
          <Typography variant="body1" color="textSecondary">
            No data available
          </Typography>
        )}
      </Box>
    );
  }

  return (
    <Paper elevation={0} className={className}>
      <StyledTableContainer
        component={Paper}
        tabIndex={0}
        role="grid"
        aria-label={ariaLabel}
        data-testid={testId}
      >
        <MuiTable stickyHeader={stickyHeader} aria-labelledby={ariaLabel}>
          {renderHeader}
          <TableBody>
            {loading ? (
              <TableRow>
                <TableCell colSpan={columns.length + (onRowSelect ? 1 : 0)}>
                  <Loading size="medium" />
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, index) => (
                <StyledTableRow
                  key={row.id}
                  compact={compact}
                  isSelected={selectedRows.includes(row.id)}
                  onMouseEnter={() => setHoveredRowId(row.id)}
                  onMouseLeave={() => setHoveredRowId(null)}
                  onClick={() => {
                    onRowClick?.(row);
                    handleRowSelect(row.id);
                  }}
                  aria-selected={selectedRows.includes(row.id)}
                  tabIndex={0}
                >
                  {onRowSelect && (
                    <TableCell padding="checkbox">
                      <Checkbox
                        checked={selectedRows.includes(row.id)}
                        onChange={(e) => {
                          e.stopPropagation();
                          handleRowSelect(row.id);
                        }}
                        aria-label={`Select row ${index + 1}`}
                      />
                    </TableCell>
                  )}
                  {columns.map((column) => (
                    <TableCell
                      key={`${row.id}-${column.id}`}
                      align={column.align || 'left'}
                      {...column.cellProps}
                    >
                      {column.renderCell?.(row) ?? row[column.id]}
                    </TableCell>
                  ))}
                </StyledTableRow>
              ))
            )}
          </TableBody>
        </MuiTable>
      </StyledTableContainer>
      <TablePagination
        component="div"
        count={data.length}
        page={pagination.page}
        onPageChange={handlePageChange}
        rowsPerPage={pagination.pageSize}
        rowsPerPageOptions={DEFAULT_PAGE_SIZES}
        onRowsPerPageChange={(e) =>
          onPaginationChange({
            ...pagination,
            pageSize: parseInt(e.target.value, 10),
            page: 0,
          })
        }
        aria-label="Table pagination"
      />
    </Paper>
  );
};

export default Table;