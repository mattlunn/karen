import React, { ReactNode, Suspense } from 'react';
import { useLocation } from 'react-router-dom';
import classnames from 'classnames';
import Header from './header';
import Sidebar from './sidebar';
import ErrorBoundary from './error-boundary';
import PageLoader from './page-loader';

interface AppLayoutProps {
  children: ReactNode;
}

export default function AppLayout({ children }: AppLayoutProps) {
  const location = useLocation();
  const isHome = location.pathname === '/';

  // Hide sidebar on mobile for all pages except home
  const hideSidebarOnMobile = !isHome;

  return (
    <div>
      <Header />
      <div>
        <Sidebar hideOnMobile={hideSidebarOnMobile} />
        <ErrorBoundary>
          <Suspense fallback={<PageLoader />}>
            <div className={classnames('body', { 'body--with-padding': !isHome })}>
              {children}
            </div>
          </Suspense>
        </ErrorBoundary>
      </div>
    </div>
  );
}
