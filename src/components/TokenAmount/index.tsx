import Tooltip from '../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import { shrinkNumber } from '../../utils/amount';
import { RpcError } from '../RpcError';

// short figure in the cell, full precision in the tooltip
export const TokenAmount = ({ value, unit, broken }: { value?: string | null; unit: string; broken?: boolean }) =>
  !value && broken ? (
    <RpcError />
  ) : value ? (
    <Tooltip title={`${value} ${unit}`}>
      <span>
        {shrinkNumber(value)}
        <span className="unit">{unit}</span>
      </span>
    </Tooltip>
  ) : (
    <>-</>
  );
