import { useEffect, useState } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';

// HOPR Components
import { SubpageTitle } from '../../components/SubpageTitle';
import { TableExtended } from '../../future-hopr-lib-components/Table/columed-data';
import Section from '../../future-hopr-lib-components/Section';
import Button from '../../future-hopr-lib-components/Button';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';
import TextField from '../../future-hopr-lib-components/TextField';

// Mui
import { Paper } from '@mui/material';
import styled from '@emotion/styled';
import { appActions } from '../../store/slices/app';
import { blokliActions } from '../../store/slices/blokli';
import { selectBlokliUrl } from '../../store/selectors/blokli';
import { parseAndFormatUrl } from '../../utils/parseAndFormatUrl';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import { RPC_ERROR, GNOSIS_RPC_URLS } from '../../../config';

const BlokliContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
  align-items: flex-end;
`;

const BlokliButtons = styled.div`
  display: flex;
  gap: 1rem;
`;

const RpcList = styled.ol`
  width: 100%;
  margin: 0;
  padding: 0;
  list-style: none;
  border: 1px solid var(--border);
  border-radius: var(--radius);
  li {
    display: flex;
    align-items: center;
    gap: 8px;
    padding: 4px 4px 4px 8px;
    cursor: grab;
    &:not(:last-of-type) {
      border-bottom: 1px solid var(--border);
    }
    &.dragging {
      opacity: 0.4;
    }
    &.drop-above {
      box-shadow: inset 0 2px 0 var(--primary);
    }
    &.drop-below {
      box-shadow: inset 0 -2px 0 var(--primary);
    }
  }
  li.empty {
    padding: 12px;
    color: var(--muted);
    cursor: default;
  }
  .handle {
    flex: 0 0 auto;
    width: 18px;
    height: 18px;
    color: var(--muted);
  }
  .order {
    flex: 0 0 auto;
    min-width: 16px;
    font-size: 12px;
    color: var(--muted);
  }
  .url {
    flex: 1;
    min-width: 0;
    overflow: hidden;
    text-overflow: ellipsis;
    white-space: nowrap;
    font-family: monospace;
  }
`;

const RpcAdd = styled.div`
  display: flex;
  gap: 1rem;
  width: 100%;
  align-items: center;
  > :first-of-type {
    flex: 1;
    margin-bottom: 0;
  }
  > button {
    min-width: 0;
    padding: 4px 14px;
    font-size: 13px;
  }
