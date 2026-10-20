import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { blokliActionsAsync } from '../../store/slices/blokli';
import { selectBlokliUrl } from '../../store/selectors/blokli';
import { fetchNetworkDashboardData } from '../../store/slices/networkDashboard/fetchNetworkDashboardData';

// HOPR Components
import Section from '../../future-hopr-lib-components/Section';
import { SubpageTitle } from '../../components/SubpageTitle';
import { NodesTable } from '../../components/NodesTable';

/**
 * Nodes registered to the same safe as the connected node.
 */
function SafeNodesPage() {
  const dispatch = useAppDispatch();
  const safeNodes = useAppSelector((store) => store.blokli.safeNodes);
  const mypeerAddress = useAppSelector((store) => store.node.addresses.data.native);
  const hoprNodeSafe = useAppSelector((store) => store.node.info.data?.hoprNodeSafe);
  const blokliUrl = useAppSelector(selectBlokliUrl);
  const hoprNetworkName = useAppSelector((store) => store.node.info.data?.hoprNetworkName);
  const dashboardNodes = useAppSelector((store) => store.networkDashboard.nodes);
  const safeNodeAddressesKey = (safeNodes.data ?? []).map((node) => node.nodeAddress).join(',');

  useEffect(() => {
    fetchNetworkDashboardData({
      networkName: hoprNetworkName,
      nodeAddress: mypeerAddress,
      safeNodeAddresses: safeNodeAddressesKey ? safeNodeAddressesKey.split(',') : [],
      dispatch,
    });
  }, [hoprNetworkName, mypeerAddress, safeNodeAddressesKey]);

  const handleRefresh = () => {
    fetchNetworkDashboardData({
      networkName: hoprNetworkName,
      nodeAddress: mypeerAddress,
      safeNodeAddresses: (safeNodes.data ?? []).map((node) => node.nodeAddress),
      dispatch,
    });
    if (!blokliUrl || !mypeerAddress || !hoprNodeSafe) return;
    dispatch(
      blokliActionsAsync.getSafeNodesThunk({
        blokliUrl,
        nodeAddress: mypeerAddress,
        safeAddress: hoprNodeSafe,
      }),
    );
  };

  return (
    <Section
      className="Section--safe-nodes"
      id="Section--safe-nodes"
      fullHeightMin
      yellow
    >
      <SubpageTitle
        title={safeNodes.data ? `NODES (${safeNodes.data.length})` : 'NODES'}
        refreshFunction={handleRefresh}
        reloading={safeNodes.isFetching || dashboardNodes.isFetching}
      />
      <NodesTable
        id="safe-nodes-table"
        nodes={safeNodes.data ?? []}
        stats={dashboardNodes.data}
        loading={safeNodes.data === null && safeNodes.isFetching}
      />
    </Section>
  );
}

export default SafeNodesPage;
