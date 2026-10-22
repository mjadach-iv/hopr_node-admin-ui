import { useEffect, useRef, useState } from 'react';
import styled from '@emotion/styled';
import { useAppDispatch, useAppSelector } from '../../store';
import { selectBlokliUrl } from '../../store/selectors/blokli';
import { watchlistActionsAsync } from '../../store/slices/watchlist';
import { appActions } from '../../store/slices/app';
import { formatEther } from 'viem';
import type { SafeChannelStatsType, SafeNodeType } from '../../blokli';
import { shrinkNumber } from '../../utils/amount';
import { exportToCsv } from '../../utils/helpers';
import { parseWatchlistFile } from '../../utils/watchlist';
import { sendNotification } from '../../hooks/useWatcher/notifications';

// HOPR Components
import Section from '../../future-hopr-lib-components/Section';
import { SubpageTitle } from '../../components/SubpageTitle';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';
import { NodesTable } from '../../components/NodesTable';
import { BreakdownTooltip } from '../../components/InfoBar';
import { AddressLinks, SafeWalletLink } from '../node/info/ui';
import { SafeNodesModal } from '../../components/Modal/watchlist/SafeNodesModal';
import { AddToWatchlistModal } from '../../components/Modal/watchlist/AddToWatchlistModal';

// Mui
import Button from '@mui/material/Button';
import DnsIcon from '@mui/icons-material/Dns';
import GetAppIcon from '@mui/icons-material/GetApp';
import DriveFolderUploadIcon from '@mui/icons-material/DriveFolderUpload';

const NO_SAFE = 'none';
const UNKNOWN_SAFE = 'unknown';

