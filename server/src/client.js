import './moment';
import React from 'react';
import ReactDOM from 'react-dom';
import Timeline from './components/pages/timeline';
import Home from './components/pages/home';
import Devices from './components/pages/devices';
import Device from './components/pages/device';
import Login from './components/pages/login';
import History from './components/pages/history';
import thunk from 'redux-thunk';
import { Route } from 'react-router';
import { Switch } from 'react-router-dom';
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { ConnectedRouter, routerReducer, routerMiddleware, push } from 'react-router-redux';
import createHistory from 'history/createBrowserHistory';
import { Provider } from 'react-redux';

import user from './reducers/user';
import modal from './reducers/modal';

import { library } from '@fortawesome/fontawesome-svg-core';
import { faLightbulb } from '@fortawesome/free-regular-svg-icons/faLightbulb';
import { faWalking } from '@fortawesome/free-solid-svg-icons/faWalking';
import { faVideo } from '@fortawesome/free-solid-svg-icons/faVideo';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';
import { faBell } from '@fortawesome/free-solid-svg-icons/faBell';

import { ApolloClient } from 'apollo-client';
import { InMemoryCache } from 'apollo-cache-inmemory';
import { onError } from 'apollo-link-error';
import { ApolloLink } from 'apollo-link';
import { ApolloProvider } from '@apollo/react-components';
import { split } from 'apollo-link';
import { HttpLink } from 'apollo-link-http';
import { WebSocketLink } from 'apollo-link-ws';
import { getMainDefinition } from 'apollo-utilities';
import { IntrospectionFragmentMatcher } from 'apollo-cache-inmemory';
import introspectionQueryResultData from './fragment-types.json';

library.add(faLightbulb, faVideo, faHome, faWalking, faBell);

import './styles/app.less';
import 'react-vis/dist/style.css';

const wsLink = new WebSocketLink({
  uri: `ws${location.protocol.slice(4)}//${location.hostname}/graphql`,
  options: {
    reconnect: true
  },
  credentials: 'same-origin'
});

const httpLink = new HttpLink({
  uri: '/graphql',
  credentials: 'same-origin'
});

const client = new ApolloClient({
  link: ApolloLink.from([
    onError(({ networkError }) => {
      if (networkError && networkError.statusCode === 401) {
        store.dispatch(push('/login'));
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
    fragmentMatcher: new IntrospectionFragmentMatcher({
      introspectionQueryResultData
    })
  })
});

const history = createHistory();
const store = createStore(combineReducers({
  router: routerReducer,
  user,
  modal,
}), applyMiddleware(
  thunk,
  routerMiddleware(history)
));

window.onload = () => {
  ReactDOM.render(
    <Provider store={store}>
      <ApolloProvider client={client}>
        <ConnectedRouter history={history}>
          <Switch>
            <Route exact path="/" component={Home}/>
            <Route exact path="/login" component={Login}/>
            <Route exact path="/timeline" component={Timeline}/>
            <Route exact path="/history" component={History}/>
            <Route exact path="/device/:id" component={Device}/>
            <Route exact path="/device" component={Devices}/>
          </Switch>
        </ConnectedRouter>
      </ApolloProvider>
    </Provider>,

    document.getElementById('main')
  );
};