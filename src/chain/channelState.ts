import { toEventSelector } from 'viem';

// HoprChannels v5 events, each with the channel id as topics[1] and the channel state as data
export const TICKET_REDEEMED = toEventSelector('TicketRedeemed(bytes32,bytes32)');
// topics[2] and topics[3] are the source and destination
export const CHANNEL_OPENED = toEventSelector('ChannelOpened(bytes32,address,address,bytes32)');
// every event that moves a channel's state, a redemption comes as ChannelBalanceDecreased then TicketRedeemed
export const CHANNEL_STATE_EVENTS = new Set<string>([
  TICKET_REDEEMED,
  CHANNEL_OPENED,
  toEventSelector('ChannelBalanceIncreased(bytes32,bytes32)'),
  toEventSelector('ChannelBalanceDecreased(bytes32,bytes32)'),
  toEventSelector('ChannelClosed(bytes32,bytes32)'),
  toEventSelector('OutgoingChannelClosureInitiated(bytes32,bytes32)'),
]);

const BALANCE_MASK = (BigInt(1) << BigInt(96)) - BigInt(1);
const EPOCH_MASK = (BigInt(1) << BigInt(24)) - BigInt(1);
const EPOCH_SHIFT = BigInt(176);

// where a scan of a channels contract starts: the HoprChannels deployments, lowercase
export const CHANNELS_FIRST_BLOCK: Record<string, number> = {
  '0x75ce59332721e3ae3064cb9652bce35ffce3f8e6': 48530952, // piz-palu-prod
  '0x3480caf9bc8874f4c7e3fc4a62eab681b643b137': 47638474, // piz-palu-staging
  '0xced2bbe29c66b40e17eca63214c58506c53f1686': 47637970, // piz-palu-dev
  '0xe3322b0601a2ff1402801ebb22a2a7be599d9620': 47637970, // piz-palu-dev
  '0x860f50b24ba6a862736c5045747323e03aa52aa4': 47415377, // jura-prod
  '0x9ff5bc389a7f8096c9e3a27897c470970f4b595c': 48060435, // jura-staging
  '0x01be530efb04dc7919d77722e647ce4b5c26a5db': 48060435, // jura-staging
  '0xd8c91008c68cd87e7c52ea1a2c6f6dc6a5236008': 47415331, // jura-dev
};
// before every v5 deployment, for a channels contract missing above
export const HOPR_FIRST_BLOCK = 47_400_000;

export const channelsFirstBlock = (channelsContract: string) =>
  CHANNELS_FIRST_BLOCK[channelsContract.toLowerCase()] ?? HOPR_FIRST_BLOCK;

export type ChannelState = { balance: bigint; epoch: bigint };

// every HoprChannels event carries the channel state packed as status | epoch | closureTime | ticketIndex | balance
export const unpack = (data: string): ChannelState => {
  const packed = BigInt(data);
  return {
    balance: packed & BALANCE_MASK,
    epoch: (packed >> EPOCH_SHIFT) & EPOCH_MASK,
  };
};
