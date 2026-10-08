import { getAddress, isAddress } from 'viem';
import type { AppDispatch } from '../..';
import { utils } from '../../../networkDashboard';
import { actionsAsync as networkDashboardActionsAsync } from './actionsAsync';

/**
 * Fetches the dashboard figures of the connected node and the nodes of its safe.
 * Bails out while the network name or own address are not known yet, and for
 * networks the dashboard does not track.
 */
export const fetchNetworkDashboardData = ({
  networkName,
  nodeAddress,
  safeNodeAddresses,
  dispatch,
}: {
  networkName: string | null | undefined;
  nodeAddress: string | null | undefined;
  safeNodeAddresses: string[];
  dispatch: AppDispatch;
}) => {
  const envId = utils.dashboardEnvId(networkName);
  if (envId === null || !nodeAddress || !isAddress(nodeAddress)) return;

  dispatch(
    networkDashboardActionsAsync.getNodesStatsThunk({
      envId,
      nodeAddress: getAddress(nodeAddress),
      addresses: [nodeAddress, ...safeNodeAddresses],
    }),
  );
};
