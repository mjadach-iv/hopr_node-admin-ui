import { useImperativeHandle, useMemo, useRef, useState, type ReactNode, type RefObject } from 'react';
import styled from '@emotion/styled';
import { formatEther } from 'viem';
import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ReferenceArea,
  ReferenceLine,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from 'recharts';
import ToggleButton from '@mui/material/ToggleButton';
import ToggleButtonGroup from '@mui/material/ToggleButtonGroup';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import ExpandLessIcon from '@mui/icons-material/ExpandLess';
import CloseIcon from '@mui/icons-material/Close';
import { DialogTitle } from '@mui/material';
import { useAppSelector } from '../../store';
import { useVisibleInterval } from '../../hooks/usePageVisible';
import { shrinkNumber } from '../../utils/amount';
import { loadStateFromLocalStorage, saveStateToLocalStorage } from '../../utils/localStorage';
import { nodeSortFields } from '../../utils/aliases';
import * as indexerApi from '../../indexer/api';
import type { EarningsBucketSize, EarningsResponse, EarningsSplit } from '../../indexer/types';
import { describeStatus } from '../IndexerNotice';
import { SubpageTitle } from '../SubpageTitle';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';
import { SDialog, SDialogContent, SIconButton, TopBar } from '../../future-hopr-lib-components/Modal/styled';

// categorical slots 1 and 2 of the dataviz reference palette, dark steps, validated on --surface
const TRAFFIC_COLOR = '#3987e5';
const CT_COLOR = '#d95926';
// what the nodes paid, a greyed blue on top and see-through, so it reads as set apart from the
// earnings under it. #51617d is at OKLab ΔE 17 from the traffic blue and 25 from CT; faint on the
// surface, so its figures are in the tooltip, the totals and the table as text. The same rgba is used
// for the bars and every swatch, the legend's included
const SPENT_COLOR = 'rgba(81, 97, 125, 0.4)';
// the net loss of a bucket, below the axis
const LOSS_COLOR = '#ff2a1a';
const STACK_ORDER = ['ctBar', 'trafficBar', 'spentBar', 'loss'];

const HOUR = 3600;
const DAY = 24 * HOUR;

type Range = '24h' | '7d' | '30d' | '90d' | 'all';
const RANGES: { id: Range; label: string; seconds: number | null; bucket: EarningsBucketSize }[] = [
  { id: '24h', label: '24h', seconds: DAY, bucket: '15m' },
  { id: '7d', label: '7d', seconds: 7 * DAY, bucket: '1h' },
  { id: '30d', label: '30d', seconds: 30 * DAY, bucket: '1d' },
  { id: '90d', label: '90d', seconds: 90 * DAY, bucket: '1d' },
  { id: 'all', label: 'All', seconds: null, bucket: '1d' },
];
const BUCKETS: { id: EarningsBucketSize; label: string; seconds: number }[] = [
  { id: '15m', label: '15m', seconds: 15 * 60 },
  { id: '1h', label: '1h', seconds: HOUR },
  { id: '1d', label: '1d', seconds: DAY },
  { id: '1w', label: '1w', seconds: 7 * DAY },
];
// the indexer answers up to 5000 buckets, a bar chart reads well far below that
const MAX_BARS = 800;
// the small charts of the safe and node grids, about 380px wide
const COMPACT_MAX_BARS = 120;

const toggleStyles = `
  .MuiToggleButton-root {
    padding: 2px 10px;
    font-size: 12px;
    text-transform: none;
    color: var(--muted);
    border-color: var(--border);
    &.Mui-selected {
      color: var(--text);
      background: var(--surface-hover);
    }
    /* a bucket that would draw too many bars or a single one */
    &.Mui-disabled {
      color: var(--border-strong);
    }
  }
`;

// the switches of every chart per node, on the right of their title
const TitleControls = styled.div`
  display: flex;
  flex-wrap: wrap;
  gap: 8px;
  ${toggleStyles}
`;

