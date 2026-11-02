import React from 'react';
import { act, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { CreateSimulation } from '../CreateSimulation';

jest.mock('react-router-dom', () => ({
  useNavigate: () => jest.fn(),
}));

jest.mock('../../contexts/AuthContext', () => ({
  useAuth: () => ({ token: 'teacher-token' }),
}));

let uploadResponse: { ok: boolean; status: number; body: unknown };

beforeEach(() => {
  uploadResponse = { ok: true, status: 200, body: [] };
  (global as any).fetch = jest.fn((url: string) => {
    if (url.endsWith('/excel/upload')) {
      return Promise.resolve({ ok: uploadResponse.ok, status: uploadResponse.status, json: () => Promise.resolve(uploadResponse.body) });
    }
    return Promise.resolve({ ok: true, json: () => Promise.resolve({ message: 'ok' }) }); // health check
  });
});

const uploadCall = () =>
  ((global as any).fetch as jest.Mock).mock.calls.find(([url]: [string]) => url.endsWith('/excel/upload'));

async function chooseFile() {
  const file = new File(['x'], 'book.xlsx', {
    type: 'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  });
  // The file input is inside a <label>; it has no accessible name to query by.
  // eslint-disable-next-line testing-library/no-node-access, testing-library/no-container
  const input = document.querySelector('input[type="file"]') as HTMLInputElement;
  // The upload kicks off a fetch whose result updates state afterwards, so let it settle inside act.
  // eslint-disable-next-line testing-library/no-unnecessary-act
  await act(async () => {
    userEvent.upload(input, file);
  });
}

describe('CreateSimulation upload', () => {
  it('sends the signed-in user\'s token with the upload (the endpoint requires auth)', async () => {
    render(<CreateSimulation />);
    await chooseFile();

    await waitFor(() => expect(uploadCall()).toBeDefined());
    const [, init] = uploadCall();
    expect(init.method).toBe('POST');
    expect(init.headers.Authorization).toBe('Bearer teacher-token');
    expect(init.body).toBeInstanceOf(FormData);
    // The browser must set the multipart boundary itself.
    expect(init.headers['Content-Type']).toBeUndefined();

  });

  it('shows the server\'s reason when the upload is rejected', async () => {
    uploadResponse = { ok: false, status: 401, body: { error: 'Invalid or expired token' } };
    render(<CreateSimulation />);
    await chooseFile();

    expect(await screen.findByText('Invalid or expired token')).toBeInTheDocument();
  });
});
