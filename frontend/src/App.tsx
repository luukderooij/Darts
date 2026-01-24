import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Admin Pages
import ManagePlayers from './pages/admin/ManagePlayers';
import CreateTournament from './pages/admin/CreateTournament';
import SystemLogs from './pages/admin/SystemLogs';
import ManageBoards from './pages/admin/ManageBoards';
import Dashboard from './pages/admin/Dashboard';
import ManageTournament from './pages/admin/ManageTournament'; 
import Changelog from './pages/admin/Changelog'; 

// Public Pages
import TournamentView from './pages/public/TournamentView';

// Scorer Pages
import ScorerMatchList from './pages/scorer/MatchList';
import Scoreboard from './pages/scorer/Scoreboard';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* Auth Routes */}
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* Public Routes (No Login Required) */}
          <Route path="/t/:public_uuid" element={<TournamentView />} />

          {/* Admin Routes */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/tournament/:id" element={<ManageTournament />} />
          <Route path="/dashboard/players" element={<ManagePlayers />} />
          <Route path="/dashboard/create-tournament" element={<CreateTournament />} />
          <Route path="/dashboard/logs" element={<SystemLogs />} />
          <Route path="/dashboard/boards" element={<ManageBoards />} />
          <Route path="/dashboard/changelog" element={<Changelog />} />

          {/* Scorer Routes (Tablet View) */}
          <Route path="/board/:scorer_uuid" element={<ScorerMatchList />} />
          <Route path="/board/:scorer_uuid/match/:match_id" element={<Scoreboard />} />

          {/* Default Redirect */}
          <Route path="/" element={<Navigate to="/dashboard" replace />} />
        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;