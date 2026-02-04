import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Group, Anchor, UnstyledButton, Burger } from '@mantine/core';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Timeline', to: '/timeline' },
  { label: 'Devices', to: '/device' },
];

export default function Header({ sidebarOpened, toggleSidebar }) {
  const location = useLocation();

  const isActive = (path) => {
    if (path === '/') {
      return location.pathname === '/';
    }
    return location.pathname.startsWith(path);
  };

  const linkStyles = (active) => ({
    color: active ? 'rgba(255,255,255,.9)' : 'rgba(255,255,255,.5)',
    textDecoration: 'none',
    fontSize: '16px',
    '&:hover': {
      color: 'rgba(255,255,255,.75)',
    },
  });

  const NavLinks = ({ vertical }) => (
    <>
      {navLinks.map((link) => (
        <Anchor
          key={link.to}
          component={Link}
          to={link.to}
          style={linkStyles(isActive(link.to))}
          onClick={vertical ? toggleSidebar : undefined}
        >
          {link.label}
        </Anchor>
      ))}
      <form action="/authentication/logout" method="post" style={{ display: 'inline' }}>
        <UnstyledButton
          type="submit"
          style={{
            color: 'rgba(255, 255, 255, 0.5)',
            fontSize: '16px',
            cursor: 'pointer',
          }}
          styles={{
            root: {
              '&:hover': {
                color: 'rgba(255,255,255,.75)',
              },
            },
          }}
        >
          Logout
        </UnstyledButton>
      </form>
    </>
  );

  return (
    <Group h="100%" px="md" justify="space-between" bg="rgb(22, 22, 22)">
      <Group gap="xl">
        <Anchor
          component={Link}
          to="/"
          style={{
            color: '#fff',
            fontSize: '1.25rem',
            textDecoration: 'none',
            fontWeight: 500,
          }}
        >
          Karen
        </Anchor>

        {/* Desktop navigation */}
        <Group gap="md" visibleFrom="md">
          <NavLinks vertical={false} />
        </Group>
      </Group>

      {/* Mobile burger - toggles sidebar */}
      <Burger
        opened={sidebarOpened}
        onClick={toggleSidebar}
        hiddenFrom="md"
        color="white"
        size="sm"
      />
    </Group>
  );
}
