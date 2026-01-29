import React from 'react';
import { Center, Loader } from '@mantine/core';

export default function PageLoader() {
  return (
    <div className="body body--with-padding" style={{ minHeight: '50vh' }}>
      <Center h={200}>
        <Loader size="lg" />
      </Center>
    </div>
  );
}
