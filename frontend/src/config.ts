// Backend API base URL.
//
// Priority:
//   1. REACT_APP_API_URL env override (explicit; used in deployments / custom setups).
//   2. Otherwise, derive from the browser's current hostname on port 5001.
//
// Deriving from the hostname is what makes LAN access work: when a teacher shares
// http://192.168.1.42:3000/join/... with students on the same network, the frontend
// those students load will call the backend at http://192.168.1.42:5001 instead of
// localhost (which, on the student's own machine, would point at nothing).
const BACKEND_PORT = 5001;

function deriveApiUrl(): string {
  if (process.env.REACT_APP_API_URL) return process.env.REACT_APP_API_URL;
  if (typeof window !== 'undefined' && window.location?.hostname) {
    const { protocol, hostname } = window.location;
    return `${protocol}//${hostname}:${BACKEND_PORT}`;
  }
  return `http://localhost:${BACKEND_PORT}`;
}

export const API_URL = deriveApiUrl();
