import styled from '@emotion/styled';

// HOPR Components
import Section from '../../future-hopr-lib-components/Section';
import { SubpageTitle } from '../../components/SubpageTitle';

const ComingSoon = styled.div`
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  gap: 8px;
  width: 100%;
  padding: 96px 16px;
  text-align: center;
  h3 {
    margin: 0;
    color: var(--text);
    font-size: clamp(28px, 6vw, 48px);
    font-weight: 650;
    letter-spacing: 0.08em;
    text-transform: uppercase;
  }
  p {
    margin: 0;
    color: var(--muted);
    font-size: 14px;
  }
`;

function WatchlistPage() {
  return (
    <Section
      className="Section--watchlist"
      id="Section--watchlist"
      fullHeightMin
      yellow
    >
      <SubpageTitle title="WATCHLIST" />
      <ComingSoon>
        <h3>Coming soon</h3>
        <p>Keep an eye on the nodes you care about, without connecting to them.</p>
      </ComingSoon>
    </Section>
  );
}

export default WatchlistPage;
