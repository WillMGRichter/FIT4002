import React from 'react';
import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Input } from './Input';

describe('Input', () => {
  it('renders a label associated with the input', () => {
    render(<Input label="Email" />);
    // getByLabelText resolves the label -> input association via htmlFor/id.
    expect(screen.getByLabelText('Email')).toBeInTheDocument();
  });

  it('accepts typed input', async () => {
    render(<Input label="Name" />);
    const input = screen.getByLabelText('Name');
    await userEvent.type(input, 'Ada');
    expect(input).toHaveValue('Ada');
  });

  it('shows an error with role=alert and sets aria-invalid', () => {
    render(<Input label="Password" error="Too short" />);
    expect(screen.getByRole('alert')).toHaveTextContent('Too short');
    expect(screen.getByLabelText('Password')).toHaveAttribute('aria-invalid', 'true');
  });

  it('renders a hint when there is no error', () => {
    render(<Input label="Username" hint="3-20 characters" />);
    expect(screen.getByText('3-20 characters')).toBeInTheDocument();
  });

  it('hides the hint when an error is present', () => {
    render(<Input label="Username" hint="3-20 characters" error="Required" />);
    expect(screen.queryByText('3-20 characters')).not.toBeInTheDocument();
    expect(screen.getByRole('alert')).toHaveTextContent('Required');
  });
});
