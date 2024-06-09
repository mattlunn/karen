import React, { useState } from 'react';
import classnames from 'classnames';
import { Link } from 'react-router-dom';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faBars } from '@fortawesome/free-solid-svg-icons/faBars';

export default function Header() {
  const [isOpen, setIsOpen] = useState(false);

  return (
    <nav className="header">
      <Link to="/" className="header__brand">Karen</Link>

      <a href="#" onClick={(e) => {
        setIsOpen(!isOpen);
        e.preventDefault();
      }} className="header__hamburger"><FontAwesomeIcon icon={faBars} /></a>

      <ul className={classnames("header__nav-items", {
        'header__nav-items--open': isOpen
      })}>
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
          <Link to="/device" className="header__nav-item-link">Devices</Link>
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