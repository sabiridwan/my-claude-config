// Greenfield entry point. Mounts PaymentPage into #payment-root.
// For an existing cc-dynamic-* project, import PaymentPage and render it where the old
// #cc-pay-widget target lived instead of using this file.
import React from 'react';
import { createRoot } from 'react-dom/client';
import PaymentPage from './PaymentPage';
import './styles/_variables.scss';

const el = document.getElementById('payment-root');
if (el) {
  createRoot(el).render(<PaymentPage />);
}
