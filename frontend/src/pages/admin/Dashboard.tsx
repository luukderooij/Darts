import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Trophy, Calendar, Users, ExternalLink, Copy, Target, LayoutGrid } from 'lucide-react';
import { Tournament } from '../../types';

const Dashboard = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);

  // 1. Fetch tournaments from the Backend
  useEffect(() => {
    const fetchTournaments = async () => {
      try {
        const res = await api.get('/tournaments/');
        // Sort by newest first
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

  // Helper to copy the public link
  const copyToClipboard = (uuid: string) => {
    const url = `${window.location.origin}/t/${uuid}`;
    navigator.clipboard.writeText(url);
    alert("Public link copied to clipboard!");
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
                <div className="flex flex-col md:flex-row justify-between md:items-center gap-4">
                  
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
                      <span className="flex items-center gap-1">
                        <Calendar size={14} />
                        {new Date(t.date).toLocaleDateString()}
                      </span>
                      <span className="flex items-center gap-1" title="Players">
                        <Users size={14} />
                        {t.player_count || 0} Players
                      </span>
                      <span className="flex items-center gap-1" title="Boards">
                        <Target size={14} />
                        {t.board_count || 0} Boards
                      </span>
                      <span className="flex items-center gap-1" title="Poules">
                        <LayoutGrid size={14} />
                        {t.number_of_poules || 1} Poules
                      </span>
                    </div>
                  </div>

                  {/* Right: Actions */}
                  <div className="flex items-center gap-3">
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

                    <button 
                      className="bg-slate-800 text-white px-5 py-2 rounded font-medium hover:bg-slate-900 transition shadow-sm"
                      onClick={() => alert("Coming soon: Match Control Panel")}
                    >
                      Manage
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