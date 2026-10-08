import React, { useCallback, useEffect, useLayoutEffect, useRef, useState, type JSX } from 'react';
import styled from '@emotion/styled';
import _debounce from 'lodash/debounce';
import { TableVirtuoso, TableComponents } from 'react-virtuoso';

// HOPR
import Tooltip from '../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import { navBarHeight } from '../Navbar/navBar';

// Mui
import Table from '@mui/material/Table';
import TableBody from '@mui/material/TableBody';
import TableCell from '@mui/material/TableCell';
import TableContainer from '@mui/material/TableContainer';
import TableRow from '@mui/material/TableRow';
import Paper from '@mui/material/Paper';
import InputBase from '@mui/material/InputBase';
import SearchIcon from '@mui/icons-material/Search';

// the parts of the card layout shared by the wrapped and the phone variant
const CARDS = `
  display: block;
  thead {
    display: none;
  }
  tbody {
    display: block;
  }
  tbody tr[data-index] {
    display: grid;
    padding: 10px 12px;
    border-bottom: 1px solid var(--border);
  }
  tbody tr[data-index] > td {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    gap: 2px;
    width: auto !important;
    min-width: 0;
    max-width: none;
    height: auto;
    padding: 0;
    border: 0;
    text-align: left;
    white-space: normal;
    overflow: visible;
    &::before {
      content: attr(data-label);
      font-size: 10.5px;
      font-weight: 600;
      letter-spacing: 0.05em;
      text-transform: uppercase;
      color: var(--muted);
    }
    &.grow,
    &.actions {
      &::before {
        display: none;
      }
    }
    &.grow {
      font-weight: 600;
    }
    &.actions {
      flex-direction: row;
      flex-wrap: wrap;
    }
  }
`;

// narrowest the address column may get before the table turns into cards
const GROW_MIN_WIDTH = 220;

/**
 * True when the table has less room than its columns need. The need is measured
 * while the table is shown as a table: every column at its content width plus
 * the address column at GROW_MIN_WIDTH. While cards are shown the last
 * measurement is kept, so the layout does not flip back and forth.
 */
const useCardLayout = (rowCount: number) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const requiredRef = useRef(0);
  const cardsRef = useRef(false);
  const [cards, set_cards] = useState(false);

  useLayoutEffect(() => {
    const container = containerRef.current;
    if (!container) return;
    const measure = () => {
      const table = container.querySelector('table');
      if (!cardsRef.current && table) {
        // the header cells render as <td> (plain <thead>, not MUI TableHead)
        const grow = table.querySelector<HTMLElement>('thead .grow');
        requiredRef.current = table.scrollWidth - (grow ? grow.offsetWidth - GROW_MIN_WIDTH : 0);
      }
      const next = container.clientWidth < requiredRef.current;
      if (next !== cardsRef.current) {
        cardsRef.current = next;
        set_cards(next);
      }
    };
    measure();
    const observer = new ResizeObserver(measure);
    observer.observe(container);
    const table = container.querySelector('table');
    if (table) observer.observe(table);
    // late data (e.g. dashboard figures) widens other columns without resizing the table
    const grow = container.querySelector('thead .grow');
    if (grow) observer.observe(grow);
    return () => observer.disconnect();
  }, [rowCount]);

  return { containerRef, cards };
};

