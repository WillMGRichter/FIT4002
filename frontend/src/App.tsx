import React from 'react';
import { Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider, useAuth } from './contexts/AuthContext';
import { Home } from './pages/Home';
import { LoginPage } from './pages/LoginPage';
import { SignupPage } from './pages/SignupPage';
import { AdminLogin } from './pages/AdminLogin';
import { DashboardPage } from './pages/DashboardPage';
import { ProjectCreatePage } from './pages/ProjectCreatePage';
import { SimulationPage } from './pages/SimulationPage';
import { CanvasPlayground } from './pages/CanvasPlayground';
import { CreateSimulation } from './pages/CreateSimulation';
import { OrgManagement } from './pages/OrgManagement';
import { ProjectDesigner } from './pages/ProjectDesigner';
import { StudentSimulationView } from './pages/StudentSimulationView';
import './App.css';
import './pages/common.css';


function AppContent() {
  const { user, loading } = useAuth();

  if (loading) {
    return <div className="loading-container">Loading...</div>;
  }

  return (
    <Routes>
      {user ? (
        <>
          <Route path="/" element={<DashboardPage />} />
          <Route path="/dashboard" element={<DashboardPage />} />
          <Route path="/projects/create" element={<ProjectCreatePage />} />
          <Route path="/projects/:projectId/simulate" element={<SimulationPage />} />
          <Route path="/projects/:projectId/design" element={<ProjectDesigner />} />
          <Route path="/projects/:projectId/play" element={<StudentSimulationView />} />
          <Route path="/canvas" element={<CanvasPlayground />} />
          <Route path="/create-simulation" element={<CreateSimulation />} />
          <Route path="/org-management" element={<OrgManagement />} />
          <Route path="*" element={<Navigate to="/dashboard" />} />
        </>
      ) : (
        <>
          <Route path="/" element={<Home />} />
          <Route path="/home" element={<Home />} />
          <Route path="/login" element={<LoginPage />} />
          <Route path="/signup" element={<SignupPage />} />
          <Route path="/admin-login" element={<AdminLogin />} />
          <Route path="*" element={<Navigate to="/" />} />
        </>
      )}
    </Routes>
  );
}

function App() {
  return (
    <AuthProvider>
      <AppContent />
    </AuthProvider>
  );
}

export default App;