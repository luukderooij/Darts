import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';
import Login from './pages/auth/Login';
import ManagePlayers from './pages/admin/ManagePlayers';
import AdminLayout from './components/layout/AdminLayout';
import CreateTournament from './pages/admin/CreateTournament';
import TournamentView from './pages/public/TournamentView';
import ScorerMatchList from './pages/scorer/MatchList';
import Scoreboard from './pages/scorer/Scoreboard';
import SystemLogs from './pages/admin/SystemLogs';

// Simple placeholder for the Dashboard Home
const DashboardHome = () => (
  <AdminLayout>
    <h2 className="text-3xl font-bold text-gray-800">Welcome Back</h2>
    <p className="text-gray-600 mt-2">Select an option from the sidebar to get started.</p>
  </AdminLayout>
);

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          <Route path="/login" element={<Login />} />
          {/* Public Routes (No Login Required) */}
          <Route path="/t/:public_uuid" element={<TournamentView />} />
          {/* Admin Routes */}
          <Route path="/dashboard" element={<DashboardHome />} />
          <Route path="/dashboard/players" element={<ManagePlayers />} />
          <Route path="/dashboard/create-tournament" element={<CreateTournament />} />
          <Route path="/dashboard/logs" element={<SystemLogs />} />
          {/* Redirects */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
          {/* Scorer Routes (Tablet View) */}
          <Route path="/board/:scorer_uuid" element={<ScorerMatchList />} />
          <Route path="/board/:scorer_uuid/match/:match_id" element={<Scoreboard />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;