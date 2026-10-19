import styled from '@emotion/styled';
import { TooltipProps } from '@mui/material/Tooltip';
import LazyTooltip from './lazy-tooltip';

interface Props extends TooltipProps {
  notWide?: boolean;
}

const Tooltip: React.FC<Props> = (props) => {
  const { className, notWide, ...rest } = props;
  return (
    <LazyTooltip
      classes={{ popper: `STooltip ${className} ${notWide ? 'notWide' : ''}` }}
      {...rest}
    />
  );
};

export default Tooltip;
