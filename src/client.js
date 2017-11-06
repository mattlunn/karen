import React from 'react';
import ReactDOM from 'react-dom';
import Test from './components/test';
import { Route } from 'react-router';
import { BrowserRouter } from 'react-router-dom';

require('./styles/app.less');

window.onload = () => {
  ReactDOM.render(
    <BrowserRouter>
      <Route exact path="/" component={Test}/>
    </BrowserRouter>,

    document.getElementById('main')
  );
};