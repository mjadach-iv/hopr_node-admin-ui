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
  color: #a00000;
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
  gap: 2rem;
  max-width: 1080px;
  padding: 2rem;
`;

const ImageContainer = styled.div`
  min-height: 256px;
  min-width: 512px;
  padding: 1rem;
  @media screen and (max-height: 1025px) {
    height: 128px;
    width: 256;
  }
`;

const Image = styled.img`
  display: block;
  height: 100%;
  width: 100%;
`;

const Title = styled.h2`
  color: #414141;
  font-size: 80px;
  font-weight: 400;
  margin-block: 1rem;
  text-transform: uppercase;
`;

const Description = styled.p`
  color: #414141;
  font-size: 18px;
  font-weight: 600;
  margin: 0;
  max-width: 74ch;
`;

const Disclaimer = styled.p`
  background-color: rgba(255, 255, 255, 0.6);
  border-left: 4px solid #ff0000;
  border-radius: 4px;
  color: #414141;
  font-size: 15px;
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
  color: #0000b4;
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
        <ImageContainer>
          <Image src="/assets/blue_HOPR_Node.svg" />
        </ImageContainer>
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
