import { useEffect, useState } from 'react';
import styled from '@emotion/styled';

// Mui
import { DialogTitle } from '@mui/material';
import LinearProgress from '@mui/material/LinearProgress';
import CloseIcon from '@mui/icons-material/Close';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';

// HOPR Components
import { SDialog, SDialogContent, SIconButton, TopBar } from '../../future-hopr-lib-components/Modal/styled';
import Button from '../../future-hopr-lib-components/Button';
import { Container, SButton } from './styled';

import { desktop } from '../../utils/desktop';
import type { UpdateState } from '../../../electron/shared';

const Actions = styled.div`
  display: flex;
  justify-content: flex-end;
  margin-top: 16px;
`;

const Progress = styled.div`
  margin-top: 16px;
  display: flex;
  align-items: center;
  gap: 12px;
  .MuiLinearProgress-root {
    flex: 1;
  }
`;

const buttonLabel = (state: UpdateState) => {
  if (state.status === 'ready') return 'Restart to update';
  if (state.status === 'downloading') return `Downloading update ${state.percent}%`;
  return 'Update available';
};

/**
 * Header item of the desktop app, driven by electron-updater in the main process (electron/updater.ts).
 * Updates download in the background, the dialog restarts the app into the new version. Unsigned
 * macOS builds cannot install updates, there the dialog links to the GitHub release instead.
 */
export default function DesktopUpdate() {
  const [state, set_state] = useState<UpdateState>({ status: 'idle' });
  const [openModal, set_openModal] = useState(false);

  useEffect(() => {
    if (!desktop) return;
    let cancelled = false;
    const unsubscribe = desktop.updates.onState((next) => set_state(next));
    desktop.updates.getState().then((current) => !cancelled && set_state(current));
    return () => {
      cancelled = true;
      unsubscribe();
    };
  }, []);

  if (!desktop || !('version' in state)) return null;

  return (
    <Container>
      <SButton
        size="small"
        startIcon={<SystemUpdateAltIcon />}
        onClick={() => set_openModal(true)}
        title={`Version ${state.version} is available`}
      >
        <span className="label">{buttonLabel(state)}</span>
      </SButton>
      <SDialog
        open={openModal}
        onClose={() => set_openModal(false)}
        disableScrollLock={true}
        maxWidth="720px"
      >
        <TopBar>
          <DialogTitle>Update available</DialogTitle>
          <SIconButton
            aria-label="close modal"
            onClick={() => set_openModal(false)}
          >
            <CloseIcon />
          </SIconButton>
        </TopBar>
        <SDialogContent>
          <span>
            Version {state.version} is available, you are running {desktop.version}.{' '}
            {state.status === 'ready' && 'It is downloaded and installs when the app restarts.'}
            {state.status === 'downloading' && 'It is downloading, you can keep working meanwhile.'}
            {state.status === 'available' &&
              'This build cannot update itself, download the new version from GitHub and replace the app with it.'}
          </span>
          {state.status === 'downloading' && (
            <Progress>
              <LinearProgress
                variant="determinate"
                value={state.percent}
              />
              <span>{state.percent}%</span>
            </Progress>
          )}
          <Actions>
            {state.status === 'ready' && <Button onClick={() => desktop?.updates.install()}>Restart to update</Button>}
            {state.status === 'available' && (
              <Button onClick={() => desktop?.updates.openReleasePage()}>Download from GitHub</Button>
            )}
          </Actions>
        </SDialogContent>
      </SDialog>
    </Container>
  );
}
