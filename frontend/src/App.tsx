// FILE: frontend/src/App.tsx
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { AuthProvider } from './context/AuthContext';

// Auth Pages
import Login from './pages/auth/Login';
import Register from './pages/auth/Register';

// Admin Pages
import ManagePlayers from './pages/admin/ManagePlayers';
import CreateTournament from './pages/admin/CreateTournament';
import ManageBoards from './pages/admin/ManageBoards';
import Dashboard from './pages/admin/Dashboard';
import ManageTournament from './pages/admin/ManageTournament'; 
import Changelog from './pages/admin/Changelog'; 
import ManageTeams from './pages/admin/ManageTeams';

// Public Pages
import Home from './pages/Home'; 
import TournamentTV from './pages/public/TournamentTV'; 
import TournamentView from './pages/public/TournamentView';

// Scorer Pages
import ScorerMatchList from './pages/scorer/MatchList';
import Scoreboard from './pages/scorer/Scoreboard';
import ScorerLogin from './pages/scorer/ScorerLogin';
import ScorerStandby from './pages/scorer/ScorerStandby';

function App() {
  return (
    <AuthProvider>
      <BrowserRouter>
        <Routes>
          {/* =========================================
             1. PUBLIEKE ROUTES (GEEN LOGIN)
             =========================================
          */}
          <Route path="/" element={<Home />} /> 
          <Route path="/login" element={<Login />} />
          <Route path="/register" element={<Register />} />
          
          {/* DE TV ROUTE: Deze moet hier staan! */}
          <Route path="/tv/:public_uuid" element={<TournamentTV />} />
          <Route path="/t/:public_uuid" element={<TournamentView />} />

          {/* =========================================
             2. ADMIN ROUTES (MET LOGIN CHECK)
             =========================================
             Deze pagina's gebruiken intern de AdminLayout component.
             Die component checkt of je ingelogd bent.
          */}
          <Route path="/dashboard" element={<Dashboard />} />
          <Route path="/dashboard/tournament/:id" element={<ManageTournament />} />
          <Route path="/dashboard/players" element={<ManagePlayers />} />
          <Route path="/dashboard/teams" element={<ManageTeams />} />
          <Route path="/dashboard/create-tournament" element={<CreateTournament />} />
          <Route path="/dashboard/boards" element={<ManageBoards />} />
          <Route path="/dashboard/changelog" element={<Changelog />} />

          {/* =========================================
             3. SCORER ROUTES
             =========================================
          */}
          <Route path="/board/:scorer_uuid" element={<ScorerMatchList />} />
          <Route path="/board/:scorer_uuid/match/:match_id" element={<Scoreboard />} />
          <Route path="/scorer" element={<ScorerLogin />} />
          <Route path="/scorer/standby" element={<ScorerStandby />} />

          {/* =========================================
             4. FALLBACK
             =========================================
          */}
          {/* Alles wat niet bestaat -> Home */}
          <Route path="*" element={<Navigate to="/" replace />} />

        </Routes>
      </BrowserRouter>
    </AuthProvider>
  );
}

export default App;