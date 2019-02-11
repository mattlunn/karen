import React from 'react';
import ReactDOM from 'react-dom';
import Timeline from './components/pages/timeline';
import Home from './components/pages/home';
import Login from './components/pages/login';
import thunk from 'redux-thunk';
import { Route } from 'react-router';
import { Switch } from 'react-router-dom';
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { ConnectedRouter, routerReducer, routerMiddleware, push } from 'react-router-redux';
import createHistory from 'history/createBrowserHistory';
import { Provider } from 'react-redux';
import moment from 'moment-timezone';

moment.tz.setDefault('Europe/London');

import heating from './reducers/heating';
import resources from './reducers/resources';
import lighting from './reducers/lighting';
import user from './reducers/user';
import security from './reducers/security';
import modal from './reducers/modal';
import timeline from './reducers/timeline';

import { library } from '@fortawesome/fontawesome-svg-core';
import { faLightbulb } from '@fortawesome/free-regular-svg-icons/faLightbulb';
import { faWalking } from '@fortawesome/free-solid-svg-icons/faWalking';
import { faVideo } from '@fortawesome/free-solid-svg-icons/faVideo';
import { faHome } from '@fortawesome/free-solid-svg-icons/faHome';

import ApolloClient from 'apollo-boost';
import { ApolloProvider } from 'react-apollo';

library.add(faLightbulb, faVideo, faHome, faWalking);

require('./styles/app.less');

const client = new ApolloClient({ uri: '/graphql' });
const history = createHistory();
const store = createStore(combineReducers({
  router: routerReducer,
  resources,
  user,
  modal,
  lighting,
  security,
  heating,
  timeline
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
          </Switch>
        </ConnectedRouter>
      </ApolloProvider>
    </Provider>,

    document.getElementById('main')
  );
};