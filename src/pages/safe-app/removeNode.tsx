import { useEffect, useState } from 'react';
import { encodeFunctionData, type Address } from 'viem';
import { useAppSelector } from '../../store';
import { selectBlokliUrl } from '../../store/selectors/blokli';
import { api as blokliApi } from '../../blokli';
import { shortenAddress } from '../../utils/amount';
import { findHoprModule, getModuleNodes, MODULE_ABI, REGISTRY_ABI, type ModuleNodeType } from './module';
import { isReady, Page, SafeAppGate, SafeName, sdk, useSafeInfo } from './shared';

// HOPR Components
import Button from '../../future-hopr-lib-components/Button';
import Select from '../../future-hopr-lib-components/Select';

/**
 * Removes a node from the Safe: deregisters it from the Safe on the node-safe registry and removes
 * it from the Safe's node management module, the transaction hopli sends when it moves a node away.
 * Opened as a custom Safe App inside Safe{Wallet}, which takes it straight to its sign dialog.
 */
function SafeAppRemoveNodePage() {
  const blokliUrl = useAppSelector(selectBlokliUrl);
  const aliases = useAppSelector((store) => store.app.aliases);
  const safe = useSafeInfo();
  const [contracts, set_contracts] = useState<{ module: Address | null; registry: Address } | null>(null);
  // undefined while loading, null when it failed
  const [nodes, set_nodes] = useState<ModuleNodeType[] | null | undefined>(undefined);
  const [selected, set_selected] = useState('');
  const [pending, set_pending] = useState(false);
  const [sentHash, set_sentHash] = useState<string | null>(null);
  const [sendError, set_sendError] = useState<string | null>(null);

  const loadNodes = () => {
    if (!isReady(safe) || !blokliUrl) return;
    set_nodes(undefined);
    (async () => {
      const [module, registry] = await Promise.all([
        findHoprModule(safe),
        blokliApi.getNodeSafeRegistry({ blokliUrl }),
      ]);
      set_contracts({ module, registry });
      return module ? getModuleNodes(module, registry, safe.safeAddress) : [];
    })()
      .then(set_nodes)
      .catch((e) => {
        console.warn('Could not read the nodes of the Safe', e);
        set_nodes(null);
      });
  };

  useEffect(loadNodes, [safe, blokliUrl]);

  const node = nodes?.find((elem) => elem.address === selected);

  const handleSign = async () => {
    if (!node || !contracts?.module) return;
    set_pending(true);
    set_sentHash(null);
    set_sendError(null);
    try {
      // each call reverts when there is nothing to undo, so only what applies is sent
      const { safeTxHash } = await sdk.txs.send({
        txs: [
          ...(node.registered
            ? [
                {
                  to: contracts.registry,
                  value: '0',
                  data: encodeFunctionData({
                    abi: REGISTRY_ABI,
                    functionName: 'deregisterNodeBySafe',
                    args: [node.address],
                  }),
                },
              ]
            : []),
          ...(node.inModule
            ? [
                {
                  to: contracts.module,
                  value: '0',
                  data: encodeFunctionData({ abi: MODULE_ABI, functionName: 'removeNode', args: [node.address] }),
                },
              ]
            : []),
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
        title="Remove a node"
        app="removeNode"
      />
    );
  }

  return (
    <Page>
      <SafeName address={safe.safeAddress} />
      <h1>Remove a node</h1>
      <Select
        label="Node"
        value={selected}
        disabled={!nodes?.length}
        showJazzIcon
        style={{ width: 'min(100%, 520px)', margin: 0 }}
        values={(nodes ?? []).map((elem) => ({
          value: elem.address,
          name: aliases?.[elem.address] ? `${aliases[elem.address]} (${shortenAddress(elem.address)})` : elem.address,
          apiEndpoint: null,
          jazzIcon: elem.address,
        }))}
        onChange={(event) => {
          set_selected(event.target.value as string);
          set_sentHash(null);
          set_sendError(null);
        }}
      />
      <p className="hint">
        {nodes === undefined ? (
          `Looking for the Safe's nodes…`
        ) : nodes === null ? (
          <span className="error">
            {`Could not read the Safe's nodes. `}
            <button
              className="retry"
              onClick={loadNodes}
            >
              Retry
            </button>
          </span>
        ) : contracts?.module === null ? (
          <span className="error">This Safe has no HOPR node management module.</span>
        ) : nodes.length === 0 ? (
          `The Safe has no nodes.`
        ) : !node ? (
          `Choose one of the Safe's ${nodes.length} nodes.`
        ) : node.registered && node.inModule ? (
          `Sign deregisters the node from the Safe on the node-safe registry and removes it from the Safe's module. It can then no longer act for the Safe.`
        ) : node.inModule ? (
          `The node is not registered with the Safe yet. Sign removes it from the Safe's module, it can then no longer act for the Safe.`
        ) : (
          `The node is not in the Safe's module anymore. Sign deregisters it from the Safe on the node-safe registry.`
        )}
      </p>
      <Button
        size70
        standardWidth
        pending={pending}
        disabled={!node || !contracts?.module}
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

export default SafeAppRemoveNodePage;
