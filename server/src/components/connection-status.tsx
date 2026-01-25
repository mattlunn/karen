import React from 'react';
import { FontAwesomeIcon } from '@fortawesome/react-fontawesome';
import { faCircle } from '@fortawesome/free-solid-svg-icons';

interface Props {
  status: 'connecting' | 'connected' | 'disconnected' | 'error';
}

export default function ConnectionStatus({ status }: Props) {
  if (status === 'connected') return null;

  const messages = {
    connecting: 'Connecting to server...',
    disconnected: 'Disconnected from server',
    error: 'Connection error - reconnecting...',
  };

  const colors = {
    connecting: '#ff9800',
    disconnected: '#f44336',
    error: '#f44336',
  };

  return (
    <div
      style={{
        position: 'fixed',
        top: 0,
        left: 0,
        right: 0,
        zIndex: 10000,
        padding: '8px 16px',
        backgroundColor: colors[status],
        color: 'white',
        textAlign: 'center',
        fontSize: '14px',
        fontWeight: 500,
        boxShadow: '0 2px 4px rgba(0,0,0,0.2)',
      }}
    >
      <FontAwesomeIcon
        icon={faCircle}
        style={{
          marginRight: '8px',
          animation: 'pulse 2s ease-in-out infinite',
        }}
      />
      <span>{messages[status]}</span>
      <style>{`
        @keyframes pulse {
          0%, 100% { opacity: 1; }
          50% { opacity: 0.5; }
        }
      `}</style>
    </div>
  );
}
