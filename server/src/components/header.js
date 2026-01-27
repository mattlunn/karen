import React from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Box, Burger, Group, Anchor, UnstyledButton, Collapse } from '@mantine/core';
import { useDisclosure } from '@mantine/hooks';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Timeline', to: '/timeline' },
  { label: 'Devices', to: '/device' },
];

export default function Header() {
  const [opened, { toggle }] = useDisclosure(false);
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
          onClick={vertical ? toggle : undefined}
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
    <Box
      component="nav"
      style={{
        backgroundColor: 'rgb(22, 22, 22)',
        padding: '16px',
        position: 'fixed',
        top: 0,
        width: '100%',
        zIndex: 50,
      }}
    >
      <Group justify="space-between">
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
          <Group gap="md" visibleFrom="sm">
            <NavLinks vertical={false} />
          </Group>
        </Group>

        {/* Mobile burger */}
        <Burger
          opened={opened}
          onClick={toggle}
          hiddenFrom="sm"
          color="white"
          size="sm"
        />
      </Group>

      {/* Mobile navigation */}
      <Collapse in={opened} hiddenFrom="sm">
        <Group gap="sm" mt="md" style={{ flexDirection: 'column', alignItems: 'flex-start' }}>
          <NavLinks vertical={true} />
        </Group>
      </Collapse>
    </Box>
  );
}
