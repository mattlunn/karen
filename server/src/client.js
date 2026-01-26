import './dayjs';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Timeline from './components/pages/timeline';
import Home from './components/pages/home';
import Devices from './components/pages/devices';
import Device from './components/pages/device';
import Login from './components/pages/login';
import { Route } from 'react-router';
import { Switch, BrowserRouter } from 'react-router-dom';
import { createTheme, MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';
import { RealtimeProvider } from './components/realtime-provider';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import './styles/app.less';

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
            <Switch>
              <Route exact path="/" component={Home}/>
              <Route exact path="/login" component={Login}/>
              <Route exact path="/timeline" component={Timeline}/>
              <Route exact path="/device/:id" component={Device}/>
              <Route exact path="/device" component={Devices}/>
            </Switch>
          </BrowserRouter>
        </RealtimeProvider>
      </MantineProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>,
  );
};
