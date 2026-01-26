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
import { MantineProvider } from '@mantine/core';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { ReactQueryDevtools } from '@tanstack/react-query-devtools';

import '@mantine/core/styles.css';
import '@mantine/dates/styles.css';
import './styles/app.less';

const queryClient = new QueryClient();

window.onload = () => {
  const root = createRoot(document.getElementById('main'));

  root.render(
    <QueryClientProvider client={queryClient}>
      <MantineProvider>
        <BrowserRouter>
          <Switch>
            <Route exact path="/" component={Home}/>
            <Route exact path="/login" component={Login}/>
            <Route exact path="/timeline" component={Timeline}/>
            <Route exact path="/device/:id" component={Device}/>
            <Route exact path="/device" component={Devices}/>
          </Switch>
        </BrowserRouter>
      </MantineProvider>
      {process.env.NODE_ENV === 'development' && <ReactQueryDevtools />}
    </QueryClientProvider>,
  );
};
