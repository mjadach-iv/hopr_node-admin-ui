import type { SafeInfoExtended } from '@safe-global/safe-apps-sdk';
import {
  decodeFunctionResult,
  encodeFunctionData,
  getAddress,
  isAddressEqual,
  multicall3Abi,
  parseAbi,
  type Address,
  type Hex,
} from 'viem';
import { sdk } from './shared';

export const MODULE_ABI = parseAbi([
  'function isHoprNodeManagementModule() view returns (bool)',
  'function isNode(address nodeAddress) view returns (bool)',
  'function getTargets() view returns (uint256[])',
  'function includeNode(uint256 nodeDefaultTarget)',
  'function removeNode(address nodeAddress)',
]);

export const REGISTRY_ABI = parseAbi([
  'function nodeToSafe(address nodeAddress) view returns (address)',
  'function deregisterNodeBySafe(address nodeAddr)',
]);

// one eth_call for many reads; Multicall3's address on Gnosis Chain
const MULTICALL3 = '0xcA11bde05977b3631167028862bE2a173976CA11';

// TargetType.SEND of the module's targets, which includeNode gives every node
const TARGET_TYPE_SEND = 2;

// reads through Safe{Wallet}'s RPC
const call = (to: string, data: Hex) => sdk.eth.call([{ to, data }]) as Promise<Hex>;

// any other module reverts or answers nothing
const isHoprModule = async (address: string) => {
  try {
    const data = await call(
      address,
      encodeFunctionData({ abi: MODULE_ABI, functionName: 'isHoprNodeManagementModule' }),
    );
    return decodeFunctionResult({ abi: MODULE_ABI, functionName: 'isHoprNodeManagementModule', data });
  } catch {
    return false;
  }
};

/** The Safe's HOPR node management module, null when it has none. */
export const findHoprModule = async (safe: SafeInfoExtended) => {
  for (const address of safe.modules ?? []) {
    if (await isHoprModule(address)) return getAddress(address);
  }
  return null;
};

export const isNode = async (module: Address, nodeAddress: Address) => {
  const data = await call(module, encodeFunctionData({ abi: MODULE_ABI, functionName: 'isNode', args: [nodeAddress] }));
  return decodeFunctionResult({ abi: MODULE_ABI, functionName: 'isNode', data });
};

export type ModuleNodeType = {
  address: Address;
  // a member of the module, may act for the Safe
  inModule: boolean;
  // registered to this Safe on the node-safe registry
  registered: boolean;
};

/**
 * Every node of the Safe: in its module or registered to it. The module keeps a SEND target for
 * each node it ever included, also after removeNode, so isNode and the registry tell the rest.
 */
export const getModuleNodes = async (module: Address, registry: Address, safeAddress: string) => {
  const data = await call(module, encodeFunctionData({ abi: MODULE_ABI, functionName: 'getTargets' }));
  const targets = decodeFunctionResult({ abi: MODULE_ABI, functionName: 'getTargets', data });
  const candidates = targets
    .filter((target) => Number((target >> BigInt(80)) & BigInt(0xff)) === TARGET_TYPE_SEND)
    .map((target) => getAddress(`0x${(target >> BigInt(96)).toString(16).padStart(40, '0')}`));
  if (!candidates.length) return [];

  const reads = candidates.flatMap((node) => [
    {
      target: module,
      allowFailure: false,
      callData: encodeFunctionData({ abi: MODULE_ABI, functionName: 'isNode', args: [node] }),
    },
    {
      target: registry,
      allowFailure: false,
      callData: encodeFunctionData({ abi: REGISTRY_ABI, functionName: 'nodeToSafe', args: [node] }),
    },
  ]);
  const results = decodeFunctionResult({
    abi: multicall3Abi,
    functionName: 'aggregate3',
    data: await call(MULTICALL3, encodeFunctionData({ abi: multicall3Abi, functionName: 'aggregate3', args: [reads] })),
  });

  const nodes: ModuleNodeType[] = candidates.map((address, i) => ({
    address,
    inModule: decodeFunctionResult({ abi: MODULE_ABI, functionName: 'isNode', data: results[2 * i].returnData }),
    registered: isAddressEqual(
      decodeFunctionResult({ abi: REGISTRY_ABI, functionName: 'nodeToSafe', data: results[2 * i + 1].returnData }),
      getAddress(safeAddress),
    ),
  }));
  return nodes.filter((node) => node.inModule || node.registered);
};
