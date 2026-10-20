import { useEffect, useLayoutEffect, useRef, useState } from 'react';
import { useSearchParams } from 'react-router-dom';
import styled from '@emotion/styled';
import SafeAppsSDK, { type SafeInfo } from '@safe-global/safe-apps-sdk';
import { encodeFunctionData, erc20Abi, getAddress, isAddress, maxUint256, parseEther } from 'viem';
import { useAppSelector } from '../../store';
import { selectBlokliUrl } from '../../store/selectors/blokli';
import { api as blokliApi, type SafeAllowanceType } from '../../blokli';
import { safeAppLink } from '../../utils/safeApp';
import { short } from '../node/info/ui';

// HOPR Components
import Button from '../../future-hopr-lib-components/Button';
import { MaxButton } from '../../components/Modal/node/WithdrawModal';

// Mui
import CircularProgress from '@mui/material/CircularProgress';
import InputAdornment from '@mui/material/InputAdornment';
import TextField from '@mui/material/TextField';

const GNOSIS_CHAIN_ID = 100;
const DEFAULT_ALLOWANCE = '100000';
const UNLIMITED = 'Unlimited';

// origins are matched in full, scheme included
const sdk = new SafeAppsSDK({ allowedDomains: [/^https:\/\/app\.safe\.global$/] });

// outside Safe{Wallet} getInfo never answers
const getSafeInfo = async (timeoutMs = 1500): Promise<SafeInfo | null> => {
  if (window.parent === window) return null;
  const timeout = new Promise<null>((resolve) => setTimeout(() => resolve(null), timeoutMs));
  return Promise.race([sdk.safe.getInfo(), timeout]);
};

// 1000000.5 -> 1 000 000.5, the field only shows the spaces
const groupDigits = (amount: string) => {
  if (amount === UNLIMITED) return amount;
  const [integer, ...fraction] = amount.split('.');
  return [integer.replace(/\B(?=(\d{3})+(?!\d))/g, ' '), ...fraction].join('.');
};

const parseAmount = (amount: string) => {
  if (amount === UNLIMITED) return maxUint256;
  // parseEther reads an empty field as 0
  if (!amount.trim()) return null;
  try {
    return parseEther(amount.trim());
  } catch (e) {
    return null;
  }
};

const Page = styled.div`
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

const AmountField = styled(TextField)`
  width: min(100%, 520px);
  input {
    font-size: clamp(24px, 5vw, 36px);
    font-weight: 650;
    text-align: right;
    font-variant-numeric: tabular-nums;
  }
  .unit {
    margin-right: 12px;
    color: var(--muted);
    font-size: 16px;
  }
