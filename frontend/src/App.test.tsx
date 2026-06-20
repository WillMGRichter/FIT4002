import React from 'react';
import { render, screen } from '@testing-library/react';
import App from './App';

test('renders app without crashing', () => {
  render(<App />);
  const headingElement = screen.getByText(/Smart Simulations/i);
  expect(headingElement).toBeInTheDocument();
});
