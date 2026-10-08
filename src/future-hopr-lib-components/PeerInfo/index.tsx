import { useEffect } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { Link } from 'react-router-dom';
import styled from '@emotion/styled';

// HOPR Components
import SmallActionButton from '../../future-hopr-lib-components/Button/SmallActionButton';
import { generateBase64Jazz } from '../../utils/functions';
import { shortenAddress } from '../../utils/amount';
import Tooltip from '../Tooltip/tooltip-fixed-width';

//Mui
import CopyIcon from '@mui/icons-material/ContentCopy';
import LaunchIcon from '@mui/icons-material/Launch';

interface Props {
  peerAddress?: string;
  // 0x12345...abcde with the full address in a tooltip
  shortAddress?: boolean;
}

const Container = styled.div`
  display: flex;
  align-items: center;
  min-width: 0;
  .node-jazz-icon {
    flex: 0 0 20px;
    height: 20px;
    width: 20px;
  }
  .label {
    display: flex;
    align-items: baseline;
    gap: 6px;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
  }
  .alias {
    font-weight: 600;
    color: var(--text);
  }
  .address {
    font-family: var(--font-mono);
    font-size: 12.5px;
    color: var(--text-2);
  }
  .alias + .address {
    color: var(--muted);
  }
  .PeerInfo-links {
    display: inline-flex;
    flex: 0 0 auto;
    margin-left: 4px;
    svg {
      width: 15px;
      height: 15px;
      color: var(--muted);
    }
  }
`;

const PeersInfo: React.FC<Props> = (props) => {
  const { peerAddress, shortAddress, ...rest } = props;
  const aliases = useAppSelector((store) => store.node.aliases);

  const noCopyPaste = !(
    window.location.protocol === 'https:' ||
    window.location.hostname === 'localhost' ||
    window.location.hostname === '127.0.0.1'
  );

  const icon = peerAddress && generateBase64Jazz(peerAddress);

  return (
    <Container>
      <img
        className={`node-jazz-icon node-jazz-icon-present`}
        src={icon || ''}
        data-src={peerAddress}
      />
      <Tooltip title={peerAddress}>
        <span className="label">
          {peerAddress && aliases?.[peerAddress] && <span className="alias">{aliases[peerAddress]}</span>}
          <span className="address">{peerAddress && (shortAddress ? shortenAddress(peerAddress) : peerAddress)}</span>
        </span>
      </Tooltip>
      <span className="PeerInfo-links">
        <SmallActionButton
          onClick={() => navigator.clipboard.writeText(peerAddress as string)}
          disabled={noCopyPaste}
          tooltip={noCopyPaste ? 'Clipboard not supported on HTTP' : 'Copy Node Address'}
        >
          <CopyIcon />
        </SmallActionButton>
        <SmallActionButton tooltip={'Open in gnosisscan.io'}>
          <Link
            to={`https://gnosisscan.io/address/${peerAddress}`}
            target="_blank"
          >
            <LaunchIcon />
          </Link>
        </SmallActionButton>
      </span>
    </Container>
  );
};

export default PeersInfo;
