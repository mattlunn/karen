import React, { ReactNode, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import Header from './header';
import Sidebar from './sidebar';
import ErrorBoundary from './error-boundary';
import PageLoader from './page-loader';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();

  // Hide sidebar on mobile for all pages except home
  const hideSidebarOnMobile = location.pathname !== '/';

  return (
    <div>
      <Header />
      <div>
        <Sidebar hideOnMobile={hideSidebarOnMobile} />
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            {children}
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
