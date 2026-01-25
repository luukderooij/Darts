import { useEffect, useState, useRef } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Trophy, Calendar, Users, ExternalLink, Copy, Target, LayoutGrid, Tablet, ChevronDown, GitMerge, Trash2 } from 'lucide-react';
import { Tournament } from '../../types';

// --- Helper Component for the Dropdown ---
const ScorerMenu = ({ tournament }: { tournament: Tournament }) => {
  const [isOpen, setIsOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setIsOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const pouleCount = tournament.number_of_poules || 1;
  const poules = Array.from({ length: pouleCount }, (_, i) => i + 1);

  return (
    <div className="relative" ref={menuRef}>
      <button 
        onClick={() => setIsOpen(!isOpen)}
        className="flex items-center gap-2 px-4 py-2 bg-indigo-50 text-indigo-700 border border-indigo-200 rounded font-medium hover:bg-indigo-100 transition"
      >
        <Tablet size={18} />
        Scorer
        <ChevronDown size={14} />
      </button>

      {isOpen && (
        <div className="absolute right-0 mt-2 w-56 bg-white rounded-lg shadow-xl border border-gray-100 z-50 overflow-hidden">
          {/* Main Link: All Matches */}
          <Link 
            to={`/board/${tournament.scorer_uuid}`}
            target="_blank"
            className="block px-4 py-2 text-sm text-gray-700 hover:bg-indigo-50 hover:text-indigo-700 font-bold border-b border-gray-100"
          >
            All Matches
          </Link>
          
          {/* Poule Links */}
          <div className="max-h-48 overflow-y-auto">
            {poules.map(num => (
              <Link
                key={num}
                to={`/board/${tournament.scorer_uuid}?poule=${num}`}
                target="_blank"
                className="block px-4 py-2 text-sm text-gray-600 hover:bg-gray-50 flex justify-between items-center"
              >
                <span>Poule {num}</span>
                <Target size={12} className="opacity-50"/>
              </Link>
            ))}
          </div>

          {/* Knockout Link */}
          {(tournament.format === 'hybrid' || tournament.format === 'knockout') && (
            <Link
                to={`/board/${tournament.scorer_uuid}?poule=ko`}
                target="_blank"
                className="block px-4 py-2 text-sm text-orange-600 hover:bg-orange-50 flex justify-between items-center border-t border-gray-100 font-medium"
            >
                <span>Knockout Phase</span>
                <GitMerge size={14} />
            </Link>
          )}
        </div>
      )}
    </div>
  );
};

const Dashboard = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const res = await api.get('/tournaments/');
        const sorted = res.data.sort((a: Tournament, b: Tournament) => 
          new Date(b.date).getTime() - new Date(a.date).getTime()
        );
        setTournaments(sorted);
      } catch (error) {
        console.error("Failed to load tournaments");
      } finally {
        setLoading(false);
      }
    };
    fetchTournaments();
  }, []);

  const copyToClipboard = (uuid: string) => {
    const url = `${window.location.origin}/t/${uuid}`;
    navigator.clipboard.writeText(url);
    alert("Public link copied to clipboard!");
  };

  // --- RESTORED: Delete Logic ---
  const handleDelete = async (id: number) => {
    const confirmed = window.confirm(
        "Are you sure you want to delete this tournament?\n\nThis will permanently delete all matches, scores, and teams associated with it."
    );
    
    if (!confirmed) return;

    try {
        await api.delete(`/tournaments/${id}`);
        // Remove from UI immediately
        setTournaments(prev => prev.filter(t => t.id !== id));
    } catch (error) {
        alert("Error deleting tournament. Check logs.");
        console.error(error);
    }
  };

  return (
    <AdminLayout>
      <div className="flex justify-between items-center mb-8">
        <div>
          <h2 className="text-3xl font-bold text-gray-800">Dashboard</h2>
          <p className="text-gray-500">Welcome back to your tournament center.</p>
        </div>
        <Link 
          to="/dashboard/create-tournament" 
          className="bg-blue-600 text-white px-4 py-2 rounded-lg font-bold hover:bg-blue-700 transition flex items-center gap-2 shadow-sm"
        >
          <Trophy size={18} />
          New Tournament
        </Link>
      </div>

      {loading ? (
        <div className="text-center py-12 text-gray-400">Loading tournaments...</div>
      ) : (
        <div className="grid gap-6">
          {tournaments.length === 0 ? (
            <div className="bg-white p-12 rounded-lg shadow-sm text-center border-2 border-dashed border-gray-200">
              <Trophy className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <h3 className="text-lg font-medium text-gray-900">No tournaments yet</h3>
              <p className="mt-1 text-gray-500">Get started by creating your first tournament.</p>
            </div>
          ) : (
            tournaments.map((t) => (
              <div key={t.id} className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 hover:shadow-md transition-shadow">
                <div className="flex flex-col xl:flex-row justify-between xl:items-center gap-4">
                  
                  {/* Left: Info */}
                  <div>
                    <div className="flex items-center gap-3 mb-1">
                      <h3 className="text-xl font-bold text-blue-900">{t.name}</h3>
                      <span className={`text-xs px-2 py-1 rounded-full uppercase font-bold tracking-wide ${
                        t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-600'
                      }`}>
                        {t.status}
                      </span>
                    </div>
                    
                    <div className="flex flex-wrap items-center gap-4 text-sm text-gray-500 mt-2">
                      <span className="flex items-center gap-1"><Calendar size={14} /> {new Date(t.date).toLocaleDateString()}</span>
                      <span className="flex items-center gap-1"><Users size={14} /> {t.player_count || 0} Players</span>
                      <span className="flex items-center gap-1"><Target size={14} /> {t.board_count || 0} Boards</span>
                      <span className="flex items-center gap-1"><LayoutGrid size={14} /> {t.number_of_poules || 1} Poules</span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex flex-wrap items-center gap-3">
                    <button 
                      onClick={() => copyToClipboard(t.public_uuid || '')}
                      className="p-2 text-gray-400 hover:text-blue-600 hover:bg-blue-50 rounded transition"
                      title="Copy Public Link"
                    >
                      <Copy size={20} />
                    </button>
                    
                    <Link 
                      to={`/t/${t.public_uuid}`}
                      target="_blank"
                      className="flex items-center gap-2 px-4 py-2 border border-gray-200 rounded text-gray-600 font-medium hover:bg-gray-50 transition"
                    >
                      <ExternalLink size={18} />
                      Public View
                    </Link>

                    {/* Scorer Menu */}
                    {t.scorer_uuid && (
                        <ScorerMenu tournament={t} />
                    )}

                    <button 
                      onClick={() => navigate(`/dashboard/tournament/${t.id}`)}
                      className="bg-slate-800 text-white px-5 py-2 rounded font-medium hover:bg-slate-900 transition shadow-sm"
                    >
                      Manage
                    </button>

                    {/* RESTORED: Delete Button */}
                    <button 
                      onClick={() => handleDelete(t.id)}
                      className="p-2 text-red-300 hover:text-red-600 hover:bg-red-50 rounded transition border border-transparent hover:border-red-200"
                      title="Delete Tournament"
                    >
                      <Trash2 size={20} />
                    </button>

                  </div>

                </div>
              </div>
            ))
          )}
        </div>
      )}
    </AdminLayout>
  );
};

export default Dashboard;