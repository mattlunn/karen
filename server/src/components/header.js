import React from 'react';
import { Link } from 'react-router-dom';
import { Group, Anchor, Burger } from '@mantine/core';
import NavLinks from './nav-links';

export default function Header({ sidebarOpened, toggleSidebar }) {
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
          <NavLinks variant="header" />
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
