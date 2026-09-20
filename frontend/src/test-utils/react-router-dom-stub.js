// Test stub for react-router-dom.
//
// react-router-dom v7 is published as ESM whose conditional `exports` map CRA's (older) Jest
// resolver cannot follow, so importing the real package throws "Cannot find module" under
// react-scripts test. This lightweight stub stands in for the pieces our components use during
// tests. Individual tests can still jest.mock('react-router-dom', ...) to override behaviour
// (e.g. to assert navigation); this file just guarantees the module resolves.
const React = require('react');

const noop = () => {};

module.exports = {
  useNavigate: () => noop,
  useParams: () => ({}),
  useLocation: () => ({ pathname: '/', search: '', hash: '', state: null }),
  useSearchParams: () => [new URLSearchParams(), noop],
  Link: ({ children, to, ...rest }) => React.createElement('a', { href: to, ...rest }, children),
  NavLink: ({ children, to, ...rest }) => React.createElement('a', { href: to, ...rest }, children),
  Navigate: () => null,
  Outlet: () => null,
  MemoryRouter: ({ children }) => React.createElement(React.Fragment, null, children),
  BrowserRouter: ({ children }) => React.createElement(React.Fragment, null, children),
  Routes: ({ children }) => React.createElement(React.Fragment, null, children),
  Route: () => null,
};
