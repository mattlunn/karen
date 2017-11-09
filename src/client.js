import React from 'react';
import ReactDOM from 'react-dom';
import Home from './components/pages/home';
import Login from './components/pages/login';
import MuiThemeProvider from 'material-ui/styles/MuiThemeProvider';
import thunk from 'redux-thunk';
import { Route } from 'react-router';
import { Switch } from 'react-router-dom';
import { createStore, combineReducers, applyMiddleware } from 'redux';
import { ConnectedRouter, routerReducer, routerMiddleware, push } from 'react-router-redux';
import createHistory from 'history/createBrowserHistory';
import { Provider } from 'react-redux';
import { getAuthToken } from './reducers/user';

import stay from './reducers/stay';
import resources from './reducers/resources';
import user from './reducers/user';

require('./styles/app.less');

const history = createHistory();
const store = createStore(combineReducers({
  router: routerReducer,
  resources,
  stay,
  user
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
    <MuiThemeProvider>
      <Provider store={store}>
        <ConnectedRouter history={history}>
          <Switch>
            <Route exact path="/" component={Home}/>
            <Route exact path="/login" component={Login}/>
          </Switch>
        </ConnectedRouter>
      </Provider>
    </MuiThemeProvider>,

    document.getElementById('main')
  );
};