const STable = styled(Table)`
  tr.onRowClick {
    cursor: pointer;
  }
  tbody tr {
    transition: background-color 0.12s ease;
  }
  tbody tr:hover {
    background-color: var(--surface-hover);
  }
  /* row actions stay quiet until the row is hovered */
  td.actions .MuiIconButton-root {
    padding: 4px;
    svg {
      width: 18px;
      height: 18px;
      color: var(--muted);
      fill: var(--muted);
    }
  }
  tbody tr:hover td.actions .MuiIconButton-root:not(.Mui-disabled) svg {
    color: var(--primary);
    fill: var(--primary);
  }
  /* copy / explorer links next to addresses only on hover */
  .PeerInfo-links {
    opacity: 0;
    transition: opacity 0.12s ease;
  }
  tbody tr:hover .PeerInfo-links {
    opacity: 1;
  }
  /* touch screens have no hover, keep everything visible */
  @media (hover: none) {
    .PeerInfo-links {
      opacity: 1;
    }
    td.actions .MuiIconButton-root svg {
      color: var(--text-2);
      fill: var(--text-2);
    }
  }
  /* a table without room for all its columns shows every row as a small card,
     values carry their column name (see useCardLayout) */
  &.cards {
    ${CARDS}
    tbody tr[data-index] {
      grid-template-columns: repeat(auto-fill, minmax(130px, 1fr));
      gap: 8px 16px;
    }
    tbody tr[data-index] > td {
      /* address on the left and the row actions on the right of the first line */
      &.grow {
        grid-row: 1;
        grid-column: 1 / -3;
      }
      &.actions {
        grid-row: 1;
        grid-column: -3 / -1;
        justify-content: flex-end;
        align-items: center;
      }
    }
  }
  /* phones: two values per line, actions under the values. The selectors
     repeat with .cards so they also win over the wrapped layout above */
  @container (max-width: 600px) {
    ${CARDS}
    tbody tr[data-index],
    &.cards tbody tr[data-index] {
      grid-template-columns: 1fr 1fr;
      gap: 8px 12px;
    }
    tbody tr[data-index] > td,
    &.cards tbody tr[data-index] > td {
      &.grow,
      &.actions {
        grid-row: auto;
        grid-column: 1 / -1;
      }
      &.actions {
        justify-content: flex-start;
        padding-top: 8px;
        border-top: 1px dashed var(--border);
      }
    }
  }
`;

/*
 * overflow-x: unset keeps the window as the scroll container so the sticky
 * table header can stick below the navbar; on narrow screens horizontal
 * scrolling wins over stickiness.
 */
const STableContainer = styled(TableContainer)`
  container-type: inline-size;
  overflow-x: unset;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  box-shadow: none;
  background: var(--surface);
  @media (max-width: 850px) {
    overflow-x: auto;
  }

  /*
   * In window-scroll mode virtuoso sets an inline pixel height on its scroller
   * from summed row measurements; fractional row heights (browser zoom, OS
   * scaling) make that drift from the table's real layout height and cut off
   * the last row. height: auto keeps the scroll range equal to the actual
   * rendered table height.
   */
  div[data-virtuoso-scroller] {
    height: auto !important;
  }
` as typeof TableContainer;

const STableCell = styled(TableCell)`
  overflow: hidden;
  text-overflow: ellipsis;
  white-space: nowrap;
  padding: 6px 12px;
  height: 40px;
  box-sizing: border-box;
  font-size: 13px;
  color: var(--text);
  border-bottom: 1px solid var(--border);
  font-variant-numeric: tabular-nums;
  &.grow {
    max-width: 0;
  }
  &.align-right {
    text-align: right;
  }
  &.align-center {
    text-align: center;
  }
  &.actions {
    overflow: unset;
    text-align: right;
    padding-right: 8px;
  }
  &.wrap {
    overflow-wrap: anywhere;
    text-overflow: unset;
    white-space: unset;
  }
  &.TableCellHeader {
    height: 36px;
    padding-top: 0;
    padding-bottom: 0;
    background: var(--surface-2);
    color: var(--muted);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
`;

const OverTable = styled.div`
  display: flex;
  align-items: center;
  gap: 8px;
  padding: 8px 12px;
  border-bottom: 1px solid var(--border);
  .count {
    color: var(--muted);
    white-space: nowrap;
  }
`;

const SearchBox = styled.label`
  display: flex;
  align-items: center;
  gap: 6px;
  flex: 0 1 320px;
  height: 30px;
  padding: 0 10px;
  border: 1px solid var(--border);
  border-radius: 6px;
  background: var(--surface);
  color: var(--muted);
  &:focus-within {
    border-color: var(--primary);
    box-shadow: 0 0 0 3px var(--primary-soft);
  }
  svg {
    width: 18px;
    height: 18px;
  }
  .MuiInputBase-root {
    flex: 1;
    font-size: 13px;
  }
  .spacer {
    flex: 1;
  }
`;

const EmptyState = styled.div`
  padding: 8px 16px;
  height: 48px;
  display: flex;
  align-items: center;
  color: var(--muted);
`;

