import React from 'react';
import { Center, Loader } from '@mantine/core';

export default function PageLoader() {
  return (
    <Center style={{ minHeight: '200px' }}>
      <Loader size="lg" />
    </Center>
  );
}
