import type { AppDispatch } from '../..';
import { actionsAsync as blokliActionsAsync } from './actionsAsync';

/**
 * Fetches everything we read from blokli for the connected node, and settles once every
 * request has, so a poll can wait for it before scheduling the next one.
 *
 * All three inputs arrive asynchronously after a node switch - the url from local
 * storage, the safe address only once getInfo resolves - so callers pass them in and
 * this bails out until they are all there.
 */
export const fetchBlokliData = ({
  blokliUrl,
  nodeAddress,
  safeAddress,
  dispatch,
}: {
  blokliUrl: string | null | undefined;
  nodeAddress: string | null | undefined;
  safeAddress: string | null | undefined;
  dispatch: AppDispatch;
}): Promise<unknown> => {
  if (!blokliUrl || !nodeAddress) return Promise.resolve();

  const requests: Promise<unknown>[] = [
    dispatch(
      blokliActionsAsync.getTicketRedemptionStatsThunk({
        blokliUrl,
        nodeAddress,
      }),
    ),
    dispatch(
      blokliActionsAsync.getNodeChannelsThunk({
        blokliUrl,
        nodeAddress,
      }),
    ),
  ];

  if (safeAddress) {
    requests.push(
      dispatch(
        blokliActionsAsync.getChannelStatsThunk({
          blokliUrl,
          nodeAddress,
          safeAddress,
        }),
      ),
      dispatch(
        blokliActionsAsync.getSafeNodesThunk({
          blokliUrl,
          nodeAddress,
          safeAddress,
        }),
      ),
    );
  }

  return Promise.all(requests);
};
