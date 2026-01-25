import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { PlayCircle, CheckCircle, Filter } from 'lucide-react';

interface Match {
  id: number;
  round_number: number;
  poule_number: number | null;
  player1_name: string;
  player2_name: string;
  is_completed: boolean;
}

const ScorerMatchList = () => {
  const { scorer_uuid } = useParams();
  const navigate = useNavigate();
  // Initialize search params
  const [searchParams] = useSearchParams();
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Read the 'poule' parameter from the URL (e.g., ?poule=1)
  const pouleFilter = searchParams.get('poule');

  useEffect(() => {
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

  // Create a filtered list based on the URL parameter
  const displayedMatches = matches.filter(match => {
    // If no filter is set, show everything
    if (!pouleFilter) return true;
    // If filter is set, only show matches that match the poule number
    return match.poule_number === parseInt(pouleFilter);
  });

  if (loading) return <div className="p-8 text-center text-white">Loading Matches...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      {/* Header with context */}
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-blue-400">
          {pouleFilter ? `Poule ${pouleFilter} Matches` : 'All Matches'}
        </h1>
        <p className="text-slate-500 text-sm">Select a match to start scoring</p>
      </div>
      
      {displayedMatches.length === 0 ? (
         <div className="text-center p-8 bg-slate-800 rounded-xl border border-slate-700 text-slate-400">
            <Filter className="mx-auto mb-2" />
            <p>No matches found for this view.</p>
         </div>
      ) : (
        <div className="space-y-3 max-w-lg mx-auto">
          {displayedMatches.map((match) => (
            <div 
              key={match.id}
              onClick={() => navigate(`/board/${scorer_uuid}/match/${match.id}`)}
              className={`p-4 rounded-xl border border-slate-700 flex justify-between items-center cursor-pointer transition-transform active:scale-95 ${
                match.is_completed ? 'bg-slate-800 opacity-60' : 'bg-slate-800 hover:bg-slate-700 shadow-lg'
              }`}
            >
              <div className="flex-1 text-center">
                {/* Optional: Show round/poule badge */}
                <div className="mb-1">
                   <span className="text-xs font-mono bg-slate-900 px-2 py-0.5 rounded text-slate-400">
                     {match.poule_number ? `P${match.poule_number}` : 'KO'}
                   </span>
                </div>

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
      )}
    </div>
  );
};

export default ScorerMatchList;