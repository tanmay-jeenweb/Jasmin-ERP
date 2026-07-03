import React, { useMemo, useState, useEffect, useRef } from 'react';

// Save and retrieve table column preferences locally in localStorage
const getTablePreference = async (tableId) => {
  try {
    const saved = localStorage.getItem(`table_pref_${tableId}`);
    return saved ? { data: { success: true, data: JSON.parse(saved) } } : null;
  } catch (e) {
    console.error(e);
    return null;
  }
};

const saveTablePreference = async (tableId, visibleKeys) => {
  try {
    localStorage.setItem(`table_pref_${tableId}`, JSON.stringify(visibleKeys));
  } catch (e) {
    console.error(e);
  }
};

const DragIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={3} stroke="currentColor" className="h-4 w-4 text-blue-100">
    <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 6.75h.008v.008H8.25V6.75Zm0 5.25h.008v.008H8.25V12Zm0 5.25h.008v.008H8.25v-.008Zm7.5-10.5h.008v.008h-.008V6.75Zm0 5.25h.008v.008h-.008V12Zm0 5.25h.008v.008h-.008v-.008Z" />
  </svg>
);

const ColumnsIcon = () => (
  <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={1.8} stroke="currentColor" className="h-4 w-4">
    <path strokeLinecap="round" strokeLinejoin="round" d="M9 4.5v15m6-15v15m-10.875 0h15.75c.621 0 1.125-.504 1.125-1.125V5.625c0-.621-.504-1.125-1.125-1.125H4.125C3.504 4.5 3 5.004 3 5.625v12.75c0 .621.504 1.125 1.125 1.125Z" />
  </svg>
);

// ── Helpers ────────────────────────────────────────────────────────────────────

/**
 * Rebuild full column array from saved visible-key list.
 * Visible cols appear first (in saved order), hidden cols appended at end.
 */
const buildOrderedColumns = (initialCols, savedVisibleKeys) => {
  if (!savedVisibleKeys || !Array.isArray(savedVisibleKeys) || savedVisibleKeys.length === 0)
    return initialCols;
  const savedSet = new Set(savedVisibleKeys);
  const ordered = [];
  savedVisibleKeys.forEach(key => {
    const col = initialCols.find(c => c.key === key);
    if (col) ordered.push(col);
  });
  // Append hidden columns at end for position memory
  initialCols.forEach(col => {
    if (!savedSet.has(col.key)) ordered.push(col);
  });
  return ordered;
};

/**
 * Derive the hidden-column set from initialCols vs. the saved visible-key list.
 * Keys absent from savedVisibleKeys → hidden.
 */
const buildHiddenSet = (initialCols, savedVisibleKeys) => {
  if (!savedVisibleKeys || !Array.isArray(savedVisibleKeys) || savedVisibleKeys.length === 0)
    return new Set();
  const savedSet = new Set(savedVisibleKeys);
  return new Set(initialCols.filter(c => !savedSet.has(c.key)).map(c => c.key));
};

// ── Component ──────────────────────────────────────────────────────────────────

