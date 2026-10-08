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
  .node-jazz-icon {
    height: 30px;
    width: 30px;
  }
`;

const PeersInfo: React.FC<Props> = (props) => {
  const { peerAddress, shortAddress, ...rest } = props;
  const aliases = useAppSelector((store) => store.node.aliases);

  const getAliasByAddress = (address: string): string => {
    const shown = shortAddress ? shortenAddress(address) : address;
    if (aliases && address && aliases[address]) return `${aliases[address]} (${shown})`;
    return shown;
  };

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
      <div>
        {shortAddress ? (
          <Tooltip title={peerAddress}>
            <span>{peerAddress && getAliasByAddress(peerAddress)}</span>
          </Tooltip>
        ) : (
          <span>{peerAddress && getAliasByAddress(peerAddress)}</span>
        )}{' '}
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
      </div>
    </Container>
  );
};

export default PeersInfo;
