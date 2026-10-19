import { useEffect, useState, KeyboardEvent } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { exportToFile } from '../../utils/helpers';
import yaml from 'js-yaml';

// HOPR Components
import { SubpageTitle } from '../../components/SubpageTitle';
import { TableExtended } from '../../future-hopr-lib-components/Table/columed-data';
import Section from '../../future-hopr-lib-components/Section';
import Button from '../../future-hopr-lib-components/Button';
import CodeCopyBox from '../../components/Code/CodeCopyBox';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';

// Mui
import { Paper, Switch } from '@mui/material';
import styled from '@emotion/styled';
import { appActions } from '../../store/slices/app';
import GetAppIcon from '@mui/icons-material/GetApp';

const NotificationsContainer = styled.div`
  display: flex;
  flex-direction: column;
  gap: 1rem;
`;

const NotConnected = styled.span`
  font-size: 12px;
  color: var(--muted);
`;

function AdminConfigurationPage() {
  const dispatch = useAppDispatch();
  const connected = useAppSelector((store) => store.auth.status.connected);
  const prevNotificationSettings = useAppSelector((store) => store.app.configuration.notifications);
  const strategy = useAppSelector((store) => store.node.configuration.data?.strategy);
  const configuration = useAppSelector((store) => store.node.configuration.data);
  const mypeerAddress = useAppSelector((store) => store.node.addresses.data.native);
  const [strategiesString, set_strategiesString] = useState<string | null>(null);
  const [configurationString, set_configurationString] = useState<string | null>(null);
  const [localNotificationSettings, set_localNotificationSettings] = useState(prevNotificationSettings);
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
    if (!strategy) {
      set_strategiesString(null);
      return;
    }

    const strategyTMP = { strategy: JSON.parse(JSON.stringify(strategy)) };
    delete strategyTMP.strategy['parsedStrategies'];

    try {
      let strategiesString = yaml.dump(strategyTMP);

      // * Add ! in front of the strategy name to make yaml copy-paste friendly
      const strategiesSet: string[] = [];
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
      console.warn('Error while formatting the strategy.', e);
    }
  }, [strategy]);

  useEffect(() => {
    if (!configuration) {
      set_configurationString(null);
      return;
    }
    const tmp = JSON.parse(JSON.stringify(configuration));
    delete tmp['strategy'];
    set_configurationString(yaml.dump(tmp));
  }, [configuration]);

  function handleSaveSettings() {
    if (localNotificationSettings) {
      dispatch(appActions.setNotificationSettings(localNotificationSettings));
    }
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
      className="Section--admin-configuration"
      id="Section--admin-configuration"
      fullHeightMin
      yellow
    >
      <SubpageTitle title="NODE ADMIN CONFIGURATION" />
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
          title="Node admin"
          style={{ marginBottom: '32px' }}
        >
          <tbody>
            <tr>
              <th>Notifications</th>
              <td>
                <NotificationsContainer>
                  <div>
                    Channels: False
                    <Switch
                      checked={localNotificationSettings?.channels}
                      onChange={() => {
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
                  disabled={!connected || !strategiesString}
                  onClick={handleExport}
                />
              </th>
              <td>
                {connected && strategiesString ? (
                  <CodeCopyBox
                    code={strategiesString}
                    breakSpaces
                  />
                ) : (
                  <NotConnected>Connect to a node to see its strategy</NotConnected>
                )}
              </td>
            </tr>
            <tr>
              <th>Configuration</th>
              <td>
                {connected && configurationString ? (
                  <CodeCopyBox
                    code={configurationString}
                    breakSpaces
                  />
                ) : (
                  <NotConnected>Connect to a node to see its configuration</NotConnected>
                )}
              </td>
            </tr>
          </tbody>
        </TableExtended>
      </Paper>
    </Section>
  );
}

export default AdminConfigurationPage;