export default function DataTable({
  title = "Data Table",
  data = [],
  columns: initialColumns = [],
  loading = false,
  actionButton = null,
  toggleActions = null,
  searchPlaceholder = "Search...",
  tableId = null,
}) {
  // Full ordered list (visible + hidden). Visible ones come first.
  const [columns, setColumns] = useState(initialColumns);
  // Set of hidden column keys
  const [hiddenColumns, setHiddenColumns] = useState(new Set());
  // Column chooser popover open state
  const [showColumnChooser, setShowColumnChooser] = useState(false);

  const columnChooserRef = useRef(null);
  const savedOrderRef = useRef(null);    // last saved visible-key array
  const prevKeys = useRef('');           // detect initialColumns changes

  // ── Load preference on mount ──────────────────────────────────────────────
  useEffect(() => {
    const loadPreference = async () => {
      if (!tableId) {
        setColumns(initialColumns);
        setHiddenColumns(new Set());
        prevKeys.current = initialColumns.map(c => c.key).join(',');
        return;
      }
      try {
        const response = await getTablePreference(tableId);
        if (response?.data?.success && response.data.data) {
          const savedOrder = response.data.data; // visible keys in order
          savedOrderRef.current = savedOrder;
          setColumns(buildOrderedColumns(initialColumns, savedOrder));
          setHiddenColumns(buildHiddenSet(initialColumns, savedOrder));
        } else {
          setColumns(initialColumns);
          setHiddenColumns(new Set());
        }
      } catch (err) {
        console.error("Failed to load table preference:", err);
        setColumns(initialColumns);
        setHiddenColumns(new Set());
      }
      prevKeys.current = initialColumns.map(c => c.key).join(',');
    };

    loadPreference();
  }, [tableId]);

  // ── Re-apply when initialColumns change (e.g. permissions change) ─────────
  useEffect(() => {
    const currentKeys = initialColumns.map(c => c.key).join(',');
    if (currentKeys !== prevKeys.current && prevKeys.current !== '') {
      const ordered = savedOrderRef.current
        ? buildOrderedColumns(initialColumns, savedOrderRef.current)
        : initialColumns;
      const hidden = savedOrderRef.current
        ? buildHiddenSet(initialColumns, savedOrderRef.current)
        : new Set();
      setColumns(ordered);
      setHiddenColumns(hidden);
      prevKeys.current = currentKeys;
    }
  }, [initialColumns]);

  // ── Click-outside to close column chooser ────────────────────────────────
  useEffect(() => {
    const handleClickOutside = (e) => {
      if (columnChooserRef.current && !columnChooserRef.current.contains(e.target)) {
        setShowColumnChooser(false);
      }
    };
    if (showColumnChooser) {
      document.addEventListener('mousedown', handleClickOutside);
    }
    return () => document.removeEventListener('mousedown', handleClickOutside);
  }, [showColumnChooser]);

  // ── Drag state ────────────────────────────────────────────────────────────
  const [draggedColumn, setDraggedColumn] = useState(null);

  // ── Search / pagination / sort ────────────────────────────────────────────
  const [search, setSearch] = useState('');
  const [pageSize, setPageSize] = useState(8);
  const [currentPage, setCurrentPage] = useState(1);
  const [sortConfig, setSortConfig] = useState({ key: null, direction: 'asc' });

  // ── Visible columns (used for rendering) ─────────────────────────────────
  const visibleColumns = useMemo(
    () => columns.filter(c => !hiddenColumns.has(c.key)),
    [columns, hiddenColumns]
  );

  // ── Filtered / sorted / paginated rows ───────────────────────────────────
  const filteredRows = useMemo(() => {
    let filtered = [...data];

    if (search) {
      filtered = filtered.filter(row => {
        const searchableValues = Object.values(row)
          .filter(val => typeof val === 'string' || typeof val === 'number')
          .join(' ')
          .toLowerCase();
        return searchableValues.includes(search.toLowerCase());
      });
    }

    if (sortConfig.key) {
      filtered.sort((a, b) => {
        const aVal = a[sortConfig.key];
        const bVal = b[sortConfig.key];
        const aValue = aVal != null ? String(aVal).toLowerCase() : '';
        const bValue = bVal != null ? String(bVal).toLowerCase() : '';
        if (sortConfig.direction === 'asc') return aValue > bValue ? 1 : aValue < bValue ? -1 : 0;
        return aValue < bValue ? 1 : aValue > bValue ? -1 : 0;
      });
    }

    return filtered;
  }, [data, search, sortConfig]);

  const totalPages = pageSize === 'all' ? 1 : Math.max(1, Math.ceil(filteredRows.length / pageSize));
  const paginatedRows = pageSize === 'all'
    ? filteredRows
    : filteredRows.slice((currentPage - 1) * pageSize, currentPage * pageSize);

  // ── Handlers ──────────────────────────────────────────────────────────────
  const handleSort = (key) => {
    setSortConfig(prev => ({
      key,
      direction: prev.key === key && prev.direction === 'asc' ? 'desc' : 'asc',
    }));
    setCurrentPage(1);
  };

  const handleSearch = (val) => { setSearch(val); setCurrentPage(1); };
  const handlePageSize = (val) => {
    setPageSize(val === 'all' ? 'all' : Number(val));
    setCurrentPage(1);
  };

  /** Drag-drop reorders only visible columns; hidden columns stay at end. */
  const handleDrop = (targetKey) => {
    if (!draggedColumn || draggedColumn === targetKey) return;

    const visibleCols = columns.filter(c => !hiddenColumns.has(c.key));
    const hiddenCols  = columns.filter(c =>  hiddenColumns.has(c.key));

    const fromIndex = visibleCols.findIndex(c => c.key === draggedColumn);
    const toIndex   = visibleCols.findIndex(c => c.key === targetKey);
    if (fromIndex === -1 || toIndex === -1) return;

    const [removed] = visibleCols.splice(fromIndex, 1);
    visibleCols.splice(toIndex, 0, removed);

    const updated = [...visibleCols, ...hiddenCols];
    setColumns(updated);
    setDraggedColumn(null);

    if (tableId) {
      const newOrder = visibleCols.map(c => c.key);
      savedOrderRef.current = newOrder;
      saveTablePreference(tableId, newOrder).catch(err =>
        console.error("Failed to save table preference:", err)
      );
    }
  };

  /** Toggle a column on/off; persist immediately. */
  const handleToggleColumn = (key) => {
    const newHidden = new Set(hiddenColumns);
    if (newHidden.has(key)) newHidden.delete(key);
    else newHidden.add(key);
    setHiddenColumns(newHidden);

    if (tableId) {
      const visibleKeys = columns.filter(c => !newHidden.has(c.key)).map(c => c.key);
      savedOrderRef.current = visibleKeys;
      saveTablePreference(tableId, visibleKeys).catch(err =>
        console.error("Failed to save column visibility:", err)
      );
    }
  };

  /** Reset all columns to default (all visible, default order). */
  const handleResetColumns = () => {
    setHiddenColumns(new Set());
    setColumns(initialColumns);
    setShowColumnChooser(false);

    if (tableId) {
      const allKeys = initialColumns.map(c => c.key);
      savedOrderRef.current = allKeys;
      saveTablePreference(tableId, allKeys).catch(err =>
        console.error("Failed to reset column preference:", err)
      );
    }
  };

  // ── Render ─────────────────────────────────────────────────────────────────
  return (
    <div className="w-full flex-1 flex flex-col">
      <div className="rounded-2xl border border-slate-300 bg-white shadow-lg flex-1 flex flex-col">

        {/* ── Header ───────────────────────────────────────────────────── */}
        <div className="border-b border-slate-200 bg-white px-4 py-4 rounded-t-2xl">
          <div className="flex flex-col gap-3 xl:flex-row xl:items-center xl:justify-between">
            <div>
              <h1 className="text-2xl font-bold text-blue-900">{title}</h1>
            </div>
            <div className="flex flex-wrap items-center gap-2">
              {/* Search */}
              <input
                type="text"
                value={search}
                onChange={(e) => handleSearch(e.target.value)}
                placeholder={searchPlaceholder}
                className="h-10 rounded-lg border border-slate-300 bg-slate-50 px-3 text-sm outline-none focus:border-blue-600"
              />

              {/* Toggle actions (e.g. Show Deactivated toggle) */}
              {toggleActions}

              {/* ── Column Chooser ─────────────────────────────────────── */}
              {tableId && (
                <div className="relative" ref={columnChooserRef}>
                  <button
                    onClick={() => setShowColumnChooser(v => !v)}
                    title="Show / hide columns"
                    className={`inline-flex h-10 w-10 items-center justify-center rounded-lg border relative transition-colors ${
                      showColumnChooser
                        ? 'border-blue-900 bg-blue-50 text-blue-900'
                        : 'border-slate-300 bg-white text-slate-600 hover:border-slate-400 hover:bg-slate-50'
                    }`}
                  >
                    <ColumnsIcon />
                    {hiddenColumns.size > 0 && (
                      <span className="absolute -top-1 -right-1 inline-flex items-center justify-center min-w-4 h-4 px-1 rounded-full bg-blue-900 text-white text-[10px] font-bold leading-none shadow">
                        {hiddenColumns.size}
                      </span>
                    )}
                  </button>

                  {showColumnChooser && (
                    <div className="absolute right-0 top-12 z-50 w-56 rounded-xl border border-slate-200 bg-white shadow-2xl">
                      {/* Popover header */}
                      <div className="border-b border-slate-100 px-3 py-2.5 flex items-center justify-between">
                        <p className="text-xs font-semibold uppercase tracking-wide text-slate-500">
                          Toggle Columns
                        </p>
                        <span className="text-[11px] text-slate-400">
                          {initialColumns.length - hiddenColumns.size}/{initialColumns.length}
                        </span>
                      </div>

                      {/* Column checklist */}
                      <div className="max-h-64 overflow-y-auto py-1.5 px-1.5 space-y-0.5">
                        {initialColumns.map(col => {
                          const isLocked  = col.key === 'actions';
                          const isVisible = !hiddenColumns.has(col.key);
                          return (
                            <label
                              key={col.key}
                              className={`flex items-center gap-2.5 rounded-lg px-2 py-1.5 text-sm select-none transition-colors ${
                                isLocked
                                  ? 'cursor-not-allowed opacity-50'
                                  : 'cursor-pointer hover:bg-slate-50'
                              }`}
                            >
                              <input
                                type="checkbox"
                                checked={isVisible}
                                disabled={isLocked}
                                onChange={() => !isLocked && handleToggleColumn(col.key)}
                                className="accent-blue-900 h-3.5 w-3.5 flex-shrink-0"
                              />
                              <span className={`flex-1 font-medium ${isVisible ? 'text-slate-700' : 'text-slate-400'}`}>
                                {col.label}
                              </span>
                              {isLocked && (
                                <span className="text-[10px] font-semibold text-slate-400 uppercase tracking-wide">
                                  Locked
                                </span>
                              )}
                            </label>
                          );
                        })}
                      </div>

                      {/* Reset button */}
                      <div className="border-t border-slate-100 p-2">
                        <button
                          onClick={handleResetColumns}
                          className="w-full rounded-lg py-1.5 text-xs font-semibold text-blue-900 hover:bg-blue-50 transition-colors flex items-center justify-center gap-1"
                        >
                          <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-3.5 w-3.5">
                            <path strokeLinecap="round" strokeLinejoin="round" d="M16.023 9.348h4.992v-.001M2.985 19.644v-4.992m0 0h4.992m-4.993 0 3.181 3.183a8.25 8.25 0 0 0 13.803-3.7M4.031 9.865a8.25 8.25 0 0 1 13.803-3.7l3.181 3.182m0-4.991v4.99" />
                          </svg>
                          Reset to Default
                        </button>
                      </div>
                    </div>
                  )}
                </div>
              )}

              {/* Page-level action button (Add, toggles, etc.) */}
              {actionButton}
            </div>
          </div>
        </div>

        {/* ── Table ────────────────────────────────────────────────────── */}
        <div
          className="overflow-x-auto flex-1"
          onDragOver={(e) => {
            const container = e.currentTarget;
            const { clientX } = e;
            const rect = container.getBoundingClientRect();
            const scrollThreshold = 120;
            const scrollSpeed = 18;
            if (clientX - rect.left < scrollThreshold) container.scrollLeft -= scrollSpeed;
            if (rect.right - clientX < scrollThreshold) container.scrollLeft += scrollSpeed;
          }}
        >
          <table className="min-w-full border-separate border-spacing-0">
            <thead>
              <tr>
                {visibleColumns.map((column) => {
                  const originalColumn = initialColumns.find(c => c.key === column.key) || column;
                  return (
                    <th
                      key={column.key}
                      draggable
                      onDragStart={() => setDraggedColumn(column.key)}
                      onDragOver={(e) => e.preventDefault()}
                      onDrop={() => handleDrop(column.key)}
                      className="border-b border-blue-800 bg-blue-900 px-3 py-3 text-left text-xs font-semibold uppercase tracking-wide text-white"
                      style={{ minWidth: originalColumn.minWidth || '140px' }}
                    >
                      <div className="flex items-center justify-between gap-2">
                        <button
                          onClick={() => handleSort(column.key)}
                          disabled={originalColumn.sortable === false}
                          className={`flex items-center gap-1 ${originalColumn.sortable === false ? 'cursor-default' : ''}`}
                        >
                          {originalColumn.label}
                          {originalColumn.sortable !== false && (
                            <span className="text-[10px] text-blue-200">⇅</span>
                          )}
                        </button>
                        <DragIcon />
                      </div>
                    </th>
                  );
                })}
              </tr>
            </thead>
            <tbody>
              {loading ? (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-slate-500 text-sm">
                    Loading...
                  </td>
                </tr>
              ) : paginatedRows.length > 0 ? (
                paginatedRows.map((row, rowIndex) => (
                  <tr key={row.id || rowIndex} className="transition-all hover:bg-slate-50">
                    {visibleColumns.map((column) => {
                      const originalColumn = initialColumns.find(c => c.key === column.key) || column;
                      return (
                        <td
                          key={column.key}
                          className="border-b border-slate-200 bg-white px-3 py-2 text-sm text-slate-700"
                          style={{ minWidth: originalColumn.minWidth || '140px' }}
                        >
                          {originalColumn.render ? originalColumn.render(row) : row[column.key]}
                        </td>
                      );
                    })}
                  </tr>
                ))
              ) : (
                <tr>
                  <td colSpan={visibleColumns.length} className="px-6 py-8 text-center text-slate-500 text-sm">
                    No records found
                  </td>
                </tr>
              )}
            </tbody>
          </table>
        </div>

        {/* ── Pagination Footer ─────────────────────────────────────────── */}
        <div className="flex flex-wrap items-center justify-between gap-3 border-t border-slate-200 bg-white px-5 py-3 rounded-b-2xl">
          <div className="flex items-center gap-2 text-sm text-slate-500">
            <span>Rows per page:</span>
            <select
              value={pageSize}
              onChange={(e) => handlePageSize(e.target.value)}
              className="h-8 rounded-md border border-slate-300 bg-slate-50 px-2 text-sm text-slate-700 outline-none focus:border-blue-500"
            >
              <option value={8}>8</option>
              <option value={25}>25</option>
              <option value={50}>50</option>
              <option value={100}>100</option>
              <option value="all">All</option>
            </select>
          </div>

          <div className="flex items-center gap-1 text-sm text-slate-500">
            {pageSize !== 'all' && (
              <span className="mr-3">
                {Math.min((currentPage - 1) * pageSize + 1, filteredRows.length)}–{Math.min(currentPage * pageSize, filteredRows.length)} of {filteredRows.length}
              </span>
            )}
            {pageSize === 'all' && (
              <span className="mr-3">{filteredRows.length} rows</span>
            )}

            <button
              onClick={() => setCurrentPage(p => Math.max(1, p - 1))}
              disabled={currentPage === 1 || pageSize === 'all'}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M15.75 19.5L8.25 12l7.5-7.5" />
              </svg>
            </button>

            {pageSize !== 'all' && Array.from({ length: totalPages }, (_, i) => i + 1)
              .filter(p => p === 1 || p === totalPages || Math.abs(p - currentPage) <= 1)
              .reduce((acc, p, idx, arr) => {
                if (idx > 0 && p - arr[idx - 1] > 1) acc.push('...');
                acc.push(p);
                return acc;
              }, [])
              .map((p, i) =>
                p === '...' ? (
                  <span key={`ellipsis-${i}`} className="px-1 text-slate-400">…</span>
                ) : (
                  <button
                    key={p}
                    onClick={() => setCurrentPage(p)}
                    className={`flex h-8 w-8 items-center justify-center rounded-md text-sm font-medium transition-colors ${
                      p === currentPage
                        ? 'bg-blue-900 text-white'
                        : 'border border-slate-200 text-slate-600 hover:border-slate-400 hover:text-slate-900'
                    }`}
                  >
                    {p}
                  </button>
                )
              )}

            <button
              onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))}
              disabled={currentPage === totalPages || pageSize === 'all'}
              className="flex h-8 w-8 items-center justify-center rounded-md border border-slate-200 text-slate-500 transition-colors hover:border-slate-400 hover:text-slate-800 disabled:cursor-not-allowed disabled:opacity-30"
            >
              <svg xmlns="http://www.w3.org/2000/svg" fill="none" viewBox="0 0 24 24" strokeWidth={2} stroke="currentColor" className="h-4 w-4">
                <path strokeLinecap="round" strokeLinejoin="round" d="M8.25 4.5l7.5 7.5-7.5 7.5" />
              </svg>
            </button>
          </div>
        </div>

      </div>
    </div>
  );
}