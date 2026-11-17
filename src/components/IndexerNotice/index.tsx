import styled from '@emotion/styled';
import { useAppSelector } from '../../store';
import type { IndexerStatus } from '../../indexer/types';

const Banner = styled.div`
  width: 100%;
  box-sizing: border-box;
  margin-bottom: 16px;
  padding: 10px 14px;
  border: 1px solid var(--red);
  border-radius: var(--radius);
  color: var(--text);
  font-size: 13px;
  line-height: 1.5;
  code {
    font-family: var(--font-mono);
    font-size: 12px;
  }
`;

const Line = styled.div`
  display: flex;
  flex-direction: column;
  gap: 4px;
  font-size: 13px;
  .muted {
    color: var(--muted);
    font-size: 12px;
  }
  .error {
    color: var(--red);
    font-size: 12px;
  }
`;

/**
 * How far the indexer got from the network's first block to its newest, e.g. "Indexer status: 63%". 0%
 * until it read the chain the first time, 100% once it caught up with the finalized blocks, which stay
 * a few minutes behind the newest.
 */
export const describeStatus = (status: IndexerStatus) => {
  if (status.phase === 'idle') return 'Indexer status: 100%';
  const percent = status.progress === null ? 0 : Math.floor(status.progress * 1000) / 10;
  return `Indexer status: ${percent}%`;
};

/** Shown when the indexer's database would not survive: a Docker container without a volume at /data. */
export const IndexerNotice = () => {
  const status = useAppSelector((store) => store.indexer.status);
  if (!status || status.persistent) return null;
  return (
    <Banner>
      Settings and indexed earnings are lost when this container is recreated. Mount a volume at <code>/data</code>,
      e.g. <code>docker run -v hopr-admin-data:/data …</code>
    </Banner>
  );
};

/** The indexer's state for the settings page. */
export const IndexerStatusLine = () => {
  const available = useAppSelector((store) => store.indexer.available);
  const status = useAppSelector((store) => store.indexer.status);
  if (available === false) {
    return (
      <Line>
        Not available
        <span className="muted">
          The earnings over time on the watchlist come from the indexer in the desktop app and the Docker image.
        </span>
      </Line>
    );
  }
  if (!status) return <Line>-</Line>;
  return (
    <Line>
      {describeStatus(status)}
      <span className="muted">
        {`${status.redemptions.toLocaleString()} ticket redemptions of ${status.network ?? 'the network'} indexed, ${
          status.nodes.filter((node) => node.active).length
        } nodes watched`}
      </span>
      {status.lastError && <span className="error">{`Last attempt failed, retrying: ${status.lastError}`}</span>}
    </Line>
  );
};
