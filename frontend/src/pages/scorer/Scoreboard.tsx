import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { ArrowLeft, Save } from 'lucide-react';

const Scoreboard = () => {
  const { scorer_uuid, match_id } = useParams();
  const navigate = useNavigate();

  // Game State
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [playerNames, setPlayerNames] = useState({ p1: 'Player 1', p2: 'Player 2' });

  // Load Match Data
  useEffect(() => {
    api.get(`/matches/by-tournament/${scorer_uuid}`).then(res => {
      const match = res.data.find((m: any) => m.id === Number(match_id));
      if (match) {
        setPlayerNames({ p1: match.player1_name, p2: match.player2_name });
        setScoreP1(match.score_p1);
        setScoreP2(match.score_p2);
        setIsCompleted(match.is_completed);
      }
    });
  }, [scorer_uuid, match_id]);

  const updateScore = async (p1: number, p2: number, completed: boolean) => {
    try {
      // 1. Send to Backend FIRST
      await api.put(
        `/matches/${match_id}/score`, 
        {
          score_p1: p1,
          score_p2: p2,
          is_completed: completed
        },
        {
          headers: { 'X-Scorer-Token': scorer_uuid }
        }
      );

      // 2. If successful, Update UI
      setScoreP1(p1);
      setScoreP2(p2);
      setIsCompleted(completed);

      // 3. If we marked it as completed, go back to the list
      if (completed) {
        navigate(-1); 
      }

    } catch (err: any) {
      console.error("Failed to sync score");
      
      // 4. FEEDBACK SYSTEM: Show the backend validation error
      // This will catch "Impossible score" errors from the Best of X logic
      const msg = err.response?.data?.detail || "Error updating score";
      alert("⚠️ " + msg);
    }
  };

  return (
    <div className="min-h-screen bg-black text-white flex flex-col">
      {/* Header */}
      <div className="p-4 bg-slate-900 flex items-center justify-between">
        <button onClick={() => navigate(-1)} className="text-slate-400">
          <ArrowLeft />
        </button>
        <span className="font-mono text-yellow-400 font-bold">MATCH {match_id}</span>
        <div className="w-6" /> 
      </div>

      {/* Score Display */}
      <div className="flex-1 flex flex-col justify-center items-center gap-8 p-4">
        
        {/* Player 1 */}
        <div className="w-full bg-slate-800 rounded-2xl p-6 flex justify-between items-center border border-slate-700">
          <span className="text-xl font-bold text-blue-300 truncate w-32">{playerNames.p1}</span>
          <div className="flex items-center gap-4">
             <button 
                onClick={() => updateScore(Math.max(0, scoreP1 - 1), scoreP2, false)}
                className="w-12 h-12 rounded-full bg-slate-700 text-2xl font-bold text-white hover:bg-slate-600"
             >-</button>
             <span className="text-6xl font-mono font-bold w-24 text-center">{scoreP1}</span>
             <button 
                onClick={() => updateScore(scoreP1 + 1, scoreP2, false)}
                className="w-12 h-12 rounded-full bg-blue-600 text-2xl font-bold text-white hover:bg-blue-500"
             >+</button>
          </div>
        </div>

        {/* VS Divider */}
        <div className="text-slate-500 font-bold">LEGS WON</div>

        {/* Player 2 */}
        <div className="w-full bg-slate-800 rounded-2xl p-6 flex justify-between items-center border border-slate-700">
          <span className="text-xl font-bold text-blue-300 truncate w-32">{playerNames.p2}</span>
          <div className="flex items-center gap-4">
             <button 
                onClick={() => updateScore(scoreP1, Math.max(0, scoreP2 - 1), false)}
                className="w-12 h-12 rounded-full bg-slate-700 text-2xl font-bold text-white hover:bg-slate-600"
             >-</button>
             <span className="text-6xl font-mono font-bold w-24 text-center">{scoreP2}</span>
             <button 
                onClick={() => updateScore(scoreP1, scoreP2 + 1, false)}
                className="w-12 h-12 rounded-full bg-blue-600 text-2xl font-bold text-white hover:bg-blue-500"
             >+</button>
          </div>
        </div>
      </div>

      {/* Footer Controls */}
      <div className="p-6 bg-slate-900 border-t border-slate-800">
        <button 
          onClick={() => {
            // Note: We don't manually navigate here anymore. 
            // updateScore handles navigation on success.
            updateScore(scoreP1, scoreP2, !isCompleted);
          }}
          className={`w-full py-4 rounded-xl text-xl font-bold flex items-center justify-center gap-3 transition-colors ${
            isCompleted 
            ? 'bg-slate-700 text-slate-300' 
            : 'bg-green-600 text-white hover:bg-green-500'
          }`}
        >
          <Save size={24} />
          {isCompleted ? 'Mark as In Progress' : 'Finish Match'}
        </button>
      </div>
    </div>
  );
};

export default Scoreboard;