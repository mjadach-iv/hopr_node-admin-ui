import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { useAppDispatch, useAppSelector } from '../../../store';
import { appActions } from '../../../store/slices/app';

// HOPR Components
import { SDialog, SDialogContent, SIconButton, TopBar } from '../../../future-hopr-lib-components/Modal/styled';
import Button from '../../../future-hopr-lib-components/Button';
import PeersInfo from '../../../future-hopr-lib-components/PeerInfo';

// Mui
import { DialogTitle, DialogActions } from '@mui/material';
import MuiCheckbox from '@mui/material/Checkbox';
import CloseIcon from '@mui/icons-material/Close';

const Safe = styled.div`
  font-family: var(--font-mono);
  font-size: 12.5px;
  color: var(--text-2);
  overflow-wrap: anywhere;
`;

const ROW_HEIGHT = 32;
const ROWS_WITHOUT_SCROLL = 10;

const Nodes = styled.ul`
  list-style: none;
  margin: 0;
  padding: 0 8px 0 0;
  max-height: ${ROW_HEIGHT * ROWS_WITHOUT_SCROLL}px;
  overflow-x: hidden;
  overflow-y: auto;
  &::-webkit-scrollbar {
    width: 8px;
  }
  &::-webkit-scrollbar-track {
    background: var(--primary-soft);
    border-radius: 4px;
  }
  &::-webkit-scrollbar-thumb {
    background: var(--hopr-yellow);
    border-radius: 4px;
  }
  /* Chrome ignores the rounded ::-webkit-scrollbar style once these are set */
  @supports not selector(::-webkit-scrollbar) {
    scrollbar-width: thin;
    scrollbar-color: var(--hopr-yellow) var(--primary-soft);
  }
  li {
    display: flex;
    align-items: center;
    gap: 4px;
    height: ${ROW_HEIGHT}px;
  }
`;

const Hint = styled.p`
  margin: 0;
  color: var(--muted);
  font-size: 14px;
`;

type SafeNodesModalProps = {
  safeAddress: string | null;
  // every node blokli lists for the safe, undefined when it did not answer
  nodes?: string[];
  // the watched nodes of the safe, listed even when blokli no longer knows them
  watchedNodes: string[];
  // ticked on open on top of the watched ones, e.g. every node of a safe just added
  preselect?: string[];
  onClose: () => void;
};

/**
 * Picker of the nodes of one safe to watch. The boxes mirror the watchlist until
 * Apply, so the group under the dialog stays put while picking.
 */
export const SafeNodesModal = (props: SafeNodesModalProps) => {
  const dispatch = useAppDispatch();
  const watchlist = useAppSelector((store) => store.app.watchlist);
  const [selected, set_selected] = useState<Set<string>>(new Set());
  // snapshot taken on open, so the list stays put while the dialog fades out
  const [shown, set_shown] = useState<Pick<SafeNodesModalProps, 'safeAddress' | 'nodes'> & { all: string[] }>({
    safeAddress: null,
    all: [],
  });
  const watched = new Set(watchlist);
  const nodes = shown.all;

  useEffect(() => {
    if (!props.safeAddress) return;
    const all = Array.from(new Set([...(props.nodes ?? []), ...props.watchedNodes])).sort();
    set_shown({ safeAddress: props.safeAddress, nodes: props.nodes, all });
    const preselected = new Set(props.preselect);
    set_selected(new Set(all.filter((address) => watched.has(address) || preselected.has(address))));
  }, [props.safeAddress]);

  const changes = Object.fromEntries(
    nodes.flatMap((address) =>
      selected.has(address) !== watched.has(address) ? [[address, selected.has(address)]] : [],
    ),
  );
  const changed = Object.keys(changes).length > 0;

  const toggle = (address: string, value: boolean) =>
    set_selected((previous) => {
      const next = new Set(previous);
      if (value) next.add(address);
      else next.delete(address);
      return next;
    });

  const handleApply = () => {
    dispatch(appActions.setWatchedMany(changes));
    props.onClose();
  };

  return (
    <SDialog
      open={!!props.safeAddress}
      onClose={props.onClose}
      disableScrollLock={true}
      maxWidth="560px"
    >
      <TopBar>
        <DialogTitle>Nodes of the safe</DialogTitle>
        <SIconButton
          aria-label="close modal"
          onClick={props.onClose}
        >
          <CloseIcon />
        </SIconButton>
      </TopBar>
      <SDialogContent>
        <Safe>{shown.safeAddress}</Safe>
        {shown.nodes === undefined ? (
          <Hint>Blokli did not answer for this safe, only the watched nodes are listed.</Hint>
        ) : shown.nodes.length === 0 ? (
          <Hint>Blokli knows no node registered to this safe.</Hint>
        ) : (
          <Hint>Tick the nodes to watch, untick the ones to drop from the watchlist.</Hint>
        )}
        <Nodes>
          {nodes.map((address) => (
            <li key={address}>
              <MuiCheckbox
                size="small"
                checked={selected.has(address)}
                onChange={(event) => toggle(address, event.target.checked)}
                inputProps={{ 'aria-label': `Watch ${address}` }}
                sx={{ p: '2px', color: 'var(--muted)', '&.Mui-checked': { color: 'var(--primary)' } }}
              />
              <PeersInfo
                peerAddress={address}
                shortAddress
              />
            </li>
          ))}
        </Nodes>
      </SDialogContent>
      <DialogActions>
        <Button
          disabled={!changed}
          onClick={handleApply}
          style={{ marginRight: '16px', marginBottom: '6px', marginTop: '-6px' }}
        >
          Apply
        </Button>
      </DialogActions>
    </SDialog>
  );
};
