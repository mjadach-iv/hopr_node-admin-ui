import { useAppSelector } from '../../../store';
import { Amount, Card, KV, short } from './ui';

/**
 * Ticket values the node keeps since its last DB reset, and its on-chain redemption count.
 */
function Tickets() {
  const statistics = useAppSelector((store) => store.node.statistics.data);
  const ticketRedemption = useAppSelector((store) => store.blokli.ticketRedemption.data);

  return (
    <Card title="Tickets">
      <KV
        label="Unredeemed"
        tip="The value of all your unredeemed tickets. Counted from the last DB reset."
        title={statistics?.unredeemedValue}
      >
        <Amount
          value={short(statistics?.unredeemedValue)}
          unit="wxHOPR"
        />
      </KV>
      <KV
        label="Neglected"
        tip="The value of tickets lost because their channels closed without redeeming them. Counted from the last DB reset."
        title={statistics?.neglectedValue}
      >
        <Amount
          value={short(statistics?.neglectedValue)}
          unit="wxHOPR"
        />
      </KV>
      <KV
        label="Rejected"
        tip="The value of tickets that failed validation. Counted from the last DB reset."
        title={statistics?.rejectedValue}
      >
        <Amount
          value={short(statistics?.rejectedValue)}
          unit="wxHOPR"
        />
      </KV>
      <KV
        label="Redemptions"
        tip="The number of on-chain ticket redemptions made by this node, all time. Read from blokli."
      >
        <Amount
          value={ticketRedemption?.redemptionCount ?? '-'}
          unit="tickets"
        />
      </KV>
    </Card>
  );
}

export default Tickets;
