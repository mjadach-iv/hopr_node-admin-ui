import Tooltip from '../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import { shrinkNumber } from '../../utils/amount';

// short figure in the cell, full precision in the tooltip
export const TokenAmount = ({ value, unit }: { value?: string | null; unit: string }) =>
  value ? (
    <Tooltip title={`${value} ${unit}`}>
      <span>
        {shrinkNumber(value)}
        <span className="unit">{unit}</span>
      </span>
    </Tooltip>
  ) : (
    <>-</>
  );