`;

function NodeConfigurationPage() {
  const dispatch = useAppDispatch();
  const blokliUrlOverride = useAppSelector((store) => store.blokli.url);
  const effectiveBlokliUrl = useAppSelector(selectBlokliUrl) ?? '';
  const mypeerAddress = useAppSelector((store) => store.node.addresses.data.native);
  const [localBlokliUrl, set_localBlokliUrl] = useState('');
  const [blokliUrlError, set_blokliUrlError] = useState<string | null>(null);
  const canSaveBlokliUrl = localBlokliUrl !== effectiveBlokliUrl;
  const rpcUrls = useAppSelector((store) => store.app.configuration.rpc.urls);
  const [localRpcUrls, set_localRpcUrls] = useState(rpcUrls);
  const canSaveRpcUrls = localRpcUrls.join(',') !== rpcUrls.join(',');
  const canResetRpcUrls = [rpcUrls, localRpcUrls].some((urls) => urls.join(',') !== GNOSIS_RPC_URLS.join(','));
  const rpcBroken = useAppSelector(
    (store) =>
      !!store.blokli.safeNodes.data?.some((node) => node.rpcBroken) || !!store.blokli.nodeChannels.data?.rpcBroken,
  );
  const [newRpcUrl, set_newRpcUrl] = useState('');
  const [dragRpcIndex, set_dragRpcIndex] = useState<number | null>(null);
  const [overRpcIndex, set_overRpcIndex] = useState<number | null>(null);
  const [rpcError, set_rpcError] = useState<string | null>(null);

  useEffect(() => {
    set_localBlokliUrl(effectiveBlokliUrl);
    set_blokliUrlError(null);
  }, [effectiveBlokliUrl]);

  useEffect(() => {
    set_localRpcUrls(rpcUrls);
  }, [rpcUrls]);

  function handleSaveBlokliUrl() {
    const formattedUrl = parseAndFormatUrl(localBlokliUrl);
    if (!formattedUrl) {
      set_blokliUrlError('Blokli URL was incorrectly formatted');
      return;
    }
    set_blokliUrlError(null);
    dispatch(
      blokliActions.setUrl({
        nodeAddress: mypeerAddress,
        url: formattedUrl,
      }),
    );
  }

  function handleResetBlokliUrl() {
    set_blokliUrlError(null);
    dispatch(blokliActions.resetUrl(mypeerAddress));
  }

  function handleAddRpc() {
    const formattedUrl = parseAndFormatUrl(newRpcUrl.trim());
    if (!formattedUrl) {
      set_rpcError('RPC URL was incorrectly formatted');
      return;
    }
    if (localRpcUrls.includes(formattedUrl)) {
      set_rpcError('This RPC is already in the list');
      return;
    }
    set_rpcError(null);
    set_newRpcUrl('');
    set_localRpcUrls([...localRpcUrls, formattedUrl]);
  }

  function handleMoveRpc(from: number, to: number) {
    if (from === to) return;
    const urls = [...localRpcUrls];
    urls.splice(to, 0, urls.splice(from, 1)[0]);
    set_localRpcUrls(urls);
  }

  const endRpcDrag = () => {
    set_dragRpcIndex(null);
    set_overRpcIndex(null);
  };

  function handleSaveRpc() {
    dispatch(appActions.setRpcSettings({ urls: localRpcUrls }));
  }

  function handleResetRpc() {
    set_rpcError(null);
    set_localRpcUrls(GNOSIS_RPC_URLS);
    dispatch(appActions.setRpcSettings({ urls: GNOSIS_RPC_URLS }));
  }

  return (
    <Section
      className="Section--settings"
      id="Section--settings"
      fullHeightMin
      yellow
    >
      <SubpageTitle title="NODE CONFIGURATION" />
      <Paper
        elevation={0}
        style={{
          padding: '8px 20px 16px',
          width: '100%',
          boxSizing: 'border-box',
          border: '1px solid var(--border)',
          borderRadius: 'var(--radius)',
        }}
      >
        <TableExtended
          title="Node"
          style={{ marginBottom: '32px' }}
        >
          <tbody>
            <tr>
              <th>Blokli URL</th>
              <td>
                <BlokliContainer>
                  <TextField
                    value={localBlokliUrl}
                    placeholder="https://blokli.example/"
                    onChange={(event) => {
                      set_localBlokliUrl(event.target.value);
                    }}
                    error={!!blokliUrlError}
                    helperText={
                      blokliUrlError ?? (blokliUrlOverride ? undefined : `Using the URL reported by the node`)
                    }
                  />
                  <BlokliButtons>
                    <Button
                      outlined
                      onClick={handleResetBlokliUrl}
                      disabled={!blokliUrlOverride}
                    >
                      Reset to default
                    </Button>
                    <Button
                      onClick={handleSaveBlokliUrl}
                      disabled={!canSaveBlokliUrl}
                    >
                      Save
                    </Button>
                  </BlokliButtons>
                </BlokliContainer>
              </td>
            </tr>

            <tr>
              <th>Gnosis RPC</th>
              <td>
                <BlokliContainer>
                  <RpcList>
                    {localRpcUrls.length === 0 && <li className="empty">No RPC, spent figures cannot be read</li>}
                    {localRpcUrls.map((url, index) => (
                      <li
                        key={url}
                        draggable
                        className={
                          index === dragRpcIndex
                            ? 'dragging'
                            : dragRpcIndex !== null && index === overRpcIndex
                            ? index < dragRpcIndex
                              ? 'drop-above'
                              : 'drop-below'
                            : ''
                        }
                        onDragStart={(event) => {
                          // Firefox only starts a drag that carries data
                          event.dataTransfer.setData('text/plain', url);
                          event.dataTransfer.effectAllowed = 'move';
                          set_dragRpcIndex(index);
                        }}
                        onDragOver={(event) => {
                          event.preventDefault();
                          set_overRpcIndex(index);
                        }}
                        onDrop={(event) => {
                          event.preventDefault();
                          if (dragRpcIndex !== null) handleMoveRpc(dragRpcIndex, index);
                          endRpcDrag();
                        }}
                        onDragEnd={endRpcDrag}
                      >
                        <DragIndicatorIcon className="handle" />
                        <span className="order">{index + 1}</span>
                        <span
                          className="url"
                          title={url}
                        >
                          {url}
                        </span>
                        <IconButton
                          iconComponent={<DeleteIcon />}
                          tooltipText="Remove"
                          onClick={() => set_localRpcUrls(localRpcUrls.filter((_, i) => i !== index))}
                        />
                      </li>
                    ))}
                  </RpcList>
                  <RpcAdd>
                    <TextField
                      value={newRpcUrl}
                      placeholder="https://rpc.example/"
                      onChange={(event) => {
                        set_newRpcUrl(event.target.value);
                        set_rpcError(null);
                      }}
                      onKeyDown={(event) => {
                        if (event.key === 'Enter' && newRpcUrl) handleAddRpc();
                      }}
                      error={!!rpcError}
                    />
                    <Button
                      onClick={handleAddRpc}
                      disabled={!newRpcUrl}
                    >
                      Add
                    </Button>
                  </RpcAdd>
                  <span
                    style={{
                      alignSelf: 'flex-start',
                      fontSize: 12,
                      color: rpcError || rpcBroken ? 'var(--red)' : 'var(--muted)',
                    }}
                  >
                    {rpcError ??
                      (rpcBroken
                        ? `${RPC_ERROR}: ${rpcUrls.length ? 'every RPC failed' : 'no RPC'}, spent figures are unknown`
                        : 'Reads the channel events behind spent. Tried from the top, the next one takes over when one fails.')}
                  </span>
                  <BlokliButtons>
                    <Button
                      outlined
                      onClick={handleResetRpc}
                      disabled={!canResetRpcUrls}
                    >
                      Reset to default
                    </Button>
                    <Button
                      onClick={handleSaveRpc}
                      disabled={!canSaveRpcUrls}
                    >
                      Save
                    </Button>
                  </BlokliButtons>
                </BlokliContainer>
              </td>
            </tr>
          </tbody>
        </TableExtended>
      </Paper>
    </Section>
  );
}

export default NodeConfigurationPage;
