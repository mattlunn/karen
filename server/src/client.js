import './dayjs';
import React, { lazy, Suspense } from 'react';
import { createRoot } from 'react-dom/client';
import { Route } from 'react-router';
import { Switch, BrowserRouter } from 'react-router-dom';
import { createTheme, MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RealtimeProvider } from './components/realtime-provider';
import AppLayout from './components/app-layout';
import ErrorBoundary from './components/error-boundary';
import PageLoader from './components/page-loader';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import './styles/app.less';

// Lazy load page components for code splitting
const Home = lazy(() => import('./components/pages/home'));
const Timeline = lazy(() => import('./components/pages/timeline'));
const Devices = lazy(() => import('./components/pages/devices'));
const Device = lazy(() => import('./components/pages/device'));
const Login = lazy(() => import('./components/pages/login'));

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      refetchOnMount: false,
      refetchOnWindowFocus: false,
    },
  },
});

const theme = createTheme({
  scale: 0.8,
  colors: {
    karen: [
      '#f2f3f8',
      '#e2e4e9',
      '#c1c7d5',
      '#9ea8c1',
      '#808db0',
      '#6d7da6',
      '#6374a3',
      '#52638f',
      '#485880',
      '#1d2538'
    ]
  },
  primaryColor: 'karen'
});

window.onload = () => {
  const root = createRoot(document.getElementById('main'));

  root.render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider theme={theme}>
        <RealtimeProvider>
          <BrowserRouter>
            <ErrorBoundary>
              <Switch>
                {/* Login route - no layout (no Header/Sidebar) */}
                <Route exact path="/login">
                  <Suspense fallback={<PageLoader />}>
                    <Login />
                  </Suspense>
                </Route>

                {/* All authenticated routes - with layout */}
                <Route path="/">
                  <AppLayout>
                    <Switch>
                      <Route exact path="/" component={Home} />
                      <Route exact path="/timeline" component={Timeline} />
                      <Route exact path="/device/:id" component={Device} />
                      <Route exact path="/device" component={Devices} />
                    </Switch>
                  </AppLayout>
                </Route>
              </Switch>
            </ErrorBoundary>
          </BrowserRouter>
        </RealtimeProvider>
      </MantineProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>,
  );
};
