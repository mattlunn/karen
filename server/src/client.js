import './moment';
import React from 'react';
import { createRoot } from 'react-dom/client';
import Timeline from './components/pages/timeline';
import Home from './components/pages/home';
import Devices from './components/pages/devices';
import Device from './components/pages/device';
import Login from './components/pages/login';
import { Route } from 'react-router';
import { Switch, BrowserRouter } from 'react-router-dom';
import { onError } from '@apollo/client/link/error';
import { getMainDefinition } from '@apollo/client/utilities';
import { 
  ApolloClient,
  ApolloLink,
  ApolloProvider,
  HttpLink,
  InMemoryCache,
  split
} from '@apollo/client';
import possibleTypes from './possible-types.json';
import { GraphQLWsLink } from '@apollo/client/link/subscriptions';
import { createClient } from 'graphql-ws';

import './styles/app.less';

const wsLink = new GraphQLWsLink(createClient({
  url: `ws${location.protocol.slice(4)}//${location.host}/graphql`,
}));

const httpLink = new HttpLink({
  uri: '/graphql',
  credentials: 'same-origin'
});

const client = new ApolloClient({
  link: ApolloLink.from([
    onError(({ networkError }) => {
      if (networkError && networkError.statusCode === 401) {
        location.assign('/login');
      }
    }),
    split(
      ({ query }) => {
        const definition = getMainDefinition(query);
        return (
          definition.kind === 'OperationDefinition' &&
          definition.operation === 'subscription'
        );
      },
      wsLink,
      httpLink
    )
  ]),
  cache: new InMemoryCache({
    possibleTypes,
    typePolicies: {
      Security: {
        keyFields: []
      },
      Heating: {
        keyFields: []
      }
    }
  })
});

window.onload = () => {
  const root = createRoot(document.getElementById('main'));

  root.render(
    <ApolloProvider client={client}>
      <BrowserRouter>
        <Switch>
          <Route exact path="/" component={Home}/>
          <Route exact path="/login" component={Login}/>
          <Route exact path="/timeline" component={Timeline}/>
          <Route exact path="/device/:id" component={Device}/>
          <Route exact path="/device" component={Devices}/>
        </Switch>
      </BrowserRouter>
    </ApolloProvider>,
  );
};