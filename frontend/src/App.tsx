import { Routes, Route } from 'react-router-dom';
import { Navbar } from './components/Navbar';
import { Home } from './pages/Home';
import { AdminLogin } from './pages/AdminLogin';
import { Showcase } from './pages/Showcase';
import { OrgManagement } from './pages/OrgManagement';
import { CreateSimulation } from './pages/CreateSimulation';


function App() {
  return (
    <>
      <Navbar />

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/showcase" element={<Showcase />} />
        <Route path="/login" element={<AdminLogin />} />
        <Route path="/orgs" element={<OrgManagement />} />
        <Route path="/createSim" element={<CreateSimulation />} />
      </Routes>
    </>
  );
}

export default App;