interface Props {
  data: {
    [key: string]: string | number | JSX.Element;
    id: string | number;
    actions: JSX.Element;
  }[];
  id?: string;
  header: {
    key: string;
    name: string;
    search?: boolean;
    tooltip?: boolean;
    width?: string;
    wrap?: boolean;
    maxWidth?: string;
    copy?: boolean;
    hidden?: boolean;
    tooltipHeader?: string | JSX.Element;
    // right align numbers, the cell text and the header follow
    align?: 'left' | 'right' | 'center';
    // the column that takes the free width; every other column shrinks to its content
    grow?: boolean;
  }[];
  search?: boolean;
  loading?: boolean;
  onRowClick?: Function;
  orderByDefault?: string;
}

type RowData = Props['data'][0];

type TableContext = {
  tableId?: string;
  header: Props['header'];
  onRowClick?: Function;
  cards?: boolean;
};

type Order = 'asc' | 'desc';

const isString = (value: any) => typeof value === 'string' || value instanceof String;

function descendingComparator<T>(
  a: { [key in string]: number | string },
  b: { [key in string]: number | string },
  orderBy: string,
) {
  if (isString(b[orderBy]) && isString(a[orderBy])) {
    if ((b[orderBy] as string).toLowerCase() < (a[orderBy] as string).toLowerCase()) {
      return -1;
    }
    if ((b[orderBy] as string).toLowerCase() > (a[orderBy] as string).toLowerCase()) {
      return 1;
    }
  }

  if (b[orderBy] < a[orderBy]) {
    return -1;
  }
  if (b[orderBy] > a[orderBy]) {
    return 1;
  }

  return 0;
}

function getComparator<Key extends keyof any>(
  order: Order,
  orderBy: string,
): (a: { [key in Key]: number | string }, b: { [key in Key]: number | string }) => number {
  return order === 'desc'
    ? (a, b) => descendingComparator(a, b, orderBy)
    : (a, b) => -descendingComparator(a, b, orderBy);
}

const virtuosoComponents: TableComponents<RowData, TableContext> = {
  Table: ({ context, ...tableProps }) => (
    <STable
      {...tableProps}
      className={context?.cards ? 'cards' : ''}
      aria-label="custom table"
    />
  ),
  TableHead: React.forwardRef<HTMLTableSectionElement>(function VirtuosoTableHead(
    { context, ...headProps }: { context?: TableContext; style?: React.CSSProperties },
    ref,
  ) {
    return (
      <thead
        {...headProps}
        style={{
          ...headProps.style,
          top: navBarHeight,
          background: '#fff',
        }}
        ref={ref}
      />
    );
  }),
  TableRow: ({ item, context, ...rowProps }) => (
    <TableRow
      {...rowProps}
      id={context?.tableId ? `${context.tableId}_row_${item.id}` : undefined}
      onClick={() => {
        context?.onRowClick && context.onRowClick(item);
      }}
      className={`${context?.onRowClick ? 'onRowClick' : ''}`}
    />
  ),
  TableBody: React.forwardRef<HTMLTableSectionElement>(function VirtuosoTableBody(props, ref) {
    return (
      <TableBody
        {...props}
        ref={ref}
      />
    );
  }),
};

