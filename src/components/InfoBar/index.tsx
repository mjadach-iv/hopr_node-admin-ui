import { useState } from 'react';
import styled from '@emotion/styled';
import { useLocation } from 'react-router-dom';
import { formatEther } from 'viem';
import { Popover } from '@mui/material';
import HelpOutlineIcon from '@mui/icons-material/HelpOutline';
import ExpandMoreIcon from '@mui/icons-material/ExpandMore';
import { useAppSelector } from '../../store';
import { shrinkNumber } from '../../utils/amount';
import { StatusPill } from '../StatusPill';

// HOPR Components
import FAQ from '../Faq';
import nodeInfoData from '../Faq/node-faq';

type Level = '' | 'warn' | 'low';

/** The node's balances and status, shared by the header, its popover and the mobile menu. */
export const useWallet = () => {
  const balances = useAppSelector((store) => store.node.balances.data);
  const info = useAppSelector((store) => store.node.info.data);
  const safeChannelsOut = useAppSelector((store) => store.blokli.channelStats.data);
  const redeemed = useAppSelector((store) => store.blokli.ticketRedemption.data?.redeemed.formatted);

  const total =
    safeChannelsOut?.value && balances.safeHopr?.value
      ? formatEther(BigInt(safeChannelsOut.value) + BigInt(balances.safeHopr?.value))
      : null;

  let xDaiLevel: Level = '';
  if (balances.native.value && BigInt(balances.native.value) < BigInt('1000000000000000')) xDaiLevel = 'low';
  else if (balances.native.value && BigInt(balances.native.value) < BigInt('50000000000000000')) xDaiLevel = 'warn';

  return {
    status: info?.connectivityStatus,
    items: [
      {
        key: 'node',
        label: 'Node',
        long: 'xDAI · node',
        value: balances.native?.formatted,
        unit: 'xDAI',
        level: xDaiLevel,
      },
      { key: 'safe', label: 'Safe', long: 'wxHOPR · safe', value: balances.safeHopr?.formatted, unit: 'wxHOPR' },
      {
        key: 'channels',
        label: 'Safe channels',
        long: 'In safe channels',
        value: safeChannelsOut?.formatted,
        unit: 'wxHOPR',
      },
      { key: 'earned', label: 'Earned', long: 'Node earned', value: redeemed, unit: 'wxHOPR' },
      { key: 'total', label: 'Total', long: 'Total staked', value: total, unit: 'wxHOPR' },
    ] as { key: string; label: string; long: string; value?: string | null; unit: string; level?: Level }[],
  };
};

const Bar = styled.div`
  display: flex;
  align-items: center;
  gap: 4px;
  min-width: 0;
`;

const Chip = styled.button`
  display: flex;
  align-items: center;
  height: 40px;
  min-width: 0;
  padding: 0 6px 0 14px;
  border: 1px solid var(--border-strong);
  border-radius: 20px;
  background: var(--surface);
  color: var(--text);
  font: inherit;
  font-variant-numeric: tabular-nums;
  cursor: pointer;
  white-space: nowrap;
  transition: border-color 0.12s ease, background-color 0.12s ease;
  &:hover {
    border-color: rgba(255, 255, 160, 0.45);
    background: var(--surface-2);
  }
  .dot {
    flex: 0 0 8px;
    width: 8px;
    height: 8px;
    margin-right: 12px;
    border-radius: 50%;
    background: var(--muted);
    &.Green {
      background: var(--green);
      box-shadow: 0 0 0 3px var(--green-soft);
    }
    &.Orange,
    &.Yellow {
      background: var(--orange);
      box-shadow: 0 0 0 3px var(--orange-soft);
    }
    &.Red {
      background: var(--red);
      box-shadow: 0 0 0 3px var(--red-soft);
    }
  }
  .stat {
    display: flex;
    flex-direction: column;
    align-items: flex-start;
    padding: 0 12px;
    line-height: 1.15;
    border-left: 1px solid var(--border);
    &:first-of-type {
      padding-left: 0;
      border-left: 0;
    }
  }
  .label {
    font-size: 10px;
    font-weight: 600;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .value {
    font-size: 13px;
    font-weight: 650;
  }
  .unit {
    margin-left: 3px;
    font-size: 11px;
    font-weight: 500;
    color: var(--muted);
  }
  .stat.total .value {
    color: var(--primary);
  }
  .warn .value {
    color: var(--orange);
  }
  .low .value {
    color: var(--red);
  }
  svg {
    flex: 0 0 18px;
    width: 18px;
    height: 18px;
    color: var(--muted);
  }
  /* fewer figures as the bar gets narrower, the rest is one click away */
  @media (max-width: 1280px) {
    .stat.channels,
    .stat.earned {
      display: none;
    }
  }
  @media (max-width: 760px) {
    padding-left: 12px;
    .stat.safe {
      display: none;
    }
    .dot {
      margin-right: 10px;
    }
  }
  @media (max-width: 600px) {
    height: 34px;
    padding: 0 4px 0 10px;
    .label {
      display: none;
    }
    .stat {
      padding: 0 8px 0 0;
      border-left: 0;
    }
    .stat.node:not(.warn):not(.low) {
      display: none;
    }
    .dot {
      margin-right: 8px;
    }
  }
`;

