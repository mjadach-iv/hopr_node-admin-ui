import { useEffect, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from '@emotion/styled';
import SafeAppsSDK, { type SafeInfoExtended } from '@safe-global/safe-apps-sdk';
import { getAddress, isAddress } from 'viem';
import { useAppSelector } from '../../store';
import { aliasOf } from '../../utils/aliases';
import { safeAppLink, type SafeAppName } from '../../utils/safeApp';

// HOPR Components
import Button from '../../future-hopr-lib-components/Button';

// Mui
import CircularProgress from '@mui/material/CircularProgress';

const GNOSIS_CHAIN_ID = 100;

// origins are matched in full, scheme included
export const sdk = new SafeAppsSDK({ allowedDomains: [/^https:\/\/app\.safe\.global$/] });

// outside Safe{Wallet} getInfo never answers
const getSafeInfo = async (timeoutMs = 1500): Promise<SafeInfoExtended | null> => {
  if (window.parent === window) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([sdk.safe.getInfo(), timeout]);
};

/** The Safe the page runs in: undefined while detecting, null outside Safe{Wallet}. */
export const useSafeInfo = () => {
  const [safe, set_safe] = useState<SafeInfoExtended | null | undefined>(undefined);
  useEffect(() => {
    getSafeInfo().then(set_safe);
  }, []);
  return safe;
};

export const isReady = (safe: SafeInfoExtended | null | undefined): safe is SafeInfoExtended =>
  !!safe && safe.chainId === GNOSIS_CHAIN_ID;

/** The safe the app runs in, its alias in front like a node's. */
export const SafeName = ({ address }: { address: string }) => {
  const alias = useAppSelector((store) => aliasOf(store.app.aliases, address));
  return (
    <span className="safe">
      {alias && <span className="alias">{alias}</span>}
      {address}
    </span>
  );
};

export const Page = styled.div`
  min-height: 100vh;
  box-sizing: border-box;
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 20px;
  padding: 32px 16px;
  text-align: center;
  h1 {
    margin: 0;
    color: var(--text);
    font-size: clamp(28px, 6vw, 48px);
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  .safe {
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--muted);
    overflow-wrap: anywhere;
    .alias {
      margin-right: 6px;
      font-family: var(--font-sans);
      font-weight: 600;
      color: var(--text);
    }
  }
  .hint {
    margin: 0;
    max-width: 520px;
    color: var(--muted);
    font-size: 14px;
  }
  .error {
    color: var(--red);
  }
  .sent {
    color: var(--green);
  }
  .hash {
    font-family: var(--font-mono);
    font-size: 12px;
    overflow-wrap: anywhere;
  }
  .retry {
    padding: 0;
    border: 0;
    background: none;
    color: var(--primary);
    font: inherit;
    text-decoration: underline;
    cursor: pointer;
  }
`;

/**
 * What a Safe App page shows until it runs in Safe{Wallet} on Gnosis Chain. Outside
 * Safe{Wallet} a ?safe= parameter offers to open the page there.
 */
export const SafeAppGate = ({
  safe,
  title,
  app,
}: {
  safe: SafeInfoExtended | null | undefined;
  title: string;
  app: SafeAppName;
}) => {
  const [searchParams] = useSearchParams();

  if (safe === undefined) {
    return (
      <Page>
        <CircularProgress />
      </Page>
    );
  }

  if (safe === null) {
    const safeParam = searchParams.get('safe');
    return (
      <Page>
        <h1>{title}</h1>
        <p className="hint">
          This page runs inside Safe{'{Wallet}'}, where the owners of the Safe sign the transaction.
        </p>
        {safeParam && isAddress(safeParam) && (
          <Button href={safeAppLink(getAddress(safeParam), app)}>Open in Safe{'{Wallet}'}</Button>
        )}
      </Page>
    );
  }

  return (
    <Page>
      <h1>{title}</h1>
      <p className="hint">HOPR runs on Gnosis Chain, switch Safe{'{Wallet}'} to it.</p>
    </Page>
  );
};
