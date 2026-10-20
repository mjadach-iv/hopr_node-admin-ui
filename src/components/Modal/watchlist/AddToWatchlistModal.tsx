import { useRef, useState } from 'react';
import { getAddress, isAddress } from 'viem';
import { useAppDispatch, useAppSelector } from '../../../store';
import { appActions } from '../../../store/slices/app';
import { selectBlokliUrl } from '../../../store/selectors/blokli';
import { api as blokliApi } from '../../../blokli';

// HOPR Components
import { SDialog, SDialogContent, SIconButton, TopBar } from '../../../future-hopr-lib-components/Modal/styled';
import IconButton from '../../../future-hopr-lib-components/Button/IconButton';
import Button from '../../../future-hopr-lib-components/Button';

// Mui
import { DialogTitle, DialogActions, TextField } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import AddCircleOutlineIcon from '@mui/icons-material/AddCircleOutline';

const NO_ANSWER = 'Blokli did not answer, try again';

type AddToWatchlistModalProps = {
  // a safe was entered, its nodes go to the picker
  onSafe: (safeAddress: string, nodes: string[]) => void;
};

/**
 * One field for a node or a safe address, blokli tells which one it is. A node is
 * watched right away, a safe hands its nodes over to the picker.
 */
export const AddToWatchlistModal = (props: AddToWatchlistModalProps) => {
  const dispatch = useAppDispatch();
  const blokliUrl = useAppSelector(selectBlokliUrl);
  const watchlist = useAppSelector((store) => store.app.watchlist);
  const [openModal, set_openModal] = useState(false);
  const [address, set_address] = useState('');
  const [lookupError, set_lookupError] = useState<string | null>(null);
  const [pending, set_pending] = useState(false);
  // closing or a new lookup drops the answer of the running one
  const lookupId = useRef(0);

  const trimmed = address.trim();
  const valid = isAddress(trimmed);
  const alreadyWatched = valid && watchlist.includes(getAddress(trimmed));
  const helperText =
    trimmed && !valid ? 'Not an address' : alreadyWatched ? 'This node is already watched' : lookupError ?? '';
  const canAdd = valid && !alreadyWatched && !pending && !!blokliUrl;

  const handleOpenModal = () => {
    (document.activeElement as HTMLInputElement).blur();
    set_openModal(true);
  };

  const handleCloseModal = () => {
    lookupId.current++;
    set_openModal(false);
    set_address('');
    set_lookupError(null);
    set_pending(false);
  };

  const handleAdd = async () => {
    if (!canAdd || !blokliUrl) return;
    const checksummed = getAddress(trimmed);
    const id = ++lookupId.current;
    set_pending(true);
    set_lookupError(null);
    try {
      const [{ safeByNode }, nodesBySafe] = await Promise.all([
        blokliApi.getNodesSafes({ blokliUrl, nodeAddresses: [checksummed] }),
        blokliApi.getSafesNodes({ blokliUrl, safeAddresses: [checksummed] }),
      ]);
      if (id !== lookupId.current) return;
      const safeNodes = nodesBySafe[checksummed];
      if (safeNodes?.length) {
        handleCloseModal();
        props.onSafe(checksummed, safeNodes);
      } else if (safeByNode[checksummed]) {
        dispatch(appActions.setWatched({ address: checksummed, watched: true }));
        handleCloseModal();
      } else {
        set_lookupError(
          safeByNode[checksummed] === null && safeNodes ? 'Blokli knows no node or safe at this address' : NO_ANSWER,
        );
        set_pending(false);
      }
    } catch (e) {
      if (id !== lookupId.current) return;
      console.warn('Blokli lookup of a watchlist address failed', e);
      set_lookupError(NO_ANSWER);
      set_pending(false);
    }
  };

  return (
    <>
      <IconButton
        iconComponent={<AddCircleOutlineIcon />}
        tooltipText={
          <span>
            ADD
            <br />a node or a safe
          </span>
        }
        onClick={handleOpenModal}
        disabled={!blokliUrl}
      />
      <SDialog
        open={openModal}
        onClose={handleCloseModal}
        disableScrollLock={true}
      >
        <TopBar>
          <DialogTitle>Add to the watchlist</DialogTitle>
          <SIconButton
            aria-label="close modal"
            onClick={handleCloseModal}
          >
            <CloseIcon />
          </SIconButton>
        </TopBar>
        <SDialogContent>
          <TextField
            type="text"
            name="address"
            label="Node or safe address"
            placeholder="0x154a...d6D9E7f3"
            onChange={(event) => {
              set_address(event.target.value);
              set_lookupError(null);
            }}
            onKeyDown={(event) => {
              if (event.key === 'Enter') handleAdd();
            }}
            value={address}
            error={!!helperText}
            helperText={helperText}
            style={{ minHeight: '79px' }}
            autoFocus
          />
        </SDialogContent>
        <DialogActions>
          <Button
            disabled={!canAdd}
            pending={pending}
            onClick={handleAdd}
            style={{
              marginRight: '16px',
              marginBottom: '6px',
              marginTop: '-6px',
            }}
          >
            Add
          </Button>
        </DialogActions>
      </SDialog>
    </>
  );
};
