import { useEffect, useState } from 'react';
import styled from '@emotion/styled';

// Mui
import Button from '@mui/material/Button';
import { DialogTitle } from '@mui/material';
import CloseIcon from '@mui/icons-material/Close';
import SystemUpdateAltIcon from '@mui/icons-material/SystemUpdateAlt';

// HOPR Components
import { SDialog, SDialogContent, SIconButton, TopBar } from '../../future-hopr-lib-components/Modal/styled';
import CodeCopyBox from '../Code/CodeCopyBox';

import { findNewerVersion, parseVersion } from '../../utils/version';
import packageJson from '../../../package.json';

const DOCKER_IMAGE = '0xmj/hopr-node-admin-ui';
const CONTAINER_NAME = 'hopr-node-admin-ui';
const GITHUB_TAGS_URL = 'https://api.github.com/repos/mjadach-iv/hopr_node-admin-ui/tags?per_page=100';
const CHECK_INTERVAL = 6 * 60 * 60 * 1000;
const FETCH_TIMEOUT = 10_000;

const Container = styled.div`
  height: 42px;
  display: flex;
  align-items: center;
  padding: 0 4px;
`;

const SButton = styled(Button)`
  color: var(--primary);
  text-transform: none;
  white-space: nowrap;
  @media (max-width: 600px) {
    min-width: 0;
    .label {
      display: none;
    }
    .MuiButton-startIcon {
      margin: 0;
    }
  }
`;

// version.txt is only written by the Docker build, everywhere else this falls back to index.html or 404s
const getContainerVersion = async (): Promise<string | null> => {
  const response = await fetch('/version.txt', { cache: 'no-store', signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!response.ok) return null;
  const version = (await response.text()).trim();
  return parseVersion(version) ? version : null;
};

// Close release tags the commit only after the image is pushed, so every tag has an image
const getReleasedVersions = async (): Promise<string[]> => {
  const response = await fetch(GITHUB_TAGS_URL, { signal: AbortSignal.timeout(FETCH_TIMEOUT) });
  if (!response.ok) return [];
  const tags = (await response.json()) as { name: string }[];
  return Array.isArray(tags) ? tags.map((tag) => tag.name) : [];
};

/**
 * Header item shown when a newer Docker image than the running container is
 * released. Opens a dialog with the commands to replace the container.
 */
export default function UpdateAvailable() {
  const [versions, set_versions] = useState<{ current: string; latest: string } | null>(null);
  const [openModal, set_openModal] = useState(false);

  useEffect(() => {
    let cancelled = false;
    const check = async () => {
      try {
        // the dev server has no version.txt, so it compares the package.json version instead
        const current = (await getContainerVersion()) ?? (import.meta.env.DEV ? packageJson.version : null);
        if (!current) return;
        const latest = findNewerVersion(current, await getReleasedVersions());
        if (!cancelled) set_versions(latest ? { current, latest } : null);
      } catch {
        // offline or rate limited, try again on the next check
      }
    };
    check();
    const interval = setInterval(check, CHECK_INTERVAL);
    return () => {
      cancelled = true;
      clearInterval(interval);
    };
  }, []);

  if (!versions) return null;

  const commands = [
    `docker rm -f ${CONTAINER_NAME}`,
    `docker run -d --name ${CONTAINER_NAME} -p 4677:4677 ${DOCKER_IMAGE}:${versions.latest}`,
  ].join('\n');

  return (
    <Container>
      <SButton
        size="small"
        startIcon={<SystemUpdateAltIcon />}
        onClick={() => set_openModal(true)}
        title={`Version ${versions.latest} is available`}
      >
        <span className="label">Update available</span>
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
            Version {versions.latest} is available, you are running {versions.current}. Run these commands on the
            machine that hosts the container:
          </span>
          <CodeCopyBox
            code={commands}
            breakSpaces
          />
        </SDialogContent>
      </SDialog>
    </Container>
  );
}
