import { useEffect, useState } from 'react';
import styled from '@emotion/styled';
import { encodeFunctionData, getAddress, isAddress, type Address } from 'viem';
import { findHoprModule, isNode, MODULE_ABI } from './module';
import { isReady, Page, SafeAppGate, SafeName, sdk, useSafeInfo } from './shared';

// HOPR Components
import Button from '../../future-hopr-lib-components/Button';

// Mui
import TextField from '@mui/material/TextField';

// appended to the node address to make its default target, every capability left to the module's
// defaults; DEFAULT_NODE_PERMISSIONS of hoprnet/contracts' bindings, as `hopli safe-module add-node` sends it
const DEFAULT_NODE_PERMISSIONS = '010303000000000000000000';

const nodeDefaultTarget = (nodeAddress: Address) => BigInt(`${nodeAddress}${DEFAULT_NODE_PERMISSIONS}`);

const AddressField = styled(TextField)`
  width: min(100%, 520px);
  input {
    font-family: var(--font-mono);
    font-size: clamp(14px, 3vw, 18px);
    text-align: center;
  }
`;

/**
 * Adds a node to the Safe: includes it in the Safe's node management module with the default
 * permissions, the transaction `hopli safe-module add-node` sends. Opened as a custom Safe App
 * inside Safe{Wallet}, which takes it straight to its sign dialog. The node registers itself
 * with the Safe on the node-safe registry when it starts.
 */
function SafeAppAddNodePage() {
  const safe = useSafeInfo();
  // undefined while looking, null when the Safe has none
  const [module, set_module] = useState<Address | null | undefined>(undefined);
  const [nodeInput, set_nodeInput] = useState('');
  // whether the module has the node already, undefined until it answers
  const [included, set_included] = useState<boolean | undefined>(undefined);
  const [pending, set_pending] = useState(false);
  const [sentHash, set_sentHash] = useState<string | null>(null);
  const [sendError, set_sendError] = useState<string | null>(null);

  const node = isAddress(nodeInput.trim()) ? getAddress(nodeInput.trim()) : null;

  const findModule = () => {
    if (!isReady(safe)) return;
    set_module(undefined);
    findHoprModule(safe).then(set_module);
  };

  useEffect(findModule, [safe]);

  useEffect(() => {
    set_included(undefined);
    if (!module || !node) return;
    let current = true;
    isNode(module, node)
      .then((result) => current && set_included(result))
      // unknown, Safe{Wallet} shows a failing transaction before it is signed
      .catch(() => current && set_included(false));
    return () => {
      current = false;
    };
  }, [module, node]);

  const handleSign = async () => {
    if (!module || !node) return;
    set_pending(true);
    set_sentHash(null);
    set_sendError(null);
    try {
      const { safeTxHash } = await sdk.txs.send({
        txs: [
          {
            to: module,
            value: '0',
            data: encodeFunctionData({
              abi: MODULE_ABI,
              functionName: 'includeNode',
              args: [nodeDefaultTarget(node)],
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

  if (!isReady(safe)) {
    return (
      <SafeAppGate
        safe={safe}
        title="Add a node"
        app="addNode"
      />
    );
  }

  const invalidNode = !!nodeInput.trim() && !node;

  return (
    <Page>
      <SafeName address={safe.safeAddress} />
      <h1>Add a node</h1>
      <AddressField
        value={nodeInput}
        placeholder="0x…"
        onChange={(event) => {
          set_nodeInput(event.target.value);
          set_sentHash(null);
          set_sendError(null);
        }}
        error={invalidNode}
        helperText={invalidNode ? `Enter the node's address` : ' '}
        inputProps={{ spellCheck: false, autoComplete: 'off', 'aria-label': 'Node address' }}
      />
      <p className="hint">
        {module === undefined ? (
          `Looking for the Safe's node management module…`
        ) : module === null ? (
          <span className="error">
            {`This Safe has no HOPR node management module. `}
            <button
              className="retry"
              onClick={findModule}
            >
              Retry
            </button>
          </span>
        ) : included ? (
          `This node is in the Safe's module already.`
        ) : (
          <>
            {`Sign includes the node in the Safe's module `}
            <span className="hash">{module}</span>
            {`. Started with this Safe and module and with some xDai, the node then registers itself with the Safe.`}
          </>
        )}
      </p>
      <Button
        size70
        standardWidth
        pending={pending}
        disabled={!module || !node || included !== false}
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

export default SafeAppAddNodePage;
