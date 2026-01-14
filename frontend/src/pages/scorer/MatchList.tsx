import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { PlayCircle, CheckCircle } from 'lucide-react';

interface Match {
  id: number;
  round_number: number;
  player1_name: string;
  player2_name: string;
  is_completed: boolean;
}

const ScorerMatchList = () => {
  const { scorer_uuid } = useParams();
  const navigate = useNavigate();
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // We reuse the public endpoint logic but fetch via the Scorer UUID
    // The backend logic we wrote handles looking up by Scorer UUID too
    const loadMatches = async () => {
      try {
        const res = await api.get(`/matches/by-tournament/${scorer_uuid}`);
        setMatches(res.data);
      } catch (err) {
        alert("Invalid Scorer Link");
      } finally {
        setLoading(false);
      }
    };
    loadMatches();
  }, [scorer_uuid]);

  if (loading) return <div className="p-8 text-center">Loading Matches...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <h1 className="text-2xl font-bold mb-6 text-center text-blue-400">Select Match to Score</h1>
      
      <div className="space-y-3 max-w-lg mx-auto">
        {matches.map((match) => (
          <div 
            key={match.id}
            onClick={() => navigate(`/board/${scorer_uuid}/match/${match.id}`)}
            className={`p-4 rounded-xl border border-slate-700 flex justify-between items-center cursor-pointer transition-transform active:scale-95 ${
              match.is_completed ? 'bg-slate-800 opacity-60' : 'bg-slate-800 hover:bg-slate-700 shadow-lg'
            }`}
          >
            <div className="flex-1 text-center">
              <div className="font-bold text-lg">{match.player1_name || 'Bye'}</div>
              <div className="text-xs text-slate-400">VS</div>
              <div className="font-bold text-lg">{match.player2_name || 'Bye'}</div>
            </div>
            
            <div className="ml-4">
              {match.is_completed ? (
                <CheckCircle className="text-green-500" size={32} />
              ) : (
                <PlayCircle className="text-blue-400" size={32} />
              )}
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};

export default ScorerMatchList;