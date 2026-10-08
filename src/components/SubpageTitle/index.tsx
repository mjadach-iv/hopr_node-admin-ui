import { useState } from 'react';
import styled from '@emotion/styled';

// Mui
import RefreshIcon from '@mui/icons-material/Refresh';
import { Tooltip, IconButton } from '@mui/material';

type SubpageTitleProps = {
  title?: string;
  reloading?: boolean;
  refreshFunction?: () => void;
  actions?: any;
};

const Content = styled.div`
  display: flex;
  align-items: center;
  gap: 12px;
  width: 100%;
  justify-content: space-between;
  min-height: 40px;
  margin: 16px 0 12px;
  @media (max-width: 600px) {
    flex-wrap: wrap;
    margin: 12px 0 10px;
    h2 {
      font-size: 18px;
    }
  }
  h2 {
    margin: 0;
    color: var(--text);
    font-size: 20px;
    font-weight: 650;
    letter-spacing: -0.01em;
    text-transform: lowercase;
    white-space: nowrap;
    &::first-letter {
      text-transform: uppercase;
    }
  }
  .right {
    display: flex;
    align-items: center;
    gap: 4px;
  }
  .actions {
    display: flex;
    align-items: center;
    gap: 2px;
    padding: 2px;
    border: 1px solid var(--border);
    border-radius: var(--radius);
    background: var(--surface);
    &:empty {
      display: none;
    }
  }
  .MuiSvgIcon-root {
    color: var(--primary);
  }
  /* image icons (Scalar) are drawn in navy */
  .actions img {
    filter: brightness(0) invert(0.92);
  }
`;

const SIconButton = styled(IconButton)`
  width: 34px;
  height: 34px;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  background: var(--surface);
  svg {
    width: 20px;
    height: 20px;
  }
  &.Mui-disabled {
    svg {
      background-color: transparent;
      color: rgba(0, 0, 0, 0.26);
    }
  }
  &.reloading svg {
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

export const SubpageTitle = ({ title, reloading, refreshFunction, actions }: SubpageTitleProps) => {
  const [reloadingLocal, set_reloadingLocal] = useState(false);

  return (
    <Content className="SubpageTitle">
      <h2>{title}</h2>
      <div className="right">
        {actions && <div className="actions">{actions}</div>}
        {refreshFunction && (
          <Tooltip title="Refresh">
            <SIconButton
              className={`${reloading || reloadingLocal ? 'reloading' : ''}`}
              onClick={() => {
                set_reloadingLocal(true);
                refreshFunction();
                setTimeout(() => {
                  set_reloadingLocal(false);
                }, 2000);
              }}
            >
              <RefreshIcon />
            </SIconButton>
          </Tooltip>
        )}
      </div>
    </Content>
  );
};
