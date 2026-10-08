import React, { useEffect, useState } from 'react';
//import { useRouter } from 'next/router';
import styled from '@emotion/styled';

//import Sections from '../Sections';
//import LaunchPlaygroundBtn from '../../future-hopr-lib-components/Button/LaunchPlayground';
import MuiAppBar, { AppBarProps as MuiAppBarProps } from '@mui/material/AppBar';
import NavBarItems from './navBarItems';
import { Box, IconButton } from '@mui/material';
import MenuIcon from '@mui/icons-material/Menu';

interface AppBarProps extends MuiAppBarProps {
  tallerNavBarOnMobile?: boolean;
  webapp?: boolean;
}

export const navBarHeight = 52;

const AppBar = styled(({ tallerNavBarOnMobile, webapp, ...rest }: AppBarProps) => <MuiAppBar {...rest} />)`
  background: var(--chrome);
  color: var(--text);
  height: ${navBarHeight}px;
  border-bottom: 1px solid var(--border);
  box-shadow: unset;
  z-index: 1201;
  ${(props) =>
    !props.webapp &&
    `
    padding-left: 16px;
    padding-right: 16px;
  `}
  ${(props) =>
    props.tallerNavBarOnMobile &&
    `
    @media screen and (max-width: 520px) {
      position: static;
    }
  `}
`;

const Container = styled.div<{ webapp?: boolean }>`
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  ${(props) => !props.webapp && 'max-width: 1098px;'}
  width: 100%;
  margin-inline: 8px;
  position: relative;
  .menu {
    display: flex;
    flex-direction: row;
  }
`;

const FlexBox = styled(Box)`
  align-items: center;
  display: flex;
  gap: 8px;

  .MuiIconButton-root {
    height: 36px;
    width: 36px;
    border-radius: 8px;
    &:hover {
      background-color: var(--primary-soft);
      transition: background-color 0.2s ease;
    }
  }
`;

const Center = styled.div`
  flex: 1;
  min-width: 0;
  height: 100%;
  display: flex;
  align-items: center;
  justify-content: center;
  padding: 0 12px;
  @media (max-width: 600px) {
    justify-content: flex-end;
    padding: 0 4px;
  }
`;

const Logo = styled.div`
  width: 90px;
  height: ${navBarHeight}px;
  display: flex;
  align-items: center;
  justify-content: center;
  position: relative;
  /* the logo file is navy, paint its shape in HOPR yellow */
  .logo-mask {
    display: block;
    width: 80px;
    height: 36px;
    background-color: var(--hopr-yellow);
    mask: var(--logo) no-repeat center / contain;
    -webkit-mask: var(--logo) no-repeat center / contain;
  }
  @media screen and (max-width: 600px) {
    width: 64px;
    .logo-mask {
      width: 62px;
      height: 28px;
    }
  }
`;

// drawn over the bottom of the logo, starting just right of the "p" tail
const Edition = styled.span`
  position: absolute;
  top: calc(50% + 11px);
  left: 55px;
  color: var(--hopr-sky-blue);
  font-size: 7.5px;
  font-weight: 700;
  line-height: 1;
  text-transform: uppercase;
  white-space: nowrap;
  pointer-events: none;
  @media screen and (max-width: 600px) {
    display: none;
  }
`;

const NavBar: React.FC<{
  className?: string;
  center?: boolean;
  webapp?: boolean;
  right?: boolean;
  mobile?: boolean;
  mainLogo?: string;
  mainLogoAlt?: string;
  tallerNavBarOnMobile?: boolean;
  itemsNavbarCenter?: any[];
  itemsNavbarRight?: any[];
  centerContent?: React.ReactNode;
  openedNavigationDrawer: boolean;
  onButtonClick?: () => void;
  set_openedNavigationDrawer: (openedNavigationDrawer: boolean) => void;
}> = ({
  className,
  center,
  webapp,
  right,
  mobile,
  mainLogo,
  mainLogoAlt,
  tallerNavBarOnMobile,
  itemsNavbarCenter = [],
  itemsNavbarRight = [],
  centerContent,
  openedNavigationDrawer,
  onButtonClick,
  set_openedNavigationDrawer,
}) => {
  //  const router = useRouter();
  const [activaMenu, setActivaMenu] = useState(false);
  const [isScroll, setIsScroll] = useState(false);
  //const showCoinbase = router.pathname === '/' || router.pathname === '/token';

  const onScrollNavBar = function () {
    if (window.pageYOffset === 0) {
      setIsScroll(false);
    } else {
      setIsScroll(true);
      setActivaMenu(false);
    }
  };

  useEffect(() => {
    window.addEventListener('scroll', onScrollNavBar);
    return () => window.removeEventListener('scroll', onScrollNavBar);
  }, [isScroll]);

  return (
    <>
      <AppBar
        className="Hopr-navBar navbar"
        tallerNavBarOnMobile={tallerNavBarOnMobile}
        webapp={webapp}
      >
        <Container webapp={webapp}>
          <FlexBox>
            <IconButton
              aria-label="Menu"
              onClick={() => set_openedNavigationDrawer(!openedNavigationDrawer)}
            >
              <MenuIcon />
            </IconButton>
            <Logo className="logo-hopr">
              <span
                className="logo-mask logo-hopr-navbar"
                role="img"
                aria-label={mainLogoAlt}
                style={{ '--logo': `url(${mainLogo})` } as React.CSSProperties}
              />
              <Edition>Community edition</Edition>
            </Logo>
          </FlexBox>
          <div
            onClick={() => setActivaMenu(!activaMenu)}
            className={'icon-menu' + (activaMenu ? ' open' : '')}
          >
            <span></span>
          </div>
          <Center>{centerContent}</Center>
          <NavBarItems
            itemsNavbar={itemsNavbarCenter}
            center
            webapp={webapp}
          />
          <NavBarItems
            itemsNavbar={itemsNavbarRight}
            right
            webapp={webapp}
          />
        </Container>
      </AppBar>
      <div className={`menu mobile ${activaMenu ? ' show-menu' : ''}`}>
        <NavBarItems
          //     itemsNavbar={[...itemsNavbarCenter, ...itemsNavbarRight]}
          onButtonClick={() => {
            setActivaMenu(false);
          }}
          mobile
        />
      </div>
    </>
  );
};

export default NavBar;
