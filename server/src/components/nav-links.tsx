import React, { useState } from 'react';
import { Link, useLocation } from 'react-router-dom';
import { Anchor, Stack, Group, UnstyledButton, Popover } from '@mantine/core';
import classnames from 'classnames';
import * as styles from './nav-links.module.css';

const navLinks = [
  { label: 'Home', to: '/' },
  { label: 'Timeline', to: '/timeline' },
  { label: 'Devices', to: '/device' },
];

const insightsLinks = [
  { label: 'Heating', to: '/insights/heating' },
  { label: 'Bins', to: '/insights/bins' },
];

interface NavLinksProps {
  vertical?: boolean;
  variant?: 'header' | 'navbar';
  onNavigate?: () => void;
}

function InsightsNav({ vertical, isActive, onNavigate }: {
  vertical?: boolean;
  isActive: (path: string) => boolean;
  onNavigate?: () => void;
}) {
  const [opened, setOpened] = useState(false);
  const active = isActive('/insights');

  if (vertical) {
    return (
      <>
        <span className={classnames(styles.link, styles.sectionLabel, {
          [styles.linkActive]: active,
        })}>
          Insights
        </span>
        {insightsLinks.map((link) => (
          <Anchor
            key={link.to}
            component={Link}
            to={link.to}
            className={classnames(styles.link, styles.subLink, {
              [styles.linkActive]: isActive(link.to),
            })}
            onClick={onNavigate}
          >
            {link.label}
          </Anchor>
        ))}
      </>
    );
  }

  return (
    <Popover opened={opened} onChange={setOpened} position="bottom-start" shadow="md">
      <Popover.Target>
        <UnstyledButton
          className={classnames(styles.link, {
            [styles.linkActive]: active,
          })}
          onClick={() => setOpened((o) => !o)}
        >
          Insights
        </UnstyledButton>
      </Popover.Target>
      <Popover.Dropdown>
        <Stack gap="xs">
          {insightsLinks.map((link) => (
            <Anchor
              key={link.to}
              component={Link}
              to={link.to}
              className={styles.dropdownLink}
              onClick={() => {
                setOpened(false);
                onNavigate?.();
              }}
            >
              {link.label}
            </Anchor>
          ))}
        </Stack>
      </Popover.Dropdown>
    </Popover>
  );
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
      className={classnames(styles.root, {
        [styles.rootHeader]: variant === 'header',
      })}
    >
      {navLinks.map((link) => (
        <Anchor
          key={link.to}
          component={Link}
          to={link.to}
          className={classnames(styles.link, {
            [styles.linkActive]: isActive(link.to),
          })}
          onClick={onNavigate}
        >
          {link.label}
        </Anchor>
      ))}
      <InsightsNav
        vertical={vertical}
        isActive={isActive}
        onNavigate={onNavigate}
      />
      <form action="/authentication/logout" method="post" style={{ display: vertical ? 'block' : 'inline' }}>
        <UnstyledButton
          type="submit"
          className={styles.logout}
        >
          Logout
        </UnstyledButton>
      </form>
    </Wrapper>
  );
}