`;

/**
 * Sets the Safe's wxHOPR allowance to the channels contract. Opened as a custom
 * Safe App inside Safe{Wallet}, which takes the approve straight to its sign dialog.
 */
function SafeAppAllowancePage() {
  const blokliUrl = useAppSelector(selectBlokliUrl);
  const [searchParams] = useSearchParams();
  // undefined while detecting, null outside Safe{Wallet}
  const [safe, set_safe] = useState<SafeInfo | null | undefined>(undefined);
  const [contracts, set_contracts] = useState<SafeAllowanceType | null>(null);
  const contractsRequest = useRef<Promise<SafeAllowanceType | null> | null>(null);
  const [blokliFailed, set_blokliFailed] = useState(false);
  const [amount, set_amount] = useState(DEFAULT_ALLOWANCE);
  const amountInput = useRef<HTMLInputElement>(null);
  // characters before the caret, spaces not counted, so regrouping does not move it
  const caret = useRef<number | null>(null);
  const [pending, set_pending] = useState(false);
  const [sentHash, set_sentHash] = useState<string | null>(null);
  const [sendError, set_sendError] = useState<string | null>(null);

  const parsedAmount = parseAmount(amount);
  // 0 revokes the allowance
  const validAmount = parsedAmount !== null && parsedAmount >= BigInt(0) && parsedAmount <= maxUint256;

  useEffect(() => {
    getSafeInfo().then(set_safe);
  }, []);

  useLayoutEffect(() => {
    const input = amountInput.current;
    if (!input || caret.current === null) return;
    let position = 0;
    for (let seen = 0; position < input.value.length && seen < caret.current; position++) {
      if (input.value[position] !== ' ') seen++;
    }
    input.setSelectionRange(position, position);
    caret.current = null;
  }, [amount]);

  const fetchAllowance = () => {
    if (!safe || !blokliUrl) return;
    set_blokliFailed(false);
    contractsRequest.current = blokliApi
      .getSafeAllowance({ blokliUrl, safeAddress: safe.safeAddress })
      .then((result) => {
        set_contracts(result);
        return result;
      })
      .catch((e) => {
        console.warn('Blokli allowance request failed', e);
        set_blokliFailed(true);
        return null;
      });
  };

  useEffect(fetchAllowance, [safe?.safeAddress, blokliUrl]);

  const handleSign = async () => {
    if (parsedAmount === null || !validAmount) return;
    set_pending(true);
    set_sentHash(null);
    set_sendError(null);
    try {
      // blokli may still be on its way, Sign works from the start and waits here
      const known = contracts ?? (await contractsRequest.current);
      if (!known) return;
      const { safeTxHash } = await sdk.txs.send({
        txs: [
          {
            to: known.token,
            value: '0',
            data: encodeFunctionData({
              abi: erc20Abi,
              functionName: 'approve',
              args: [known.channels, parsedAmount],
            }),
          },
        ],
      });
      set_sentHash(safeTxHash);
    } catch (e) {
      set_sendError(e instanceof Error ? e.message : 'Safe{Wallet} did not take the transaction');
    } finally {
      set_pending(false);
    }
  };

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
        <h1>Set the allowance</h1>
        <p className="hint">
          This page runs inside Safe{'{Wallet}'}, where the owners of the Safe sign the transaction.
        </p>
        {safeParam && isAddress(safeParam) && (
          <Button href={safeAppLink(getAddress(safeParam))}>Open in Safe{'{Wallet}'}</Button>
        )}
      </Page>
    );
  }

  if (safe.chainId !== GNOSIS_CHAIN_ID) {
    return (
      <Page>
        <h1>Set the allowance</h1>
        <p className="hint">HOPR runs on Gnosis Chain, switch Safe{'{Wallet}'} to it.</p>
      </Page>
    );
  }

  return (
    <Page>
      <span className="safe">{safe.safeAddress}</span>
      <h1>Set the allowance to</h1>
      <AmountField
        value={groupDigits(amount)}
        inputRef={amountInput}
        onChange={(event) => {
          const { value, selectionStart } = event.target as HTMLInputElement;
          caret.current = value.slice(0, selectionStart ?? value.length).replace(/\s/g, '').length;
          set_amount(value.replace(/\s/g, ''));
          set_sentHash(null);
        }}
        onFocus={(event) => {
          if (amount === UNLIMITED) (event.target as HTMLInputElement).select();
        }}
        error={!validAmount}
        helperText={validAmount ? ' ' : 'Enter an amount, 0 or more'}
        inputProps={{ inputMode: 'decimal', 'aria-label': 'Allowance in wxHOPR' }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <span className="unit">wxHOPR</span>
              <MaxButton
                onClick={() => {
                  set_amount(UNLIMITED);
                  set_sentHash(null);
                }}
              >
                Max
              </MaxButton>
            </InputAdornment>
          ),
        }}
      />
      <p className="hint">
        {blokliFailed ? (
          <span className="error">
            Blokli did not answer, so the wxHOPR and channels contracts are unknown.{' '}
            <button
              className="retry"
              onClick={fetchAllowance}
            >
              Retry
            </button>
          </span>
        ) : (
          <>
            {`The allowance is now ${short(contracts?.allowance?.formatted)} wxHOPR.`}
            <br />
            Approve sets the allowance to the amount from the input.
          </>
        )}
      </p>
      <Button
        size70
        standardWidth
        pending={pending}
        disabled={!validAmount || blokliFailed}
        onClick={handleSign}
      >
        Sign
      </Button>
      {sentHash && (
        <p className="hint sent">
          Sent to Safe{'{Wallet}'}, confirm and execute it there.
          <br />
          <span className="hash">{sentHash}</span>
        </p>
      )}
      {sendError && <p className="hint error">{sendError}</p>}
    </Page>
  );
}

export default SafeAppAllowancePage;
