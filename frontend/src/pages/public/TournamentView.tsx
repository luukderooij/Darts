import { useEffect, useState } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { Trophy, Calendar, Tablet, ExternalLink } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

// Types matching the backend response
interface Match {
  id: number;
  round_number: number;
  player1_name: string;
  player2_name: string;
  score_p1: number;
  score_p2: number;
  is_completed: boolean;
}

interface Tournament {
  id: number;
  name: string;
  status: string;
  format: string;
  scorer_uuid: string; // We need this for the button!
  matches: Match[];
}

// Helper to calculate standings
const calculateStandings = (matches: Match[]) => {
  const stats: Record<string, { p: number, w: number, l: number, pts: number, ld: number }> = {};

  matches.forEach(m => {
    if (m.player1_name && !stats[m.player1_name]) stats[m.player1_name] = { p:0, w:0, l:0, pts:0, ld:0 };
    if (m.player2_name && !stats[m.player2_name]) stats[m.player2_name] = { p:0, w:0, l:0, pts:0, ld:0 };

    if (m.is_completed && m.player1_name && m.player2_name) {
      const p1 = stats[m.player1_name];
      const p2 = stats[m.player2_name];

      p1.p++; p2.p++; 
      p1.ld += (m.score_p1 - m.score_p2); 
      p2.ld += (m.score_p2 - m.score_p1);

      if (m.score_p1 > m.score_p2) {
        p1.w++; p1.pts += 2; 
        p2.l++;
      } else {
        p2.w++; p2.pts += 2;
        p1.l++;
      }
    }
  });

  return Object.entries(stats)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.pts - a.pts || b.ld - a.ld); 
};

const TournamentView = () => {
  const { public_uuid } = useParams();
  const { user } = useAuth(); // Check if admin is viewing
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<'matches' | 'table'>('table');

  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await api.get(`/tournaments/public/${public_uuid}`);
        setTournament(res.data);
      } catch (err) {
        console.error("Error loading tournament", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    
    // Optional: Poll for updates every 10 seconds so the public view updates live!
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [public_uuid]);

  if (loading) return <div className="p-10 text-center">Loading Tournament...</div>;
  if (!tournament) return <div className="p-10 text-center text-red-500">Tournament not found</div>;

  const standings = calculateStandings(tournament.matches);

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-blue-900 text-white p-6 shadow-md">
        <div className="max-w-4xl mx-auto">
          <div className="flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
               <h1 className="text-3xl font-bold flex items-center gap-3">
                <Trophy className="text-yellow-400" />
                {tournament.name}
              </h1>
              <span className="inline-block mt-2 px-3 py-1 bg-blue-800 rounded-full text-xs uppercase tracking-wider">
                {tournament.format.replace('_', ' ')}
              </span>
            </div>

            {/* Admin Only Button */}
            {user && (
              <Link 
                to={`/board/${tournament.scorer_uuid}`} 
                target="_blank"
                className="bg-yellow-500 hover:bg-yellow-400 text-blue-900 font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition shadow-lg"
              >
                <Tablet size={20} />
                Launch Scorer
              </Link>
            )}
          </div>
        </div>
      </header>

      {/* Tabs */}
      <div className="max-w-4xl mx-auto mt-6 px-4">
        <div className="flex border-b border-gray-300 mb-6">
          <button
            onClick={() => setActiveTab('table')}
            className={`px-6 py-3 font-medium ${activeTab === 'table' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
            Standings
          </button>
          <button
            onClick={() => setActiveTab('matches')}
            className={`px-6 py-3 font-medium ${activeTab === 'matches' ? 'border-b-2 border-blue-600 text-blue-600' : 'text-gray-500'}`}
          >
            Matches
          </button>
        </div>

        {/* VIEW: STANDINGS TABLE */}
        {activeTab === 'table' && (
          <div className="bg-white rounded-lg shadow overflow-hidden">
            <table className="w-full text-left">
              <thead className="bg-gray-100 border-b">
                <tr>
                  <th className="p-4 font-semibold text-gray-600">Pos</th>
                  <th className="p-4 font-semibold text-gray-600">Player</th>
                  <th className="p-4 font-semibold text-gray-600 text-center">P</th>
                  <th className="p-4 font-semibold text-gray-600 text-center">W</th>
                  <th className="p-4 font-semibold text-gray-600 text-center">L</th>
                  <th className="p-4 font-semibold text-gray-600 text-center">+/-</th>
                  <th className="p-4 font-semibold text-gray-800 text-center">Pts</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {standings.map((row, index) => (
                  <tr key={row.name} className="hover:bg-gray-50">
                    <td className="p-4 text-gray-400 font-mono">{index + 1}</td>
                    <td className="p-4 font-medium text-gray-900">{row.name}</td>
                    <td className="p-4 text-center text-gray-600">{row.p}</td>
                    <td className="p-4 text-center text-green-600">{row.w}</td>
                    <td className="p-4 text-center text-red-400">{row.l}</td>
                    <td className="p-4 text-center text-gray-500 text-sm">{row.ld > 0 ? `+${row.ld}` : row.ld}</td>
                    <td className="p-4 text-center font-bold text-blue-700 text-lg">{row.pts}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}

        {/* VIEW: MATCH LIST */}
        {activeTab === 'matches' && (
          <div className="grid gap-4">
            {tournament.matches.map((match) => (
              <div key={match.id} className="bg-white p-4 rounded-lg shadow-sm border border-gray-100 flex justify-between items-center">
                <div className="text-sm text-gray-400 font-medium w-16">R{match.round_number}</div>
                <div className="flex-1 flex items-center justify-between px-4">
                  <span className={`font-medium ${match.score_p1 > match.score_p2 ? 'text-gray-900' : 'text-gray-500'}`}>
                    {match.player1_name || 'Bye'}
                  </span>
                  <div className="bg-gray-100 px-4 py-1 rounded text-lg font-bold font-mono">
                    {match.is_completed ? `${match.score_p1} - ${match.score_p2}` : 'vs'}
                  </div>
                  <span className={`font-medium ${match.score_p2 > match.score_p1 ? 'text-gray-900' : 'text-gray-500'}`}>
                    {match.player2_name || 'Bye'}
                  </span>
                </div>
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
};

export default TournamentView;