const Breakdown = styled.div`
  width: 290px;
  max-width: 100%;
  box-sizing: border-box;
  padding: 12px 14px 8px;
  font-variant-numeric: tabular-nums;
  h4 {
    margin: 0 0 8px;
    font-size: 11.5px;
    font-weight: 650;
    letter-spacing: 0.05em;
    text-transform: uppercase;
    color: var(--muted);
  }
  .row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    gap: 12px;
    min-height: 34px;
    border-top: 1px solid var(--border);
    color: var(--text-2);
    white-space: nowrap;
    & > span {
      min-width: 0;
      text-align: right;
    }
    b {
      color: var(--text);
      font-weight: 600;
    }
    .unit {
      color: var(--muted);
      margin-left: 3px;
    }
    .full {
      display: block;
      font-size: 11px;
      color: var(--muted);
      text-align: right;
      overflow: hidden;
      text-overflow: ellipsis;
    }
    &.total b {
      color: var(--primary);
    }
  }
`;

const HelpButton = styled.button`
  display: flex;
  align-items: center;
  justify-content: center;
  flex: 0 0 32px;
  width: 32px;
  height: 32px;
  border: 0;
  border-radius: 8px;
  background: transparent;
  color: var(--muted);
  cursor: pointer;
  &:hover {
    background: var(--surface-hover);
    color: var(--text);
  }
  svg {
    width: 20px;
    height: 20px;
  }
  @media (max-width: 600px) {
    display: none;
  }
`;

/** Status and every balance with full precision, used in the popover and the mobile menu. */
export const WalletBreakdown = ({ style }: { style?: React.CSSProperties }) => {
  const { status, items } = useWallet();
  return (
    <Breakdown style={style}>
      <h4>Node wallet</h4>
      <div className="row">
        Connectivity <StatusPill status={status} />
      </div>
      {items.map((item) => (
        <div
          className={`row ${item.key}`}
          key={item.key}
        >
          {item.long}
          <span>
            <b>{item.value ? shrinkNumber(item.value) : '-'}</b>
            <span className="unit">{item.unit}</span>
            {item.value && item.value !== shrinkNumber(item.value) && <span className="full">{item.value}</span>}
          </span>
        </div>
      ))}
    </Breakdown>
  );
};

/**
 * Node status and the main balances in the header; a click opens the full
 * breakdown. The page FAQ opens from '?'.
 */
export default function InfoBar() {
  const nodeConnected = useAppSelector((store) => store.auth.status.connected);
  const { status, items } = useWallet();
  const currentRoute = useLocation().pathname;
  const [anchor, set_anchor] = useState<HTMLElement | null>(null);
  const [faqAnchor, set_faqAnchor] = useState<HTMLElement | null>(null);

  if (!nodeConnected) return null;

  const faq = nodeInfoData[currentRoute];

  return (
    <Bar className="InfoBar">
      <Chip
        onClick={(e) => set_anchor(e.currentTarget)}
        aria-label="Node wallet"
      >
        <span className={`dot ${status ?? ''}`} />
        {items.map((item) => (
          <span
            key={item.key}
            className={`stat ${item.key} ${item.level ?? ''}`}
          >
            <span className="label">{item.label}</span>
            <span>
              <span className="value">{item.value ? shrinkNumber(item.value) : '-'}</span>
              <span className="unit">{item.unit}</span>
            </span>
          </span>
        ))}
        <ExpandMoreIcon />
      </Chip>
      <Popover
        open={!!anchor}
        anchorEl={anchor}
        onClose={() => set_anchor(null)}
        anchorOrigin={{ vertical: 'bottom', horizontal: 'center' }}
        transformOrigin={{ vertical: 'top', horizontal: 'center' }}
        slotProps={{ paper: { style: { marginTop: 6, border: '1px solid var(--border-strong)' } } }}
        disableScrollLock
      >
        <WalletBreakdown />
      </Popover>
      {faq && (
        <>
          <HelpButton
            aria-label="Help for this page"
            onClick={(e) => set_faqAnchor(e.currentTarget)}
          >
            <HelpOutlineIcon />
          </HelpButton>
          <Popover
            open={!!faqAnchor}
            anchorEl={faqAnchor}
            onClose={() => set_faqAnchor(null)}
            anchorOrigin={{ vertical: 'bottom', horizontal: 'right' }}
            transformOrigin={{ vertical: 'top', horizontal: 'right' }}
            disableScrollLock
          >
            <FAQ
              data={faq}
              label={currentRoute.split('/')[currentRoute.split('/').length - 1]}
              variant="blue"
            />
          </Popover>
        </>
      )}
    </Bar>
  );
}
