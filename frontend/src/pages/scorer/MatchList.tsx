import { useEffect, useState } from 'react';
import { useParams, useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { PlayCircle, CheckCircle, Filter, GitMerge } from 'lucide-react';

interface Match {
  id: number;
  round_number: number;
  poule_number: number | null;
  player1_name: string;
  player2_name: string;
  is_completed: boolean;
  referee_name?: string;
}

const ScorerMatchList = () => {
  const { scorer_uuid } = useParams();
  const navigate = useNavigate();
  const [searchParams] = useSearchParams();
  
  const [matches, setMatches] = useState<Match[]>([]);
  const [loading, setLoading] = useState(true);

  // Read the 'poule' parameter. It might be a number ("1") or "ko"
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

  // --- UPDATED FILTER LOGIC ---
  const displayedMatches = matches.filter(match => {
    // 1. Show all if no filter
    if (!pouleFilter) return true;

    // 2. Show Knockout Matches (where poule_number is null)
    if (pouleFilter === 'ko') return match.poule_number === null;

    // 3. Show Specific Poule Matches
    return match.poule_number === parseInt(pouleFilter);
  });

  // Helper title text
  const getTitle = () => {
      if (pouleFilter === 'ko') return "Knockout Phase";
      if (pouleFilter) return `Poule ${pouleFilter}`;
      return "All Matches";
  };

  if (loading) return <div className="p-8 text-center text-white">Loading Matches...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white p-4">
      <div className="text-center mb-6">
        <h1 className="text-2xl font-bold text-blue-400 flex items-center justify-center gap-2">
          {pouleFilter === 'ko' && <GitMerge />}
          {getTitle()}
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
                <div className="mb-1">
                   <span className={`text-xs font-mono px-2 py-0.5 rounded ${match.poule_number ? 'bg-slate-900 text-slate-400' : 'bg-orange-900/30 text-orange-400 border border-orange-900/50'}`}>
                     {match.poule_number ? `P${match.poule_number}` : `KO - R${match.round_number}`}
                   </span>
                </div>

                <div className="font-bold text-lg">{match.player1_name || 'Bye'}</div>
                <div className="text-xs text-slate-400">VS</div>
                <div className="font-bold text-lg">{match.player2_name || 'Bye'}</div>

                <div className="mt-2 text-xs text-slate-500 font-mono border-t border-slate-700 pt-1 inline-block px-2">
                        Ref: <span className="text-slate-300">{match.referee_name || "-"}</span>
                </div>


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