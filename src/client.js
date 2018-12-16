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
import { getAuthToken } from './reducers/user';

import stay from './reducers/stay';
import heating from './reducers/heating';
import resources from './reducers/resources';
import lighting from './reducers/lighting';
import user from './reducers/user';
import security from './reducers/security';
import modal from './reducers/modal';
import timeline from './reducers/timeline';

import { library } from '@fortawesome/fontawesome-svg-core';
import { faLightbulb } from '@fortawesome/free-regular-svg-icons';

library.add(faLightbulb);

require('./styles/app.less');

const history = createHistory();
const store = createStore(combineReducers({
  router: routerReducer,
  resources,
  stay,
  user,
  modal,
  lighting,
  security,
  heating,
  timeline
}), {
  user: {
    token: localStorage.getItem('token')
  }
}, applyMiddleware(
  thunk,
  routerMiddleware(history)
));

store.subscribe(() => {
  localStorage.setItem('token', getAuthToken(store.getState().user));
});

window.onload = () => {
  ReactDOM.render(
    <Provider store={store}>
      <ConnectedRouter history={history}>
        <Switch>
          <Route exact path="/" component={Home}/>
          <Route exact path="/login" component={Login}/>
          <Route exact path="/timeline" component={Timeline}/>
        </Switch>
      </ConnectedRouter>
    </Provider>,

    document.getElementById('main')
  );
};