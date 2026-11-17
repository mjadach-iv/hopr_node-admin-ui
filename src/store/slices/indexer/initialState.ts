import type { IndexerStatus } from '../../../indexer/types';

type InitialState = {
  // null until the first answer, false for a build without an indexer (Vercel, FTP)
  available: boolean | null;
  status: IndexerStatus | null;
};

export const initialState: InitialState = {
  available: null,
  status: null,
};
