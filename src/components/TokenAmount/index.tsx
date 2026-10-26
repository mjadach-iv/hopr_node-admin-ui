import Tooltip from '../../future-hopr-lib-components/Tooltip/tooltip-fixed-width';
import { shrinkNumber } from '../../utils/amount';
import { RpcError } from '../RpcError';

// short figure in the cell, full precision in the tooltip; a signed figure is green, red below zero
export const TokenAmount = ({
  value,
  unit,
  broken,
  signed,
}: {
  value?: string | null;
  unit: string;
  broken?: boolean;
  signed?: boolean;
}) =>
  !value && broken ? (
    <RpcError />
  ) : value ? (
    <Tooltip title={`${value} ${unit}`}>
      <span>
        <span style={signed ? { color: value.startsWith('-') ? 'var(--red)' : 'var(--green)' } : undefined}>
          {shrinkNumber(value)}
        </span>
        <span className="unit">{unit}</span>
      </span>
    </Tooltip>
  ) : (
    <>-</>
  );
