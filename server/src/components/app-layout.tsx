import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from '@mantine/core';
import { useDisclosure, useMediaQuery } from '@mantine/hooks';
import Header from './header';
import HouseStatus from './house-status';
import NavLinks from './nav-links';
import ErrorBoundary from './error-boundary';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';
  const [sidebarOpened, { toggle: toggleSidebar, close: closeSidebar }] = useDisclosure(false);
  const isDesktop = useMediaQuery('(min-width: 62em)');

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 300,
        breakpoint: 'md',
        collapsed: { mobile: !sidebarOpened }
      }}
      padding={isHome ? 0 : 'md'}
      withBorder={false}
    >
      <AppShell.Header>
        <Header sidebarOpened={sidebarOpened} toggleSidebar={toggleSidebar} />
      </AppShell.Header>

      <AppShell.Navbar>
        {!isDesktop && <NavLinks vertical onNavigate={closeSidebar} />}
        {isDesktop && <HouseStatus />}
      </AppShell.Navbar>

      <AppShell.Main>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </AppShell.Main>
    </AppShell>
  );
}
