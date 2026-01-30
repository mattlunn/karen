import React, { ReactNode } from 'react';
import { Center, Loader } from '@mantine/core';

interface PageContentProps<T> {
  loading: boolean;
  data: T | null | undefined;
  children: (data: T) => ReactNode;
}

export default function PageContent<T>({ loading, data, children }: PageContentProps<T>) {
  if (loading || data == null) {
    return (
      <Center style={{ minHeight: '200px' }}>
        <Loader size="lg" />
      </Center>
    );
  }

  return <>{children(data)}</>;
}
