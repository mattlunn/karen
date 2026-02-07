import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Anchor, Stack, Group, UnstyledButton } from '@mantine/core';
import classnames from 'classnames';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Timeline', to: '/timeline' },
  { label: 'Devices', to: '/device' },
];

interface NavLinksProps {
  vertical?: boolean;
  variant?: 'header' | 'navbar';
  onNavigate?: () => void;
}

export default function NavLinks({ vertical = false, variant, onNavigate }: NavLinksProps) {
  const location = useLocation();

  const isActive = (path: string) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const Wrapper = vertical ? Stack : Group;

  return (
    <Wrapper
      gap="md"
      p={vertical ? 'md' : undefined}
      className={classnames('nav-links', {
        'nav-links--header': variant === 'header',
      })}
    >
      {navLinks.map((link) => (
        <Anchor
          key={link.to}
          component={Link}
          to={link.to}
          className={classnames('nav-links__link', {
            'nav-links__link--active': isActive(link.to),
          })}
          onClick={onNavigate}
        >
          {link.label}
        </Anchor>
      ))}
      <form action="/authentication/logout" method="post" style={{ display: vertical ? 'block' : 'inline' }}>
        <UnstyledButton
          type="submit"
          className="nav-links__logout"
        >
          Logout
        </UnstyledButton>
      </form>
    </Wrapper>
  );
}
