import type { KeyboardEvent, MouseEvent } from 'react';
import { useLocation, useNavigate } from 'react-router-dom';
import { RPC_ERROR } from '../../../config';

/** Stands in for a figure no RPC could read, a click opens the RPC settings. */
export const RpcError = () => {
  const navigate = useNavigate();
  const { search } = useLocation();
  // stops the click reaching a clickable parent, like the header chip that opens its popover
  const open = (event: MouseEvent | KeyboardEvent) => {
    event.stopPropagation();
    event.preventDefault();
    navigate(`/node/configuration${search}`);
  };
  return (
    <span
      role="link"
      tabIndex={0}
      title="Open the RPC settings"
      onClick={open}
      onKeyDown={(event) => event.key === 'Enter' && open(event)}
      style={{ color: 'var(--red)', cursor: 'pointer', textDecoration: 'underline dotted' }}
    >
      {RPC_ERROR}
    </span>
  );
};
