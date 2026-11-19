import { useRef } from 'react';
import { useAppDispatch, useAppSelector } from '../../store';
import { appActions } from '../../store/slices/app';
import { exportToCsv } from '../../utils/helpers';
import { getAddress, isAddress } from 'viem';

// HOPR Components
import Section from '../../future-hopr-lib-components/Section';
import { SubpageTitle } from '../../components/SubpageTitle';
import IconButton from '../../future-hopr-lib-components/Button/IconButton';
import RemoveAliasIcon from '../../future-hopr-lib-components/Icons/RemoveAlias';
import TablePro from '../../future-hopr-lib-components/Table/table-pro';
import PeersInfo from '../../future-hopr-lib-components/PeerInfo';
import { WatchCheckbox } from '../../components/NodesTable';

// Modals
import { PingModal } from '../../components/Modal/node/PingModal';
import { CreateAliasModal } from '../../components/Modal/node/AddAliasModal';
import { OpenChannelModal } from '../../components/Modal/node/OpenChannelModal';
import { FundChannelModal } from '../../components/Modal/node/FundChannelModal';
import { OpenSessionModal } from '../../components/Modal/node/OpenSessionModal';

//Mui
import SaveIcon from '@mui/icons-material/Save';
import UploadFileIcon from '@mui/icons-material/UploadFile';

function AliasesPage() {
  const dispatch = useAppDispatch();
  const aliases = useAppSelector((store) => store.app.aliases);
  const watchlist = useAppSelector((store) => store.app.watchlist);
  // the aliases are kept in the browser, only the actions that talk to a node need one
  const connected = useAppSelector((store) => store.auth.status.connected);
  const peersObject = useAppSelector((store) => store.node.peersConnected.parsed.obj);
  const mypeerAddress = useAppSelector((store) => store.node.addresses.data.native);
  const peerAddressToOutgoingChannelLink = useAppSelector((store) => store.node.links.peerAddressToOutgoingChannel);
  // the safes the app knows of: the connected node's and those of the watchlist. Pinging, channels,
  // sessions and watching are for nodes only
  const nodeSafe = useAppSelector((store) => store.node.info.data?.hoprNodeSafe);
  const watchlistData = useAppSelector((store) => store.watchlist.data);
  const safes = new Set<string>(
    [
      nodeSafe,
      ...Object.keys(watchlistData?.nodesBySafe ?? {}),
      ...Object.values(watchlistData?.safeByNode ?? {}),
    ].flatMap((address) => (address && isAddress(address) ? [getAddress(address)] : [])),
  );

  const handleExport = () => {
    exportToCsv(
      Object.keys(aliases).map((address) => ({
        address,
        alias: aliases[address],
      })),
      'aliases.csv',
    );
  };

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const handleCSVUpload = async (parsedData: any[]) => {
    for (const data of parsedData) {
      dispatch(
        appActions.setAlias({
          peerAddress: data.address || data.peerAddress,
          alias: data.alias,
        }),
      );
    }
  };

  const parsedTableData = Object.keys(aliases).map((peerAddress, index) => {
    const alias = aliases[peerAddress];
    const isSafe = safes.has(peerAddress);
    const lastUpdateNumeric = peerAddress ? peersObject[peerAddress]?.lastUpdate : 0;
    const lastUpdate =
      lastUpdateNumeric > 0
        ? new Date(lastUpdateNumeric).toLocaleString('en-US', {
            year: 'numeric',
            month: '2-digit',
            day: '2-digit',
            hour: '2-digit',
            minute: '2-digit',
            timeZoneName: 'short',
          })
        : 'Not seen';

    return {
      id: peerAddress,
      key: index.toString(),
      alias,
      node: <PeersInfo peerAddress={peerAddress} />,
      kind: isSafe ? 'Safe' : 'Node',
      lastUpdate: mypeerAddress === peerAddress || isSafe ? '-' : lastUpdate,
      lastUpdateValue: mypeerAddress === peerAddress || isSafe || !lastUpdateNumeric ? null : lastUpdateNumeric,
      peerAddress: peerAddress,
      watch: isSafe ? null : (
        <WatchCheckbox
          address={peerAddress}
          watched={watchlist.includes(peerAddress)}
        />
      ),
      actions: (
        <>
          {connected && !isSafe && (
            <PingModal
              address={peerAddress}
              disabled={peerAddress === mypeerAddress}
              tooltip={peerAddress === mypeerAddress ? `You can't ping yourself` : undefined}
            />
          )}
          <CreateAliasModal address={peerAddress} />
          {connected &&
            !isSafe &&
            (peerAddress && peerAddressToOutgoingChannelLink[peerAddress] ? (
              <FundChannelModal address={peerAddress} />
            ) : (
              <OpenChannelModal
                peerAddress={peerAddress}
                disabled={peerAddress === mypeerAddress}
                tooltip={peerAddress === mypeerAddress ? `You can't open a channel to yourself` : undefined}
              />
            ))}
          {connected && !isSafe && <OpenSessionModal destination={peerAddress} />}
          <IconButton
            iconComponent={<RemoveAliasIcon />}
            aria-label="delete alias"
            tooltipText={
              <span>
                DELETE
                <br />
                alias
              </span>
            }
            onClick={() => {
              dispatch(appActions.removeAlias(peerAddress));
            }}
          />
        </>
      ),
    };
  });

  const header = [
    {
      key: 'alias',
      name: 'Alias',
      search: true,
      hidden: true,
    },
    {
      key: 'node',
      name: 'Address',
      grow: true,
      sortKey: 'alias',
    },
    {
      key: 'kind',
      name: 'Type',
      search: true,
    },
    // last seen comes from the connected node's peers, meaningless without one
    ...(connected
      ? [
          {
            key: 'lastUpdate',
            name: 'Last update',
            sortKey: 'lastUpdateValue',
          },
        ]
      : []),
    {
      key: 'peerAddress',
      name: 'Address',
      search: true,
      maxWidth: '60px',
      hidden: true,
    },
    {
      key: 'actions',
      name: '',
      search: false,
    },
    {
      key: 'watch',
      name: '',
      search: false,
      sortable: false,
      align: 'center' as const,
    },
  ];

  return (
    <Section
      className="Section--aliases"
      id="Section--aliases"
      fullHeightMin
      yellow
    >
      <SubpageTitle
        title={`ALIASES (${parsedTableData.length})`}
        actions={
          <>
            <CreateAliasModal />
            <CSVUploader onParse={handleCSVUpload} />
            <IconButton
              iconComponent={<SaveIcon />}
              tooltipText={
                <span>
                  EXPORT
                  <br />
                  aliases as a CSV
                </span>
              }
              disabled={Object.keys(aliases).length === 0}
              onClick={handleExport}
            />
          </>
        }
      />
      <TablePro
        data={parsedTableData}
        header={header}
        orderByDefault="alias"
      />
    </Section>
  );
}