const Empty = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 96px 16px;
  text-align: center;
  h3 {
    margin: 0;
    color: var(--text);
    font-size: clamp(28px, 6vw, 48px);
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  p {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
`;

// styled like the table header, it heads the nodes of one safe. The links and the
// count wrap under the address when the column is too narrow for one line
const GroupHeader = styled.div`
  display: flex;
  flex-wrap: wrap;
  align-items: center;
  gap: 2px 6px;
  min-width: 0;
  white-space: nowrap;
  .safe {
    display: inline-flex;
    align-items: center;
    gap: 6px;
    min-width: 0;
  }
  @container (max-width: 600px) {
    .address {
      overflow-wrap: anywhere;
      white-space: normal;
    }
  }
  .label {
    color: var(--muted);
    font-size: 11.5px;
    font-weight: 600;
    letter-spacing: 0.04em;
    text-transform: uppercase;
  }
  .address {
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--text);
  }
  .links {
    display: inline-flex;
    align-items: center;
    svg {
      width: 15px;
      height: 15px;
      color: var(--muted);
    }
  }
  .count {
    color: var(--muted);
    font-size: 12px;
  }
`;

// 'watched/all nodes' of the safe, opens the picker of its nodes
const NodesButton = styled(Button)`
  color: var(--muted);
  font-size: 12px;
  font-weight: 400;
  line-height: 1.5;
  text-transform: none;
  white-space: nowrap;
  min-width: 0;
  padding: 0 6px;
  .MuiButton-startIcon {
    margin-right: 4px;
    svg {
      font-size: 16px;
    }
  }
  &:hover {
    color: var(--primary);
  }
`;

// 'in safe / total' wxHOPR, the total counting every node of the safe like Total staked on SAFE INFO
const SafeBalance = ({ funds }: { funds?: SafeChannelStatsType }) => {
  const inSafe = funds?.safeBalance;
  if (!funds || !inSafe) return <>-</>;
  const total = formatEther(BigInt(inSafe.value) + BigInt(funds.value) + BigInt(funds.closing?.value ?? 0));
  return (
    <BreakdownTooltip
      title="Safe"
      items={[
        { key: 'safe', label: 'Balance', long: 'Balance', value: inSafe.formatted, unit: 'wxHOPR' },
        { key: 'total', label: 'Total balance', long: 'Total balance', value: total, unit: 'wxHOPR' },
      ]}
    >
      <span>
        {`${shrinkNumber(inSafe.formatted)} / ${shrinkNumber(total)}`}
        <span className="unit">wxHOPR</span>
      </span>
    </BreakdownTooltip>
  );
};

const noFigures = (nodeAddress: string): SafeNodeType => ({
  nodeAddress,
  xDai: null,
  channels: null,
  redeemed: null,
  spent: null,
  rpcBroken: false,
});

/**
 * Nodes picked on SAFE → NODES, grouped by the safe they are registered to. Every
 * figure comes from blokli, the Gnosis RPCs and the network dashboard, so the page
 * works without a connected node.
 */
function WatchlistPage() {
  const dispatch = useAppDispatch();
  const watchlist = useAppSelector((store) => store.app.watchlist);
  const blokliUrl = useAppSelector(selectBlokliUrl);
  const rpcUrls = useAppSelector((store) => store.app.configuration.rpc.urls);
  const connected = useAppSelector((store) => store.auth.status.connected);
  const data = useAppSelector((store) => store.watchlist.data);
  const isFetching = useAppSelector((store) => store.watchlist.isFetching);
  const [safeInModal, set_safeInModal] = useState<string | null>(null);
  // a safe entered in the add dialog, its nodes are not in the watchlist data yet
  const [addedSafe, set_addedSafe] = useState<{ safeAddress: string; nodes: string[] } | null>(null);
  const added = addedSafe && addedSafe.safeAddress === safeInModal ? addedSafe : null;
  const fileInputRef = useRef<HTMLInputElement>(null);
  const watchlistKey = watchlist.join(',');
  const rpcUrlsKey = rpcUrls.join(',');

  const fetchWatchlist = () => {
    if (!blokliUrl || watchlist.length === 0) return;
    dispatch(watchlistActionsAsync.getWatchlistThunk({ blokliUrl, rpcUrls, nodeAddresses: watchlist }));
  };

  // logging in or out aborts every running request, the watchlist one included
  useEffect(() => {
    fetchWatchlist();
    const watchlistInterval = setInterval(fetchWatchlist, 60_000);
    return () => {
      clearInterval(watchlistInterval);
    };
  }, [blokliUrl, rpcUrlsKey, watchlistKey, connected]);

  const handleExport = () => {
    exportToCsv(
      watchlist.map((node) => ({ node })),
      'watchlist.csv',
    );
  };

  // imported nodes are added, the ones already watched stay
  const handleImport = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    event.target.value = '';
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const imported = typeof reader.result === 'string' ? parseWatchlistFile(reader.result) : [];
      const added = imported.filter((address) => !watchlist.includes(address));
      if (added.length)
        dispatch(appActions.setWatchedMany(Object.fromEntries(added.map((address) => [address, true]))));
      const msg = imported.length
        ? `Watchlist import: ${added.length} ${added.length === 1 ? 'node' : 'nodes'} added, ${
            imported.length - added.length
          } already watched`
        : 'Watchlist import: no address found in the file';
      sendNotification({
        notificationPayload: { source: 'node', name: msg, url: null, timeout: null },
        toastPayload: { message: msg, type: imported.length ? 'success' : 'error' },
        dispatch,
      });
    };
    reader.readAsText(file);
  };

  const loading = data === null && isFetching;
  const nodes = loading ? [] : watchlist.map((address) => data?.figuresByNode[address] ?? noFigures(address));

  // a node just picked in the dialog is known from its safe's node list until the next fetch
  const safeByListedNode = new Map(
    Object.entries(data?.nodesBySafe ?? {}).flatMap(([safe, nodes]) => nodes.map((node) => [node, safe] as const)),
  );
  const safeOf = (address: string) => {
    const safe = data?.safeByNode[address];
    return safe === undefined ? safeByListedNode.get(address) : safe;
  };

  const groupOf = (address: string) => {
    const safe = safeOf(address);
    return safe ? safe : safe === null ? NO_SAFE : UNKNOWN_SAFE;
  };

  const watchedNodesOf = (safeAddress: string) => watchlist.filter((address) => safeOf(address) === safeAddress);

  const renderGroupHeader = (groupId: string, rowCount: number) => {
    if (groupId === NO_SAFE || groupId === UNKNOWN_SAFE) {
      return {
        label: (
          <GroupHeader>
            <span className="label">
              {groupId === NO_SAFE
                ? 'Not registered to a safe'
                : isFetching
                ? 'Looking up the safe'
                : 'Safe unknown, blokli did not answer'}
            </span>
            <span className="count">{`${rowCount} ${rowCount === 1 ? 'node' : 'nodes'}`}</span>
          </GroupHeader>
        ),
      };
    }
    const watchedNodes = watchedNodesOf(groupId);
    const safeNodes = data?.nodesBySafe[groupId];
    const watched = watchedNodes.length;
    const all = safeNodes?.length;
    return {
      label: (
        <GroupHeader>
          <span className="safe">
            <span className="links">
              <SafeWalletLink safeAddress={groupId} />
            </span>
            <span className="address">{groupId}</span>
          </span>
          <span className="links">
            <AddressLinks address={groupId} />
          </span>
        </GroupHeader>
      ),
      balance: <SafeBalance funds={data?.safeFunds[groupId]} />,
      actions: (
        <NodesButton
          size="small"
          startIcon={<DnsIcon />}
          onClick={() => set_safeInModal(groupId)}
          title="Pick the nodes of this safe to watch"
        >
          {all === undefined ? `${watched} ${watched === 1 ? 'node' : 'nodes'}` : `${watched}/${all} nodes`}
        </NodesButton>
      ),
      // the whole safe, watched or not, unknown while blokli did not list its nodes
      sumOver: safeNodes
        ? Array.from(new Set([...safeNodes, ...watchedNodes])).map(
            (address) => data?.figuresByNode[address] ?? noFigures(address),
          )
        : null,
    };
  };

  return (
    <Section
      className="Section--watchlist"
      id="Section--watchlist"
      fullHeightMin
      yellow
    >
      <SubpageTitle
        title={`WATCHLIST (${watchlist.length})`}
        refreshFunction={watchlist.length ? fetchWatchlist : undefined}
        reloading={isFetching}
        actions={
          <>
            <AddToWatchlistModal
              onSafe={(safeAddress, nodes) => {
                set_addedSafe({ safeAddress, nodes });
                set_safeInModal(safeAddress);
              }}
            />
            <IconButton
              iconComponent={<DriveFolderUploadIcon />}
              tooltipText={
                <span>
                  IMPORT
                  <br />
                  nodes from a CSV
                </span>
              }
              onClick={() => fileInputRef.current?.click()}
            />
            <IconButton
              iconComponent={<GetAppIcon />}
              tooltipText={
                <span>
                  EXPORT
                  <br />
                  the watchlist as a CSV
                </span>
              }
              disabled={watchlist.length === 0}
              onClick={handleExport}
            />
            <input
              type="file"
              accept=".csv,.txt"
              style={{ display: 'none' }}
              ref={fileInputRef}
              onChange={handleImport}
            />
          </>
        }
      />
      {watchlist.length === 0 ? (
        <Empty>
          <h3>Nothing watched yet</h3>
          <p>
            Add a node or a safe with +, or tick the box next to a node on SAFE → NODES, with or without a node
            connected.
          </p>
        </Empty>
      ) : (
        <NodesTable
          id="watchlist-table"
          nodes={nodes}
          stats={data?.stats}
          loading={loading}
          removable
          groupOf={groupOf}
          renderGroupHeader={renderGroupHeader}
        />
      )}
      <SafeNodesModal
        safeAddress={safeInModal}
        nodes={safeInModal ? added?.nodes ?? data?.nodesBySafe[safeInModal] : undefined}
        watchedNodes={safeInModal ? watchedNodesOf(safeInModal) : []}
        preselect={added?.nodes}
        onClose={() => {
          set_safeInModal(null);
          set_addedSafe(null);
        }}
      />
    </Section>
  );
}

export default WatchlistPage;