export default function CustomPaginationActionsTable(props: Props) {
  const [order, setOrder] = React.useState<Order>('asc');
  const [orderBy, setOrderBy] = React.useState<string>(props.orderByDefault || props.header[0].key || 'id');
  const [searchPhrase, set_searchPhrase] = React.useState('');
  const [filteredData, set_filteredData] = React.useState<typeof props.data>([]);

  useEffect(() => {
    filterData(searchPhrase);
  }, [props.data]);

  const debounceFn = useCallback(_debounce(filterData, 150), [props.data]);

  function handleSearchChange(event: { target: { value: string } }) {
    const search: string = event.target.value;
    set_searchPhrase(search);
    debounceFn(search);
  }

  function filterData(searchPhrase: string) {
    const data = props.data;
    const filterBy = props.header.filter((elem) => elem.search === true).map((header) => header.key);

    // SearchPhrase filter
    if (!searchPhrase || searchPhrase === '') {
      set_filteredData(data);
      return;
    }
    const filtered = data.filter((elem) => {
      for (let i = 0; i < filterBy.length; i++) {
        if (
          typeof elem[filterBy[i]] === 'string' &&
          (elem[filterBy[i]] as string).toLowerCase().includes(searchPhrase.toLowerCase())
        )
          return true;
      }
    });
    set_filteredData(filtered);
    return;
  }

  const sortedRows = React.useMemo(
    () =>
      [...filteredData]
        //@ts-expect-error as we can input JSX into the data, but we will not sort by it
        .sort(getComparator(order, orderBy)),
    [filteredData, order, orderBy],
  );

  const { containerRef, cards } = useCardLayout(sortedRows.length);

  return (
    <STableContainer
      component={Paper}
      ref={containerRef}
    >
      {props.search && (
        <OverTable className={`OverTable`}>
          <SearchBox>
            <SearchIcon />
            <InputBase
              placeholder="Search"
              value={searchPhrase}
              onChange={handleSearchChange}
            />
          </SearchBox>
          <span className="count">
            {searchPhrase ? `${sortedRows.length} of ${props.data.length}` : `${props.data.length} rows`}
          </span>
        </OverTable>
      )}
      <TableVirtuoso
        useWindowScroll
        data={sortedRows}
        overscan={{ main: 1200, reverse: 1200 }}
        increaseViewportBy={{ top: 600, bottom: 600 }}
        computeItemKey={(_index, row) => `${props.id}_row_${row.id}`}
        context={{
          tableId: props.id,
          header: props.header,
          onRowClick: props.onRowClick,
          cards,
        }}
        components={virtuosoComponents}
        fixedHeaderContent={() => (
          <TableRow>
            {props.header.map(
              (headElem, idx) =>
                !headElem.hidden && (
                  <STableCell
                    key={idx}
                    className={`TableCell TableCellHeader ${headElem.key} ${cellClasses(headElem)}`}
                    width={cellWidth(headElem)}
                  >
                    <Tooltip
                      title={headElem.tooltipHeader}
                      notWide
                    >
                      <span>{headElem.name}</span>
                    </Tooltip>
                  </STableCell>
                ),
            )}
          </TableRow>
        )}
        itemContent={(_index, row) => (
          <RowCells
            row={row}
            header={props.header}
          />
        )}
      />
      {sortedRows.length === 0 && <EmptyState>{props.loading ? 'Loading...' : 'No entries'}</EmptyState>}
    </STableContainer>
  );
}

const cellWidth = (headElem: Props['header'][0]) => headElem.width ?? (headElem.grow ? undefined : '1%');

const cellClasses = (headElem: Props['header'][0]) =>
  [headElem.grow ? 'grow' : '', headElem.align ? `align-${headElem.align}` : ''].join(' ');

const RowCells = ({ row, header }: { row: RowData; header: Props['header'] }) => {
  const [tooltip, set_tooltip] = useState<string>();

  const onDoubleClick = (event: React.MouseEvent<HTMLTableCellElement, MouseEvent>, value: string) => {
    // if row is clicked twice
    if (event.detail === 2) {
      navigator.clipboard.writeText(value);
      set_tooltip('Copied');
      setTimeout(() => {
        set_tooltip(undefined);
      }, 3000);
    }
  };

  return (
    <>
      {header.map(
        (headElem) =>
          !headElem.hidden && (
            <STableCell
              key={headElem.key}
              className={`TableCell ${headElem.key} ${headElem.wrap ? 'wrap' : ''} ${cellClasses(headElem)}`}
              width={cellWidth(headElem)}
              data-label={typeof headElem.name === 'string' ? headElem.name : ''}
              onClick={(event) =>
                headElem.copy && typeof row[headElem.key] === 'string'
                  ? onDoubleClick(event, row[headElem.key] as string)
                  : undefined
              }
            >
              {headElem.tooltip ? (
                <Tooltip title={tooltip ?? row[headElem.key]}>
                  <span>{row[headElem.key]}</span>
                </Tooltip>
              ) : (
                row[headElem.key]
              )}
            </STableCell>
          ),
      )}
    </>
  );
};
