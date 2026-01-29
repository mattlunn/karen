import React from 'react';

export default function PageLoader() {
  return (
    <div className="body body--with-padding" style={{ minHeight: '50vh' }}>
      <div className="loading-spinner" style={{ height: '200px' }} />
    </div>
  );
}
