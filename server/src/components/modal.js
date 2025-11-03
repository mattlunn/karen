import React from 'react';

export default function Modal({ children }) {
  return (
    <div className="modal__backdrop">
      <div className="modal__container">
        {children}
      </div>
    </div>
  );
}