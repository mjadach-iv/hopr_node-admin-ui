import type { JSX } from 'react';
import styled from '@emotion/styled';

// Mui
import { Tooltip, IconButton as MuiIconButton } from '@mui/material';
import CircularProgress from '@mui/material/CircularProgress';

type SubpageTitleProps = {
  reloading?: boolean;
  disabled?: boolean;
  onClick?: () => void;
  iconComponent?: any;
  tooltipText?: string | JSX.Element;
  className?: string;
  style?: Object;
  pending?: boolean;
};

const SIconButton = styled(MuiIconButton)`
  padding: 6px;
  border-radius: 6px;
  svg {
    color: var(--primary);
    fill: var(--primary);
    width: 20px;
    height: 20px;
  }
  &:hover {
    background-color: var(--primary-soft);
  }
  &.Mui-disabled {
    svg {
      background-color: transparent;
      color: rgba(0, 0, 0, 0.26);
      fill: rgba(0, 0, 0, 0.26);
    }
  }
  &.reloading {
    animation: rotation 2s infinite linear;
  }
  @keyframes rotation {
    0% {
      transform: rotate(0deg);
    }
    100% {
      transform: rotate(1turn);
    }
  }
`;

const SCircularProgress = styled(CircularProgress)`
  position: absolute;
  &.pending,
  &.pending > svg {
    width: 20px !important;
    height: 20px !important;
    color: #1976d2;
  }
`;

export const IconButton = ({
  reloading,
  tooltipText,
  className,
  style,
  onClick,
  iconComponent,
  disabled,
  pending,
}: SubpageTitleProps) => {
  return (
    <Tooltip
      title={tooltipText}
      className={className}
      style={style}
    >
      <span>
        <SIconButton
          disabled={disabled || pending || reloading}
          className={`${reloading ? 'reloading' : ''}`}
          onClick={onClick}
        >
          {iconComponent}
          {pending && <SCircularProgress className={'pending'} />}
        </SIconButton>
      </span>
    </Tooltip>
  );
};

export default IconButton;
