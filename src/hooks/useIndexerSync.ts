import { useEffect, useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../store';
import { indexerActionsAsync } from '../store/slices/indexer';
import * as indexerApi from '../indexer/api';
import { useVisibleInterval } from './usePageVisible';

// the status line under the charts and in the settings moves this often
const STATUS_INTERVAL = 5_000;

/**
 * Tells the earnings indexer which nodes are watched here and keeps its status fresh. The indexer
 * may serve several browsers (Docker), so nodes are only added, and removed when unwatched here.
 */
export const useIndexerSync = () => {
  const dispatch = useAppDispatch();
  const available = useAppSelector((store) => store.indexer.available);
  const watchlist = useAppSelector((store) => store.app.watchlist);
  // what the indexer was last told, null before the first time
  const registered = useRef<string[] | null>(null);

  useEffect(() => {
    if (!available) return;
    const previous = registered.current;
    const added = previous ? watchlist.filter((address) => !previous.includes(address)) : watchlist;
    const removed = previous ? previous.filter((address) => !watchlist.includes(address)) : [];
    registered.current = watchlist;
    if (added.length) {
      indexerApi.addNodes(added).catch((e) => console.warn('Could not add the watched nodes to the indexer', e));
    }
    removed.forEach((address) =>
      indexerApi.removeNode(address).catch((e) => console.warn(`Could not remove ${address} from the indexer`, e)),
    );
  }, [available, watchlist]);

  useVisibleInterval(() => (available ? dispatch(indexerActionsAsync.getStatusThunk()) : undefined), STATUS_INTERVAL, [
    available,
  ]);
};
