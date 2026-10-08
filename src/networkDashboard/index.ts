import * as api from './api';
import { CT_ELIGIBILITY_HINT, formatAvailability, formatLatency, formatMbps } from './format';

export { api };
export const utils = {
  networkDashboardApiError: api.networkDashboardApiError,
  dashboardEnvId: api.dashboardEnvId,
  formatAvailability,
  formatLatency,
  formatMbps,
  CT_ELIGIBILITY_HINT,
};

export type { NodeStatsType, NodesStatsType } from './types';
