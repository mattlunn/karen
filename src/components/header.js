import React, { Component } from 'react';
import { Link } from 'react-router-dom';

export default class Header extends Component {
  render() {
    return (
      <nav className="header">
        <Link to="/" className="header__brand">Karen</Link>

        <ul className="header__nav-items">
          <li className="header__nav-item">
            <Link to="/" className="header__nav-item-link">Home</Link>
          </li>
          <li className="header__nav-item">
            <Link to="/timeline" className="header__nav-item-link">Timeline</Link>
          </li>
          <li className="header__nav-item">
            <Link to="/history" className="header__nav-item-link">History</Link>
          </li>
          <li className="header__nav-item">
            <form action="/authentication/logout" method="post" className="header__nav-item-form">
              <input type="submit" value="Logout" className="header__nav-item-button" />
            </form>
          </li>
        </ul>
      </nav>
    );
  }
}