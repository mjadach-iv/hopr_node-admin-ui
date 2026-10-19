import { useEffect, useState } from 'react';
import { useAppSelector } from '../../store';
import { exportToFile } from '../../utils/helpers';
import yaml from 'js-yaml';

// HOPR Components
import { SubpageTitle } from '../../components/SubpageTitle';
import { TableExtended } from '../../future-hopr-lib-components/Table/columed-data';
import Section from '../../future-hopr-lib-components/Section';
import CodeCopyBox from '../../components/Code/CodeCopyBox';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';

// Mui
import { Paper } from '@mui/material';
import GetAppIcon from '@mui/icons-material/GetApp';

function NodeConfigurationPage() {
  const strategy = useAppSelector((store) => store.node.configuration.data?.strategy);
  const configuration = useAppSelector((store) => store.node.configuration.data);
  const mypeerAddress = useAppSelector((store) => store.node.addresses.data.native);
  const [strategiesString, set_strategiesString] = useState<string | null>(null);
  const [configurationString, set_configurationString] = useState<string | null>(null);

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
                  disabled={!strategiesString}
                  onClick={handleExport}
                />
              </th>
              <td>
                {strategiesString && (
                  <CodeCopyBox
                    code={strategiesString}
                    breakSpaces
                    small
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
                    small
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

export default NodeConfigurationPage;
