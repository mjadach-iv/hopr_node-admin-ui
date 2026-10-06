import { useState } from 'react';
import { DialogTitle, CircularProgress } from '@mui/material';
import { SDialog, SDialogContent, SIconButton, TopBar } from '../../../future-hopr-lib-components/Modal/styled';
import { useAppDispatch, useAppSelector } from '../../../store';
import { actionsAsync } from '../../../store/slices/node/actionsAsync';
import { utils as hoprdUtils, type GetTicketStatisticsResponseType } from '@hoprnet/hopr-sdk';
const { sdkApiError } = hoprdUtils;

// HOPR Components
import IconButton from '../../../future-hopr-lib-components/Button/IconButton';
import { TableExtended } from '../../../future-hopr-lib-components/Table/columed-data';

// Icons
import CloseIcon from '@mui/icons-material/Close';
import ConfirmationNumberIcon from '@mui/icons-material/ConfirmationNumber';

type ChannelTicketStatisticsModalProps = {
  address?: string;
  disabled?: boolean;
};

export const ChannelTicketStatisticsModal = (props: ChannelTicketStatisticsModalProps) => {
  const dispatch = useAppDispatch();
  const loginData = useAppSelector((store) => store.auth.loginData);
  const aliases = useAppSelector((store) => store.node.aliases);
  const [openModal, set_openModal] = useState(false);
  const [loading, set_loading] = useState(false);
  const [statistics, set_statistics] = useState<GetTicketStatisticsResponseType | null>(null);
  const [error, set_error] = useState<string | null>(null);

  const counterparty =
    props.address && aliases[props.address] ? `${aliases[props.address]} (${props.address})` : props.address;

  const handleOpenModal = () => {
    if (!loginData.apiEndpoint || !props.address) return;
    (document.activeElement as HTMLInputElement).blur();
    set_openModal(true);
    set_statistics(null);
    set_error(null);
    set_loading(true);
    dispatch(
      actionsAsync.getChannelTicketStatisticsThunk({
        apiEndpoint: loginData.apiEndpoint,
        apiToken: loginData.apiToken ? loginData.apiToken : '',
        address: props.address,
      }),
    )
      .unwrap()
      .then((res) => {
        set_statistics(res);
      })
      .catch((e) => {
        let errMsg = 'Fetching ticket statistics failed';
        if (e instanceof sdkApiError && e.hoprdErrorPayload?.status)
          errMsg = errMsg + `.\n${e.hoprdErrorPayload.status}`;
        if (e instanceof sdkApiError && e.hoprdErrorPayload?.error) errMsg = errMsg + `.\n${e.hoprdErrorPayload.error}`;
        set_error(errMsg);
      })
      .finally(() => {
        set_loading(false);
      });
  };

  const handleCloseModal = () => {
    set_openModal(false);
  };

  return (
    <>
      <IconButton
        iconComponent={<ConfirmationNumberIcon />}
        tooltipText={
          <span>
            TICKET STATISTICS
            <br />
            of this channel
          </span>
        }
        onClick={handleOpenModal}
        disabled={props.disabled || !props.address}
      />
      <SDialog
        open={openModal}
        onClose={handleCloseModal}
        disableScrollLock={true}
      >
        <TopBar>
          <DialogTitle>Channel ticket statistics</DialogTitle>
          <SIconButton
            aria-label="close modal"
            onClick={handleCloseModal}
          >
            <CloseIcon />
          </SIconButton>
        </TopBar>
        <SDialogContent>
          <span style={{ wordBreak: 'break-all' }}>Incoming channel from {counterparty}</span>
          {loading && <CircularProgress style={{ margin: 'auto' }} />}
          {error && <span className="error-message">{error}</span>}
          {statistics && (
            <TableExtended>
              <tbody>
                <tr>
                  <th>Unredeemed value</th>
                  <td>{statistics.unredeemedValue} wxHOPR</td>
                </tr>
                <tr>
                  <th>Neglected value</th>
                  <td>{statistics.neglectedValue} wxHOPR</td>
                </tr>
                <tr>
                  <th>Rejected value</th>
                  <td>{statistics.rejectedValue} wxHOPR</td>
                </tr>
                <tr>
                  <th>Winning tickets</th>
                  <td>{statistics.winningCount}</td>
                </tr>
              </tbody>
            </TableExtended>
          )}
        </SDialogContent>
      </SDialog>
    </>
  );
};
