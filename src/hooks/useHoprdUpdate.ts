import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { getHoprdStableVersion, hoprdUpdateFor } from '../utils/hoprdStable';
import { sendNotification } from './useWatcher/notifications';

/** The stable hoprd version the connected node can update to, or null. */
export const useHoprdUpdate = (): string | null => {
  const nodeVersion = useAppSelector((store) => store.node.version.data);
  const [stable, set_stable] = useState<string | null>(null);

  useEffect(() => {
    if (!nodeVersion) return;
    let cancelled = false;
    getHoprdStableVersion().then((version) => {
      if (!cancelled) set_stable(version);
    });
    return () => {
      cancelled = true;
    };
  }, [nodeVersion]);

  return hoprdUpdateFor(nodeVersion, stable);
};

// node and stable version pairs already announced this session
const notified = new Set<string>();

/** Tells the user once per node and stable release that hoprd can be updated. */
export const useHoprdUpdateNotification = () => {
  const dispatch = useAppDispatch();
  const apiEndpoint = useAppSelector((store) => store.auth.loginData.apiEndpoint);
  const nodeVersion = useAppSelector((store) => store.node.version.data);
  const active = useAppSelector((store) => store.app.configuration.notifications.nodeInfo);
  const update = useHoprdUpdate();

  useEffect(() => {
    if (!active || !update || !apiEndpoint) return;
    const key = `${apiEndpoint}|${update}`;
    if (notified.has(key)) return;
    notified.add(key);
    const message = `hoprd ${update} is available, your node runs ${nodeVersion?.replaceAll('"', '')}`;
    sendNotification({
      notificationPayload: { source: 'node', name: message, url: null, timeout: null },
      toastPayload: { message, type: 'info' },
      dispatch,
    });
  }, [active, update, apiEndpoint]);
};
