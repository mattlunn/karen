import React from 'react';
import { Center, Loader } from '@mantine/core';

export default function PageLoader() {
  return (
    <Center style={{ minHeight: '50vh' }}>
      <Loader size="lg" />
    </Center>
  );
}
