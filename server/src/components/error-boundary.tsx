import React, { Component, ErrorInfo, ReactNode } from 'react';
import { Box, Button, Text, Title, Stack } from '@mantine/core';

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
}

export default class ErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error };
  }

  componentDidCatch(error: Error, errorInfo: ErrorInfo): void {
    console.error('ErrorBoundary caught an error:', error, errorInfo);
  }

  handleReset = (): void => {
    this.setState({ hasError: false, error: null });
  };

  render(): ReactNode {
    if (this.state.hasError) {
      return (
        <Box p="xl" style={{ textAlign: 'center' }}>
          <Stack align="center" gap="md">
            <Title order={2}>Something went wrong</Title>
            <Text c="dimmed">
              {this.state.error?.message || 'An unexpected error occurred'}
            </Text>
            <Button onClick={this.handleReset}>Try again</Button>
          </Stack>
        </Box>
      );
    }

    return this.props.children;
  }
}