const Card = styled.div`
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 16px;
  padding: 12px 16px 8px;
  background: var(--surface);
  border: 1px solid var(--border);
  border-radius: var(--radius);
  .head {
    display: flex;
    flex-wrap: wrap;
    align-items: baseline;
    gap: 4px 16px;
    margin-bottom: 8px;
  }
  .totals {
    display: flex;
    flex-wrap: wrap;
    gap: 4px 16px;
    font-size: 13px;
    color: var(--text);
    .label {
      color: var(--muted);
      margin-right: 4px;
    }
    /* every figure of the chart is in it, so it is named once in front */
    .unit {
      color: var(--muted);
      font-weight: 600;
    }
    .swatch {
      display: inline-block;
      width: 8px;
      height: 8px;
      margin-right: 6px;
      border-radius: 2px;
    }
  }
  .status {
    margin-left: auto;
    font-size: 12px;
    color: var(--muted);
  }
  .message {
    padding: 48px 0;
    text-align: center;
    color: var(--muted);
    font-size: 13px;
  }
  /* opens the chart on its own in the popup */
  &.opens {
    cursor: pointer;
    &:hover {
      border-color: var(--border-strong);
    }
  }
  &.compact {
    padding: 8px 10px 4px;
    .head {
      gap: 4px 8px;
      margin-bottom: 4px;
    }
    .totals {
      gap: 2px 10px;
      font-size: 12px;
    }
    .message {
      padding: 24px 0;
    }
  }
`;

const TooltipBox = styled.div`
  padding: 8px 10px;
  background: var(--surface-2);
  border: 1px solid var(--border-strong);
  border-radius: 6px;
  font-size: 12px;
  color: var(--text);
  .when {
    display: flex;
    gap: 16px;
    justify-content: space-between;
    color: var(--muted);
    margin-bottom: 4px;
  }
  .row {
    display: flex;
    align-items: center;
    gap: 6px;
    font-variant-numeric: tabular-nums;
  }
  /* the result of the rows above it, under a line like a sum */
  .net {
    margin-top: 4px;
    padding-top: 4px;
    border-top: 1px solid var(--border-strong);
  }
  .swatch {
    width: 8px;
    height: 8px;
    border-radius: 2px;
  }
  .value {
    margin-left: auto;
    padding-left: 16px;
  }
`;

const wxHopr = (wei: string | bigint) => Number(formatEther(BigInt(wei)));
// Ticket values do not divide evenly, so tickets of 5 and of 2.5 wxHOPR that should cancel out leave a
// few wei, e.g. 2 x 5.000000000133777433 against 4 x 2.500000000066888716. A net within a millionth
// of a wxHOPR, far below what the figures show, is 0 and no loss
const DUST = BigInt(10) ** BigInt(12);
const netOf = (earned: bigint, spent: bigint) => {
  const net = earned - spent;
  return net > -DUST && net < DUST ? BigInt(0) : net;
};
const format = (value: number) => (value === 0 ? '0' : shrinkNumber(String(value)));
// spent is shown negative, so CT, traffic and spent add up to net
const formatSigned = (value: number) => (value < 0 ? `-${format(-value)}` : format(value));

