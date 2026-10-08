import styled from '@emotion/styled';
import { useAppDispatch, useAppSelector } from '../../store';
import { authActions } from '../../store/slices/auth';
import Button from '../../future-hopr-lib-components/Button';
import Section from '../../future-hopr-lib-components/Section';
import { Link } from 'react-router-dom';

const LandingSection = styled(Section)`
  position: relative;
`;

const CommunityEdition = styled.div`
  position: absolute;
  top: 140px;
  right: -30px;
  transform: rotate(45deg);
  color: var(--hopr-sky-blue);
  opacity: 0.55;
  font-size: 32px;
  font-weight: 700;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
  @media screen and (max-width: 600px) {
    top: 84px;
    right: -20px;
    font-size: 18px;
  }
`;

const StyledContainer = styled.div`
  align-items: center;
  text-align: center;
  display: flex;
  flex-direction: column;
  gap: 1.5rem;
  max-width: 1080px;
  padding: 2rem 0;
  @media screen and (max-width: 600px) {
    gap: 1.25rem;
    padding: 1rem 0;
  }
`;

// the drawing is navy, paint its shape in HOPR yellow
const Image = styled.div`
  width: min(420px, 80vw);
  height: 200px;
  background-color: var(--hopr-yellow);
  mask: url('/assets/blue_HOPR_Node.svg') no-repeat center / contain;
  -webkit-mask: url('/assets/blue_HOPR_Node.svg') no-repeat center / contain;
  @media screen and (max-height: 1025px), screen and (max-width: 600px) {
    height: 128px;
  }
`;

const Title = styled.h2`
  color: var(--text);
  font-size: clamp(36px, 10vw, 72px);
  font-weight: 650;
  letter-spacing: -0.01em;
  margin: 0;
  text-transform: uppercase;
`;

const Description = styled.p`
  color: var(--text-2);
  font-size: 16px;
  line-height: 1.5;
  margin: 0;
  max-width: 74ch;
`;

const Disclaimer = styled.p`
  background-color: var(--surface);
  border: 1px solid var(--border);
  border-left: 3px solid var(--red);
  border-radius: 8px;
  color: var(--text-2);
  font-size: 14px;
  line-height: 1.5;
  margin: 0;
  max-width: 74ch;
  padding: 12px 16px;
  text-align: left;
`;

const Links = styled.div`
  display: flex;
  gap: 1rem;
`;

const StyledButton = styled(Button)`
  align-self: center;
  text-transform: uppercase;
  padding-inline: 2rem;
`;

const StyledLink = styled(Link)`
  color: var(--hopr-sky-blue);
  font-weight: 700;
  text-decoration: underline;
`;

function LandingPage() {
  const dispatch = useAppDispatch();
  const nodeConnected = useAppSelector((store) => store.auth.status.connected);

  return (
    <LandingSection
      className="Section--logs"
      id="Section--logs"
      fullHeightMin
      yellow
      center
    >
      <CommunityEdition>Community edition</CommunityEdition>
      <StyledContainer>
        <Image
          role="img"
          aria-label="HOPR node"
        />
        <Title>Node Admin</Title>
        <Description>
          HOPR Node Admin allows at-a-glance access to the crucial information of a HOPR Node. It provides users with a
          comprehensive overview of the key data, metrics, settings, and messages if required.
        </Description>
        <Disclaimer>
          <strong>Disclaimer:</strong> This is a community project, provided "as is", without warranty of any kind. Use
          it at your own risk. No one — neither the authors nor the contributors — is responsible for any loss of funds
          or other damages resulting from its use.
        </Disclaimer>
        {!nodeConnected && (
          <StyledButton
            onClick={() => {
              dispatch(authActions.setOpenLoginModalToNode(true));
              setTimeout(() => {
                dispatch(authActions.setOpenLoginModalToNode(false)), 300;
              });
            }}
          >
            Connect to Node
          </StyledButton>
        )}
        <Links>
          <StyledLink to="https://docs.hoprnet.org">Docs</StyledLink>
          <StyledLink to="https://t.me/hoprnet">Telegram</StyledLink>
        </Links>
      </StyledContainer>
    </LandingSection>
  );
}

export default LandingPage;
