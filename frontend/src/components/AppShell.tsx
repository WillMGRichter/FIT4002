import React, { useEffect, useState } from 'react';
import { useNavigate, useSearchParams } from 'react-router-dom';
import {
  Bell,
  Building2,
  ChevronDown,
  FilePlus2,
  HelpCircle,
  Home,
  LogOut,
  Moon,
  Plus,
  Search,
  Settings,
  Square,
  Star,
  X,
} from 'lucide-react';
import { useAuth } from '../contexts/AuthContext';
import { getStarredProjects, getRecentProjects, type ProjectBrief } from '../utils/projectStorage';
import './AppShell.css';

type ActiveItem = 'home' | 'create' | 'project' | 'canvas';

interface AppShellProps {
  title: string;
  activeItem?: ActiveItem;
  children: React.ReactNode;
  darkDefault?: boolean;
  showBack?: boolean;
  onBack?: () => void;
  compactSidebar?: boolean;
}

const STORAGE_EVENT = 'projectStorage:changed';

export const AppShell: React.FC<AppShellProps> = ({
  title,
  activeItem = 'home',
  children,
  darkDefault = false,
  showBack = false,
  onBack,
  compactSidebar = false,
}) => {
  const [dark, setDark] = useState(darkDefault);
  const [searchParams, setSearchParams] = useSearchParams();
  const searchQuery = searchParams.get('q') || '';
  const [showSearch, setShowSearch] = useState(!!searchQuery);
  const [starredOpen, setStarredOpen] = useState(true);
  const [recentOpen, setRecentOpen] = useState(true);
  const [, setStorageVersion] = useState(0);
  const navigate = useNavigate();
  const { user, logout } = useAuth();

  useEffect(() => {
    const onStorage = () => setStorageVersion(v => v + 1);
    window.addEventListener(STORAGE_EVENT, onStorage);
    return () => window.removeEventListener(STORAGE_EVENT, onStorage);
  }, []);

  const handleLogout = () => {
    logout();
    navigate('/login');
  };

  const userName = user?.username || 'Ben Stern';

  const starredProjects: ProjectBrief[] = getStarredProjects();
  const recentProjects: ProjectBrief[] = getRecentProjects();

  return (
    <div className={`app-shell ${dark ? 'app-shell--dark' : ''}`}>
      <aside className={`app-shell__sidebar ${compactSidebar ? 'app-shell__sidebar--compact' : ''}`}>
        <div className="app-shell__profile">
          <div className="app-shell__avatar">{userName.charAt(0).toUpperCase()}</div>
          <span>{userName}</span>
          <button className="app-shell__icon-button app-shell__profile-alert" title="Notifications">
            <Bell size={17} />
          </button>
        </div>

        {showBack ? (
          <button className="app-shell__quiet-link" onClick={onBack || (() => navigate('/dashboard'))}>
            <span aria-hidden="true">&lt;-</span>
            Back
          </button>
        ) : (
          <button className="app-shell__quiet-link" onClick={() => { setShowSearch(v => !v); if (showSearch) setSearchParams({}, { replace: true }); }}>
            {showSearch ? <X size={16} /> : <Search size={16} />}
            {showSearch ? 'Close' : 'Search'}
          </button>
        )}

        {showSearch && (
          <input
            className="app-shell__search-input"
            type="text"
            placeholder="Search projects..."
            value={searchQuery}
            onChange={e => {
              const q = e.target.value;
              if (q) {
                setSearchParams({ q }, { replace: true });
              } else {
                setSearchParams({}, { replace: true });
              }
            }}
            autoFocus
          />
        )}

        <nav className="app-shell__nav">
          <button
            className={`app-shell__nav-item ${activeItem === 'home' ? 'is-active' : ''}`}
            onClick={() => navigate('/dashboard')}
          >
            <Home size={16} />
            Home
          </button>
          <button
            className={`app-shell__nav-item ${activeItem === 'create' ? 'is-active' : ''}`}
            onClick={() => navigate('/projects/create')}
          >
            <FilePlus2 size={16} />
            Create
            <Plus size={16} className="app-shell__nav-plus" />
          </button>
        </nav>

        {!compactSidebar && (
          <>
            {starredProjects.length > 0 && (
              <div className="app-shell__section">
                <div className="app-shell__section-title">
                  <span className="app-shell__section-dot app-shell__section-dot--red" />
                  Starred
                  <button className="app-shell__collapse-btn" onClick={() => setStarredOpen(v => !v)}>
                    <ChevronDown size={14} className={`app-shell__collapse-icon ${starredOpen ? '' : 'is-collapsed'}`} />
                  </button>
                </div>
                {starredOpen && starredProjects.map(p => (
                  <button key={p.id} className="app-shell__text-link" onClick={() => navigate(`/projects/${p.id}/design`)}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}

            {recentProjects.length > 0 && (
              <div className="app-shell__section">
                <div className="app-shell__section-title">
                  <span className="app-shell__section-dot app-shell__section-dot--blue" />
                  Recent
                  <button className="app-shell__collapse-btn" onClick={() => setRecentOpen(v => !v)}>
                    <ChevronDown size={14} className={`app-shell__collapse-icon ${recentOpen ? '' : 'is-collapsed'}`} />
                  </button>
                </div>
                {recentOpen && recentProjects.map(p => (
                  <button key={p.id} className="app-shell__text-link" onClick={() => navigate(`/projects/${p.id}/design`)}>
                    {p.name}
                  </button>
                ))}
              </div>
            )}
          </>
        )}

        <div className="app-shell__footer">
          <button className="app-shell__nav-item" onClick={() => navigate('/org-management')}>
            <span className="app-shell__muted-circle">
              <Building2 size={13} />
            </span>
            Organisation
            <ChevronDown size={14} className="app-shell__nav-plus" />
          </button>
          <button className="app-shell__nav-item" onClick={() => navigate('/org-management')}>
            <Settings size={18} />
            Manage Organisation
          </button>
          <button className="app-shell__nav-item app-shell__logout" onClick={handleLogout}>
            <LogOut size={16} />
            Logout
          </button>
        </div>
      </aside>

      <section className="app-shell__workspace">
        <header className="app-shell__topbar">
          <div className="app-shell__topbar-title">{title}</div>
          <div className="app-shell__topbar-actions">
            <button className="app-shell__icon-button" title="Settings">
              <Settings size={25} />
            </button>
            <button className="app-shell__icon-button" title="Toggle dark mode" onClick={() => setDark(value => !value)}>
              <Moon size={22} />
            </button>
            <button className="app-shell__team-button">New Team</button>
          </div>
        </header>

        <main className="app-shell__content">{children}</main>

        <button className="app-shell__help" title="Help">
          <HelpCircle size={34} />
        </button>
      </section>
    </div>
  );
};

export const ProjectBadge: React.FC<{ color: string; label?: string }> = ({ color, label = 'B' }) => (
  <span className="project-badge" style={{ background: color }}>
    {label}
  </span>
);

export const StarButton: React.FC<{ active?: boolean; onClick?: (event: React.MouseEvent) => void }> = ({ active, onClick }) => (
  <button className={`star-button ${active ? 'is-active' : ''}`} onClick={onClick} title={active ? 'Unstar' : 'Star'}>
    <Star size={28} fill={active ? '#62b35f' : 'none'} />
  </button>
);

export const EmptySquare: React.FC = () => <Square size={22} strokeWidth={1.3} />;
