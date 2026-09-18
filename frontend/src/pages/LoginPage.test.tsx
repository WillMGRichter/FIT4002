import React from 'react';
import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { LoginPage } from './LoginPage';

// react-router-dom v7 ships ESM that CRA's Jest resolver can't follow, so we mock the two hooks
// this page uses. This also lets us assert navigation without a real router.
const mockNavigate = jest.fn();
jest.mock('react-router-dom', () => ({
  useNavigate: () => mockNavigate,
  Link: ({ children, to }: { children: React.ReactNode; to: string }) => <a href={to}>{children}</a>,
}));

// Control the auth layer so no real network call happens.
const mockLogin = jest.fn();
jest.mock('../contexts/AuthContext', () => ({
  useAuth: () => ({ login: mockLogin }),
}));

describe('LoginPage', () => {
  it('renders the login form', () => {
    render(<LoginPage />);
    expect(screen.getByRole('heading', { name: /login/i })).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your username/i)).toBeInTheDocument();
    expect(screen.getByPlaceholderText(/enter your password/i)).toBeInTheDocument();
  });

  it('submits entered credentials and navigates to the dashboard on success', async () => {
    mockLogin.mockResolvedValueOnce(undefined);
    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText(/enter your username/i), 'alice');
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), 'secret');
    await userEvent.click(screen.getByRole('button', { name: /^login$/i }));

    await waitFor(() => expect(mockLogin).toHaveBeenCalledWith('alice', 'secret'));
    expect(mockNavigate).toHaveBeenCalledWith('/dashboard');
  });

  it('shows an error message and does not navigate when login fails', async () => {
    mockLogin.mockRejectedValueOnce(new Error('Invalid credentials'));
    render(<LoginPage />);

    await userEvent.type(screen.getByPlaceholderText(/enter your username/i), 'bob');
    await userEvent.type(screen.getByPlaceholderText(/enter your password/i), 'wrong');
    await userEvent.click(screen.getByRole('button', { name: /^login$/i }));

    expect(await screen.findByText(/invalid credentials/i)).toBeInTheDocument();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