const formatWhen = (t: number, bucket: EarningsBucketSize) => {
  const date = new Date(t * 1000);
  if (bucket === '15m' || bucket === '1h') {
    return date.toLocaleString(undefined, { month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
  }
  const day = date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  return bucket === '1w' ? `Week of ${day}` : day;
};

const formatTick = (t: number, bucket: EarningsBucketSize, severalDays: boolean) => {
  const date = new Date(t * 1000);
  if (bucket !== '15m' && bucket !== '1h')
    return date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
  const time = date.toLocaleTimeString(undefined, { hour: '2-digit', minute: '2-digit' });
  return severalDays ? `${date.toLocaleDateString(undefined, { month: 'short', day: 'numeric' })} ${time}` : time;
};

type Point = {
  t: number;
  traffic: number;
  ct: number;
  spent: number;
  // from the wei, the sum of the rounded figures may be a hair off 0
  net: number;
  // the bars: a positive net is as tall as CT, traffic and spent stacked in proportion to their
  // figures, a negative one hangs under the axis as the loss alone
  ctBar: number;
  trafficBar: number;
  spentBar: number;
  loss: number;
};

const ChartTooltip = ({
  active,
  payload,
  bucket,
}: {
  active?: boolean;
  payload?: { payload: Point }[];
  bucket: EarningsBucketSize;
}) => {
  const point = payload?.[0]?.payload;
  if (!active || !point) return null;
  return (
    <TooltipBox>
      <div className="when">
        {formatWhen(point.t, bucket)}
        <span className="unit">wxHOPR</span>
      </div>
      <div className="row">
        <span
          className="swatch"
          style={{ background: CT_COLOR }}
        />
        CT<span className="value">{format(point.ct)}</span>
      </div>
      <div className="row">
        <span
          className="swatch"
          style={{ background: TRAFFIC_COLOR }}
        />
        Traffic<span className="value">{format(point.traffic)}</span>
      </div>
      <div className="row">
        <span
          className="swatch"
          style={{ background: SPENT_COLOR }}
        />
        Spent<span className="value">{formatSigned(-point.spent)}</span>
      </div>
      <div className="row net">
        {point.loss < 0 && (
          <span
            className="swatch"
            style={{ background: LOSS_COLOR }}
          />
        )}
        Net<span className="value">{formatSigned(point.net)}</span>
      </div>
    </TooltipBox>
  );
};

const errorMessage = (e: unknown) => (e instanceof Error ? e.message : String(e));

type Period = { range: Range; bucket: EarningsBucketSize };

// seconds the range covers, "All" from where the index starts
const useRangeSeconds = (range: Range) => {
  const startTs = useAppSelector((store) => store.indexer.status?.startTs ?? null);
  const seconds = RANGES.find((r) => r.id === range)!.seconds;
  if (seconds !== null) return seconds;
  return startTs ? Math.floor(Date.now() / 1000) - startTs : 90 * DAY;
};

// too many bars to read, or a single one
const fits = (bucketSeconds: number, rangeSeconds: number, maxBars: number) =>
  rangeSeconds / bucketSeconds <= maxBars && bucketSeconds < rangeSeconds;

/**
 * A range with the bucket it suggests, or the next larger one that keeps the bars within `maxBars`,
 * until another bucket is picked for it. Both are remembered in the browser under the section's `id`.
 */
const usePeriod = (id: string, maxBars: number) => {
  // the range and a picked bucket of each section, so it opens as it was left
  const periodKey = `app/earnings/${id}/period`;
  const [stored] = useState(() => {
    const value = loadStateFromLocalStorage(periodKey) as { range?: unknown; bucket?: unknown } | null;
    return {
      range: RANGES.some((r) => r.id === value?.range) ? (value!.range as Range) : '30d',
      bucket: BUCKETS.some((b) => b.id === value?.bucket) ? (value!.bucket as EarningsBucketSize) : null,
    };
  });
  const [range, set_range] = useState<Range>(stored.range);
  const [bucketChoice, set_bucketChoice] = useState<EarningsBucketSize | null>(stored.bucket);
  const save = (value: { range: Range; bucket: EarningsBucketSize | null }) =>
    saveStateToLocalStorage(periodKey, value);
  const rangeSeconds = useRangeSeconds(range);
  const suggested = BUCKETS.findIndex((b) => b.id === RANGES.find((r) => r.id === range)!.bucket);
  const bucket =
    bucketChoice ??
    (BUCKETS.slice(suggested).find((b) => fits(b.seconds, rangeSeconds, maxBars)) ?? BUCKETS[suggested]).id;
  return {
    range,
    bucket,
    rangeSeconds,
    maxBars,
    setRange: (value: Range) => {
      set_range(value);
      set_bucketChoice(null);
      save({ range: value, bucket: null });
    },
    setBucket: (value: EarningsBucketSize) => {
      set_bucketChoice(value);
      save({ range, bucket: value });
    },
  };
};

const PeriodControls = ({ period }: { period: ReturnType<typeof usePeriod> }) => {
  const { rangeSeconds, maxBars } = period;
  return (
    <>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={period.range}
        onChange={(_, value: Range | null) => value && period.setRange(value)}
      >
        {RANGES.map((r) => (
          <ToggleButton
            key={r.id}
            value={r.id}
          >
            {r.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
      <ToggleButtonGroup
        size="small"
        exclusive
        value={period.bucket}
        onChange={(_, value: EarningsBucketSize | null) => value && period.setBucket(value)}
      >
        {BUCKETS.map((b) => (
          <ToggleButton
            key={b.id}
            value={b.id}
            disabled={!fits(b.seconds, rangeSeconds, maxBars)}
          >
            {b.label}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </>
  );
};

/**
 * Earnings of nodes over time from the earnings indexer, split into CT (tickets from the CT nodes set
 * on the settings page) and traffic, with what the nodes spent on top, each bar as tall as the net,
 * over the period picked on the title of its section.
 */
const EarningsChart = ({
  nodes,
  compact = false,
  period,
  onOpen,
}: {
  nodes: string[];
  // a lower chart for the grids of safes and nodes, without the sync status the chart of all nodes shows
  compact?: boolean;
  period: Period;
  // a click anywhere on the chart, to open it in the popup
  onOpen?: () => void;
}) => {
  const available = useAppSelector((store) => store.indexer.available);
  const status = useAppSelector((store) => store.indexer.status);
  // CT is decided by the indexer at query time, new CT nodes refetch
  const ctNodesKey = useAppSelector((store) => store.app.configuration.ctNodes.join(','));
  const { range, bucket } = period;
  // every chart on the page loads on its own, the figures belong to the request in `key`
  const [loaded, set_loaded] = useState<{ key: string; data: EarningsResponse | null; error: string | null } | null>(
    null,
  );
  const latestKey = useRef<string | null>(null);
  const rangeSpec = RANGES.find((r) => r.id === range)!;
  const tz = Intl.DateTimeFormat().resolvedOptions().timeZone;

  const key = [nodes.join(','), range, bucket, tz, ctNodesKey].join('|');
  latestKey.current = key;

  const syncedBlock = useAppSelector((store) =>
    store.indexer.status?.phase === 'syncing' ? store.indexer.status.cursor : null,
  );
  useVisibleInterval(
    () => {
      if (!available || nodes.length === 0) return;
      const now = Math.floor(Date.now() / 1000);
      const requestKey = key;
      return indexerApi
        .getEarnings({
          nodes: nodes,
          bucket,
          from: rangeSpec.seconds === null ? undefined : now - rangeSpec.seconds,
          tz,
        })
        .then(
          (data) => {
            if (latestKey.current === requestKey) set_loaded({ key: requestKey, data, error: null });
          },
          (e) => {
            // a failed refresh keeps the figures shown
            if (latestKey.current !== requestKey) return;
            set_loaded((prev) => ({
              key: requestKey,
              data: prev?.key === requestKey ? prev.data : null,
              error: errorMessage(e),
            }));
          },
        );
    },
    60_000,
    // while the indexer syncs, every block it reaches redraws the chart, about every 5 s
    [available, key, syncedBlock],
  );

  const data = loaded?.key === key ? loaded.data : null;
  const error = loaded?.key === key ? loaded.error : null;
  // up to 800 buckets of BigInt sums, worked out once per response rather than on every render
  const points: Point[] = useMemo(
    () =>
      (data?.buckets ?? []).map((b) => {
        const net = wxHopr(netOf(BigInt(b.ct) + BigInt(b.traffic), BigInt(b.spent)));
        const ct = wxHopr(b.ct);
        const traffic = wxHopr(b.traffic);
        const spent = wxHopr(b.spent);
        const scale = net > 0 ? net / (ct + traffic + spent) : 0;
        return {
          t: b.t,
          traffic,
          ct,
          spent,
          net,
          ctBar: ct * scale,
          trafficBar: traffic * scale,
          spentBar: spent * scale,
          loss: Math.min(net, 0),
        };
      }),
    [data],
  );
  const anyLoss = points.some((point) => point.loss < 0);
  // the buckets from the first one the index has not fully reached, shaded while it syncs
  const bucketSeconds = BUCKETS.find((b) => b.id === bucket)!.seconds;
  const syncingFrom =
    data?.syncedTo != null && data.syncedTo < data.to - HOUR
      ? points.find((point) => point.t + bucketSeconds > data.syncedTo!)?.t
      : undefined;
  const sum = (pick: (split: EarningsSplit) => string) =>
    Object.values(data?.totals ?? {}).reduce((total, split) => total + BigInt(pick(split)), BigInt(0));
  const ct = sum((split) => split.ct);
  const traffic = sum((split) => split.traffic);
  const spent = sum((split) => split.spent);
  const net = netOf(ct + traffic, spent);

  return (
    <Card
      className={[compact && 'compact', onOpen && 'opens'].filter(Boolean).join(' ') || undefined}
      onClick={onOpen}
    >
      <div className="head">
        {data && (
          <div className="totals">
            <span className="unit">wxHOPR</span>
            <span>
              <span
                className="swatch"
                style={{ background: CT_COLOR }}
              />
              <span className="label">CT</span>
              {format(wxHopr(ct))}
            </span>
            <span>
              <span
                className="swatch"
                style={{ background: TRAFFIC_COLOR }}
              />
              <span className="label">Traffic</span>
              {format(wxHopr(traffic))}
            </span>
            <span>
              <span
                className="swatch"
                style={{ background: SPENT_COLOR }}
              />
              <span className="label">Spent</span>
              {formatSigned(-wxHopr(spent))}
            </span>
            <span>
              {net < BigInt(0) && (
                <span
                  className="swatch"
                  style={{ background: LOSS_COLOR }}
                />
              )}
              <span className="label">Net</span>
              {formatSigned(wxHopr(net))}
            </span>
          </div>
        )}
        {status && !compact && <span className="status">{describeStatus(status)}</span>}
      </div>
      {!data ? (
        <div className="message">{error ? `Could not load the earnings: ${error}` : 'Loading…'}</div>
      ) : points.length === 0 ? (
        <div className="message">Nothing indexed in this range yet</div>
      ) : (
        <>
          <ResponsiveContainer
            width="100%"
            height={compact ? 150 : 260}
          >
            <BarChart
              data={points}
              barCategoryGap={points.length > 200 ? 0 : 1}
              // the loss stacks down from 0, the rest up
              stackOffset="sign"
              margin={{ top: 8, right: 8, bottom: 0, left: 0 }}
            >
              {syncingFrom !== undefined && (
                <ReferenceArea
                  x1={syncingFrom}
                  x2={points[points.length - 1].t}
                  fill="rgba(141, 155, 203, 0.1)"
                  stroke="none"
                  ifOverflow="extendDomain"
                  // in the middle of the part the index has not reached yet
                  label={{
                    value: 'Syncing',
                    position: 'center',
                    fill: '#8d9bcb',
                    fontSize: compact ? 13 : 16,
                    fontWeight: 600,
                  }}
                />
              )}
              <CartesianGrid
                vertical={false}
                stroke="#1d2266"
              />
              <XAxis
                dataKey="t"
                tickFormatter={(t: number) => formatTick(t, bucket, data.to - data.from > DAY)}
                tick={{ fill: '#8d9bcb', fontSize: 11 }}
                axisLine={{ stroke: '#2d3a86' }}
                tickLine={false}
                minTickGap={24}
              />
              <YAxis
                tickFormatter={(value: number) => format(value)}
                tick={{ fill: '#8d9bcb', fontSize: 11 }}
                axisLine={false}
                tickLine={false}
                width={48}
              />
              {/* the axis the losses hang from, the x axis is at the bottom */}
              {anyLoss && (
                <ReferenceLine
                  y={0}
                  stroke="#2d3a86"
                />
              )}
              <Tooltip
                content={<ChartTooltip bucket={bucket} />}
                cursor={{ fill: 'rgba(141, 155, 203, 0.12)' }}
                isAnimationActive={false}
              />
              {/* the totals above carry the colours of a compact chart */}
              {!compact && (
                <Legend
                  verticalAlign="bottom"
                  height={24}
                  iconType="square"
                  iconSize={8}
                  // the order the bars stack in, from the axis up
                  itemSorter={(item) => STACK_ORDER.indexOf(String(item.dataKey))}
                  formatter={(value: string) => <span style={{ color: '#c9d1ee', fontSize: 12 }}>{value}</span>}
                />
              )}
              <Bar
                dataKey="ctBar"
                name="CT"
                stackId="earnings"
                fill={CT_COLOR}
                isAnimationActive={false}
              />
              <Bar
                dataKey="trafficBar"
                name="Traffic"
                stackId="earnings"
                fill={TRAFFIC_COLOR}
                isAnimationActive={false}
              />
              <Bar
                dataKey="spentBar"
                name="Spent"
                stackId="earnings"
                fill={SPENT_COLOR}
                radius={[4, 4, 0, 0]}
                isAnimationActive={false}
              />
              {anyLoss && (
                <Bar
                  dataKey="loss"
                  name="Net loss"
                  stackId="earnings"
                  fill={LOSS_COLOR}
                  isAnimationActive={false}
                />
              )}
            </BarChart>
          </ResponsiveContainer>
        </>
      )}
    </Card>
  );
};

// the charts per safe or per node, as many side by side as fit
const NodeGrid = styled.div`
  width: 100%;
  display: grid;
  grid-template-columns: repeat(auto-fill, minmax(min(100%, 380px), 1fr));
  gap: 0 16px;
  > div {
    min-width: 0;
  }
`;

// a safe's or node's name over its chart, much smaller than the section title
const NodeName = styled.div`
  display: flex;
  align-items: baseline;
  gap: 8px;
  min-width: 0;
  margin: 4px 0 6px;
  white-space: nowrap;
  font-size: 13px;
  font-weight: 600;
  color: var(--text);
  .address {
    overflow: hidden;
    text-overflow: ellipsis;
    font-family: var(--font-mono);
    font-size: 12px;
    font-weight: 400;
    color: var(--muted);
  }
  .count {
    flex: none;
    font-size: 12px;
    font-weight: 400;
    color: var(--muted);
  }
  &.popup {
    margin: 0;
    font-size: 16px;
    .address {
      font-size: 13px;
    }
  }
`;

/** A node's name over its chart: its alias, if any, and its address. */
export const nodeChartTitle = (address: string, alias?: string) => (
  <>
    {alias && <span>{alias}</span>}
    <span
      className="address"
      title={address}
    >
      {address}
    </span>
  </>
);

/** A safe's name over its chart: its alias or Safe, its address and how many nodes the chart covers. */
export const safeChartTitle = (safe: string, alias: string | undefined, nodeCount: number) => (
  <>
    <span>{alias ?? 'Safe'}</span>
    <span
      className="address"
      title={safe}
    >
      {safe}
    </span>
    <span className="count">{`${nodeCount} ${nodeCount === 1 ? 'node' : 'nodes'}`}</span>
  </>
);

type ChartTarget = { title: ReactNode; nodes: string[] };

/**
 * One chart at full size in a dialog, with switches of its own, remembered like a section's. It holds
 * what it shows, so opening and closing it renders the dialog alone, not the page with its table and
 * charts; `open` is how the page shows a chart in it.
 */
const EarningsPopup = ({ open }: { open: RefObject<(target: ChartTarget) => void> }) => {
  const [target, set_target] = useState<ChartTarget | null>(null);
  useImperativeHandle(open, () => set_target, []);
  const onClose = () => set_target(null);
  const period = usePeriod('popup', MAX_BARS);
  // kept while the dialog fades out
  const shown = useRef<ChartTarget | null>(null);
  if (target) shown.current = target;

  return (
    <SDialog
      open={!!target}
      onClose={onClose}
      disableScrollLock={true}
      maxWidth="1100px"
    >
      <TopBar>
        <DialogTitle component="div">
          <NodeName className="popup">{shown.current?.title}</NodeName>
        </DialogTitle>
        <SIconButton
          aria-label="close modal"
          onClick={onClose}
        >
          <CloseIcon />
        </SIconButton>
      </TopBar>
      <SDialogContent>
        <TitleControls>
          <PeriodControls period={period} />
        </TitleControls>
        {shown.current && (
          <EarningsChart
            nodes={shown.current.nodes}
            period={periodOf(period)}
          />
        )}
      </SDialogContent>
    </SDialog>
  );
};

/**
 * The popup of a page, `popup` is rendered once anywhere on it. `opener` gives the click handler that
 * shows the chart of the given nodes under the given title in it, none while there is no indexer.
 */
export const useEarningsPopup = () => {
  const available = useAppSelector((store) => store.indexer.available);
  const open = useRef<(target: ChartTarget) => void>(() => undefined);
  return {
    opener: (title: ReactNode, nodes: string[]) => (available ? () => open.current({ title, nodes }) : undefined),
    popup: <EarningsPopup open={open} />,
  };
};

/**
 * Content under its own title that hides and shows it, like the closed channels tables. Shown until it
 * is hidden, the choice is remembered in the browser; hidden charts load nothing.
 */
const Hider = ({
  title,
  id,
  tooltip,
  controls,
  children,
}: {
  title: string;
  // what the show / hide choice is remembered under
  id: string;
  tooltip: string;
  // on the right of the title while the content is shown
  controls?: ReactNode;
  children: ReactNode;
}) => {
  const showKey = `app/earnings/${id}/show`;
  const [show, set_show] = useState(() => {
    const stored = loadStateFromLocalStorage(showKey);
    return typeof stored === 'boolean' ? stored : true;
  });

  const toggleShow = () => {
    saveStateToLocalStorage(showKey, !show);
    set_show(!show);
  };

  return (
    <>
      <SubpageTitle
        title={title}
        titleAction={
          <IconButton
            iconComponent={show ? <ExpandLessIcon /> : <ExpandMoreIcon />}
            tooltipText={
              <span>
                {show ? 'HIDE' : 'SHOW'}
                <br />
                {tooltip}
              </span>
            }
            onClick={toggleShow}
          />
        }
        controls={show && controls}
      />
      {show && children}
    </>
  );
};

/** The switches of a section on the right of its title, while it is shown. */
const titleControls = (period: ReturnType<typeof usePeriod>) => (
  <TitleControls>
    <PeriodControls period={period} />
  </TitleControls>
);

const periodOf = ({ range, bucket }: ReturnType<typeof usePeriod>): Period => ({ range, bucket });

/**
 * A chart for each node, as many side by side as fit, behind one hider with one set of switches for
 * all of them. `id` is what the show / hide choice is remembered under, per page.
 */
export const NodesEarnings = ({ nodes, id }: { nodes: string[]; id: string }) => {
  const available = useAppSelector((store) => store.indexer.available);
  const aliases = useAppSelector((store) => store.app.aliases);
  const period = usePeriod(id, COMPACT_MAX_BARS);
  const popup = useEarningsPopup();
  if (!available || nodes.length === 0) return null;
  // A to Z like the tables open: nodes with an alias first by alias, then by address; sorting a table leaves it
  const sorted = [...nodes].sort((a, b) => {
    const left = nodeSortFields(a, aliases[a]);
    const right = nodeSortFields(b, aliases[b]);
    return left.nodeRank - right.nodeRank || left.nodeSort.localeCompare(right.nodeSort, undefined, { numeric: true });
  });

  return (
    <Hider
      title={`Earnings per node (${nodes.length})`}
      id={id}
      tooltip="a chart for each node"
      controls={titleControls(period)}
    >
      <NodeGrid>
        {sorted.map((address) => {
          const title = nodeChartTitle(address, aliases[address]);
          return (
            <div key={address}>
              <NodeName>{title}</NodeName>
              <EarningsChart
                nodes={[address]}
                compact
                period={periodOf(period)}
                onOpen={popup.opener(title, [address])}
              />
            </div>
          );
        })}
      </NodeGrid>
      {popup.popup}
    </Hider>
  );
};

/**
 * The watchlist's earnings in three sections, each behind a hider with one set of switches for all of
 * its charts: all watched nodes together, then a chart per safe, then a chart per node.
 */
export const WatchlistEarnings = ({
  nodes,
  safes,
}: {
  nodes: string[];
  // every node of each safe in the watchlist, the watched ones and the others, as its row sums them
  safes: { safe: string; nodes: string[] }[];
}) => {
  const available = useAppSelector((store) => store.indexer.available);
  const aliases = useAppSelector((store) => store.app.aliases);
  const allPeriod = usePeriod('all', MAX_BARS);
  const safesPeriod = usePeriod('safes', COMPACT_MAX_BARS);
  const popup = useEarningsPopup();
  if (!available || nodes.length === 0) return null;

  return (
    <>
      <Hider
        title="Earnings of all watched nodes"
        id="all"
        tooltip="the earnings chart"
        controls={titleControls(allPeriod)}
      >
        <EarningsChart
          nodes={nodes}
          period={periodOf(allPeriod)}
          onOpen={popup.opener('Earnings of all watched nodes', nodes)}
        />
      </Hider>
      {safes.length > 0 && (
        <Hider
          title={`Earnings per safe (${safes.length})`}
          id="safes"
          tooltip="a chart for each safe"
          controls={titleControls(safesPeriod)}
        >
          <NodeGrid>
            {safes.map(({ safe, nodes: safeNodes }) => {
              const title = safeChartTitle(safe, aliases[safe], safeNodes.length);
              return (
                <div key={safe}>
                  <NodeName>{title}</NodeName>
                  <EarningsChart
                    nodes={safeNodes}
                    compact
                    period={periodOf(safesPeriod)}
                    onOpen={popup.opener(title, safeNodes)}
                  />
                </div>
              );
            })}
          </NodeGrid>
        </Hider>
      )}
      <NodesEarnings
        nodes={nodes}
        id="nodes"
      />
      {popup.popup}
    </>
  );
};

/**
 * One full width chart of the given nodes under its own hidable title with its switches, as the watchlist's
 * chart of all nodes: the safe's nodes on SAFE INFO, the node on NODE INFO.
 */
export const EarningsSection = ({ title, id, nodes }: { title: string; id: string; nodes: string[] }) => {
  const available = useAppSelector((store) => store.indexer.available);
  const period = usePeriod(id, MAX_BARS);
  const popup = useEarningsPopup();
  if (!available || nodes.length === 0) return null;

  return (
    <Hider
      title={title}
      id={id}
      tooltip="the earnings chart"
      controls={titleControls(period)}
    >
      <EarningsChart
        nodes={nodes}
        period={periodOf(period)}
        onOpen={popup.opener(title, nodes)}
      />
      {popup.popup}
    </Hider>
  );
};
