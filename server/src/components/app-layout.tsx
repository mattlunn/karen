import React, { ReactNode } from 'react';
import { useLocation } from 'react-router-dom';
import { AppShell } from '@mantine/core';
import Header from './header';
import Sidebar from './sidebar';
import ErrorBoundary from './error-boundary';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  return (
    <AppShell
      header={{ height: 60 }}
      navbar={{
        width: 250,
        breakpoint: 'md',
        collapsed: { mobile: !isHome }
      }}
      padding={isHome ? 0 : 'md'}
    >
      <AppShell.Header>
        <Header />
      </AppShell.Header>

      <AppShell.Navbar className="sidebar">
        <Sidebar />
      </AppShell.Navbar>

      <AppShell.Main>
        <ErrorBoundary>
          {children}
        </ErrorBoundary>
      </AppShell.Main>
    </AppShell>
  );
}