/**
 * Represents the expected structure of the parsed data.
 */
type ParsedData = {
  [key: string]: string | number;
};

/**
 * Props for the CSVUploader component.
 */
type CSVUploaderProps<T extends ParsedData> = {
  /**
   * Callback function called when the CSV data is successfully parsed.
   * @param data The parsed data as an array of objects.
   */
  onParse: (data: T[]) => void;
};

/**
 * Component for uploading and parsing CSV data.
 */
function CSVUploader<T extends ParsedData>({ onParse }: CSVUploaderProps<T>) {
  const fileInputRef = useRef<HTMLInputElement>(null);

  /**
   * Handles the file upload event.
   * @param event The file upload event.
   */
  const handleFileUpload = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    const reader = new FileReader();

    reader.onload = (e: ProgressEvent<FileReader>) => {
      const contents = e.target?.result;
      if (typeof contents === 'string') {
        parseCSV(contents);
      }
    };

    if (file) {
      reader.readAsText(file);
    }
  };

  /**
   * Parses the CSV content.
   * @param csvContent The content of the CSV file.
   */
  const parseCSV = (csvContent: string) => {
    const lines = csvContent.split('\n');
    const parsedData: T[] = [];

    // gets all keys, csv hold the headers on the first line
    const header = lines[0].split(',');
    const expectedObjectKeys = header.map((key) => key.trim());

    // loop through each line, get the values and assign the value to the key
    // then push the object to array parsedData
    for (let i = 1; i < lines.length; i++) {
      const values = lines[i].split(',');
      if (values.length > 1) {
        const dataObject: T = {} as T;

        for (let j = 0; j < header.length; j++) {
          const key = expectedObjectKeys[j];
          const value = values[j]?.trim();
          if (expectedObjectKeys.includes(key)) {
            dataObject[key as keyof T] = value as T[keyof T];
          }
        }

        parsedData.push(dataObject);
      }
    }

    // after parsing run callback function
    onParse(parsedData);

    // Reset the file input value
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const handleImportClick = () => {
    fileInputRef.current?.click();
  };

  return (
    <div>
      <IconButton
        iconComponent={<UploadFileIcon />}
        tooltipText={
          <span>
            IMPORT
            <br />
            aliases from a CSV
          </span>
        }
        onClick={handleImportClick}
      />

      {/* hidden import */}
      <input
        type="file"
        accept=".csv"
        style={{ display: 'none' }}
        ref={fileInputRef}
        onChange={handleFileUpload}
        placeholder="import"
      />
    </div>
  );
}

export default AliasesPage;
