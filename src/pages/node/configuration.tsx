import { useEffect, useState, KeyboardEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { formatEther } from 'viem';
import { rounder, rounder2 } from '../../utils/functions';
import { exportToFile } from '../../utils/helpers';
import yaml from 'js-yaml';

// HOPR Components
import { SubpageTitle } from '../../components/SubpageTitle';
import { TableExtended } from '../../future-hopr-lib-components/Table/columed-data';
import Section from '../../future-hopr-lib-components/Section';
import Button from '../../future-hopr-lib-components/Button';
import CodeCopyBox from '../../components/Code/CodeCopyBox';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';
import TextField from '../../future-hopr-lib-components/TextField';

// Mui
import { Paper, Switch } from '@mui/material';
import styled from '@emotion/styled';
import { appActions } from '../../store/slices/app';
import { blokliActions } from '../../store/slices/blokli';
import { selectBlokliUrl } from '../../store/selectors/blokli';
import { parseAndFormatUrl } from '../../utils/parseAndFormatUrl';
import GetAppIcon from '@mui/icons-material/GetApp';
import DragIndicatorIcon from '@mui/icons-material/DragIndicator';
import DeleteIcon from '@mui/icons-material/Delete';
import { RPC_ERROR, GNOSIS_RPC_URLS } from '../../../config';

const NotificationsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

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

const DECIMALS_MULTIPLIER = BigInt(1e18); // For HOPR token's 18 decimals

interface StrategyConfig {
  path: ['AutoFunding' | 'AutoRedeeming', string];
  value: string;
}

const calculateTickets = (value: string, ticketPrice: string) => {
  console.log({ value, ticketPrice });
  const valueBigInt = BigInt(value);
  const ticketBigInt = BigInt(ticketPrice);
  return valueBigInt / ticketBigInt;
};

const updateStrategyString = (originalString: string, key: string, value: string, tickets: bigint): string => {
  const stringToReplace = `"${key}": "${value} HOPR"`;
  const formattedEther = formatEther(BigInt(value));
  const replacement = `"${key}": "${value}" // = ${formattedEther} wxHOPR (${rounder(Number(tickets))} tickets)`;

  return originalString.includes(stringToReplace + ',')
    ? originalString.replace(stringToReplace + ',', replacement + ',')
    : originalString.replace(stringToReplace, replacement);
};

function SettingsPage() {
  const dispatch = useAppDispatch();
  const prevNotificationSettings = useAppSelector((store) => store.app.configuration.notifications);
  const aliasMergeMode = useAppSelector((store) => store.app.configuration.aliases.mergeMode);
  const blokliUrlOverride = useAppSelector((store) => store.blokli.url);
  const effectiveBlokliUrl = useAppSelector(selectBlokliUrl) ?? '';
  const strategy = useAppSelector((store) => store.node.configuration.data?.strategy);
  const configuration = useAppSelector((store) => store.node.configuration.data);
  const ticketPrice = useAppSelector((store) => store.node.ticketPrice.data);
  const mypeerAddress = useAppSelector((store) => store.node.addresses.data.native);
  const [strategiesString, set_strategiesString] = useState<string | null>(null);
  const [configurationString, set_configurationString] = useState<string | null>(null);
  const [localNotificationSettings, set_localNotificationSettings] = useState<typeof prevNotificationSettings>();
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
  const canSave = !(
    localNotificationSettings?.channels === prevNotificationSettings.channels &&
    localNotificationSettings?.message === prevNotificationSettings.message &&
    localNotificationSettings?.nodeBalances === prevNotificationSettings.nodeBalances &&
    localNotificationSettings?.nodeInfo === prevNotificationSettings.nodeInfo &&
    localNotificationSettings?.pendingSafeTransaction === prevNotificationSettings.pendingSafeTransaction
  );

  useEffect(() => {
    window.addEventListener('keydown', handleEnter as unknown as EventListener);
    return () => {
      window.removeEventListener('keydown', handleEnter as unknown as EventListener);
    };
  }, [localNotificationSettings]);

  useEffect(() => {
    if (prevNotificationSettings) {
      set_localNotificationSettings(prevNotificationSettings);
    }
  }, [prevNotificationSettings]);

  useEffect(() => {
    set_localBlokliUrl(effectiveBlokliUrl);
    set_blokliUrlError(null);
  }, [effectiveBlokliUrl]);

  useEffect(() => {
    set_localRpcUrls(rpcUrls);
  }, [rpcUrls]);

  // Usage in useEffect
  useEffect(() => {
    if (!strategy || !ticketPrice) return;

    const strategyTMP = { strategy: JSON.parse(JSON.stringify(strategy)) };
    delete strategyTMP.strategy['parsedStrategies'];

    try {
      const configs: StrategyConfig[] = [
        {
          path: ['AutoFunding', 'min_stake_threshold'],
          value: strategy.strategies?.AutoFunding?.min_stake_threshold?.replace(' wxHOPR', ''),
        },
        {
          path: ['AutoFunding', 'funding_amount'],
          value: strategy.strategies?.AutoFunding?.funding_amount?.replace(' wxHOPR', ''),
        },
        {
          path: ['AutoRedeeming', 'minimum_redeem_ticket_value'],
          value: strategy.strategies?.AutoRedeeming?.minimum_redeem_ticket_value?.replace(' wxHOPR', ''),
        },
        {
          path: ['AutoRedeeming', 'on_close_redeem_single_tickets_value_min'],
          value: strategy.strategies?.AutoRedeeming?.on_close_redeem_single_tickets_value_min?.replace(' wxHOPR', ''),
        },
      ];

      let strategiesString = yaml.dump(strategyTMP);

      // * Add ! in front of the strategy name to make yaml copy-paste friendly
      const strategiesSet = [];
      if (strategyTMP.strategy.strategies) {
        for (let i = 0; i < strategyTMP.strategy.strategies.length; i++) {
          const strategyName = Object.keys(strategyTMP.strategy.strategies[i])[0];
          strategiesSet.push(strategyName);
          try {
            const strategyDetails = strategyTMP.strategy.strategies[i][strategyName];
            const strategyDetailsKeys = Object.keys(strategyDetails);
            for (const key of strategyDetailsKeys) {
              const strategyValue = strategyDetails[key];
              if (typeof strategyValue !== 'string') continue;
              if (
                strategyValue.includes(' wxHOPR') ||
                strategyValue.includes('>') ||
                strategyValue.includes('<') ||
                strategyValue.includes('=')
              ) {
                strategiesString = strategiesString.replace(`${key}: ${strategyValue}`, `${key}: "${strategyValue}"`);
              }
            }
          } catch (e) {
            console.warn(`Error while processing strategy details for ${strategyName}`, e);
          }
        }
      }
      strategiesSet.forEach((strategyName) => {
        strategiesString = strategiesString.replace(`- ${strategyName}:`, `- !${strategyName}`);
      });
      // **********************************************************************

      set_strategiesString(strategiesString);
    } catch (e) {
      console.warn('Error while counting strategies against current ticket price.', e);
    }
  }, [strategy, ticketPrice]);

  useEffect(() => {
    if (configuration) {
      let tmp = JSON.parse(JSON.stringify(configuration));
      tmp['strategy'] && delete tmp['strategy'];
      tmp = yaml.dump(tmp);
      set_configurationString(tmp);
    }
  }, [configuration]);

  function handleSaveSettings() {
    if (localNotificationSettings) {
      dispatch(appActions.setNotificationSettings(localNotificationSettings));
    }
  }

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

  // the 2 merge options are exclusive, turning the active one off means no merging at all
  function handleAliasMergeToggle(mode: 'network' | 'all') {
    dispatch(appActions.setAliasSettings({ mergeMode: aliasMergeMode === mode ? 'none' : mode }));
  }

  function handleEnter(event: KeyboardEvent) {
    if (canSave && event.key === 'Enter') {
      handleSaveSettings();
    }
  }

  const handleExport = () => {
    if (strategiesString) {
      exportToFile(strategiesString, `strategy-${mypeerAddress}.yaml`, 'text/yaml');
    }
  };

  return (
    <Section
      className="Section--settings"
      id="Section--settings"
      fullHeightMin
      yellow
    >
      <SubpageTitle title="CONFIGURATION" />
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

            <tr>
              <th>Notifications</th>
              <td>
                <NotificationsContainer>
                  <div>
                    Channels: False
                    <Switch
                      checked={localNotificationSettings?.channels}
                      onChange={() => {
                        console.log('localNotificationSettings', localNotificationSettings);
                        if (localNotificationSettings) {
                          set_localNotificationSettings({
                            ...localNotificationSettings,
                            channels: !localNotificationSettings.channels,
                          });
                        }
                      }}
                      color="primary"
                    />{' '}
                    True
                  </div>
                  {/* <div>
                    Message: False
                    <Switch
                      checked={localNotificationSettings?.message}
                      onChange={() => {
                        if (localNotificationSettings) {
                          set_localNotificationSettings({
                            ...localNotificationSettings,
                            message: !localNotificationSettings.message,
                          });
                        }
                      }}
                      color="primary"
                    />{' '}
                    True
                  </div> */}
                  <div>
                    Node Balance: False
                    <Switch
                      checked={localNotificationSettings?.nodeBalances}
                      onChange={() => {
                        if (localNotificationSettings) {
                          set_localNotificationSettings({
                            ...localNotificationSettings,
                            nodeBalances: !localNotificationSettings.nodeBalances,
                          });
                        }
                      }}
                      color="primary"
                    />{' '}
                    True
                  </div>
                  <div>
                    Node Info: False
                    <Switch
                      checked={localNotificationSettings?.nodeInfo}
                      onChange={() => {
                        if (localNotificationSettings) {
                          set_localNotificationSettings({
                            ...localNotificationSettings,
                            nodeInfo: !localNotificationSettings.nodeInfo,
                          });
                        }
                      }}
                      color="primary"
                    />{' '}
                    True
                  </div>
                </NotificationsContainer>
                <Button
                  style={{
                    marginTop: '1rem',
                    float: 'right',
                  }}
                  onClick={handleSaveSettings}
                  disabled={!canSave}
                >
                  Save
                </Button>
              </td>
            </tr>

            <tr>
              <th>Aliases</th>
              <td>
                <NotificationsContainer>
                  <div>
                    Merge aliases between nodes on the same network: False
                    <Switch
                      checked={aliasMergeMode === 'network'}
                      onChange={() => {
                        handleAliasMergeToggle('network');
                      }}
                      color="primary"
                    />{' '}
                    True
                  </div>
                  <div>
                    Merge aliases between all saved nodes: False
                    <Switch
                      checked={aliasMergeMode === 'all'}
                      onChange={() => {
                        handleAliasMergeToggle('all');
                      }}
                      color="primary"
                    />{' '}
                    True
                  </div>
                </NotificationsContainer>
              </td>
            </tr>

            <tr>
              <th>
                Strategy
                <IconButton
                  iconComponent={<GetAppIcon />}
                  tooltipText={
                    <span>
                      EXPORT
                      <br />
                      Strategy
                    </span>
                  }
                  onClick={handleExport}
                />
              </th>
              <td>
                {strategiesString && (
                  <CodeCopyBox
                    code={strategiesString}
                    breakSpaces
                  />
                )}
              </td>
            </tr>
            <tr>
              <th>Configuration</th>
              <td>
                {configurationString && (
                  <CodeCopyBox
                    code={configurationString}
                    breakSpaces
                  />
                )}
              </td>
            </tr>
          </tbody>
        </TableExtended>
      </Paper>
    </Section>
  );
}

export default SettingsPage;
