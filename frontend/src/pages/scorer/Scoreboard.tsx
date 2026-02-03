import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { 
    ArrowLeft, Save, Loader2, Clock, 
    User, Trophy, Hash
} from 'lucide-react';

// --- TYPES ---
interface MatchInfo {
    id: number;
    player1_name: string;
    player2_name: string;
    score_p1: number;
    score_p2: number;
    referee_name: string;
    round_str: string;
}

interface StatusResponse {
    tournament_id: number;
    board_number: number;
    match_id: number | null;
    state: string;
    last_matches: MatchInfo[];
    next_matches: MatchInfo[];
}

const Scoreboard = () => {
  const { match_id } = useParams();
  const navigate = useNavigate();
  
  // --- STATE ---
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [playerNames, setPlayerNames] = useState({ p1: 'Loading...', p2: 'Loading...' });
  const [refereeName, setRefereeName] = useState<string>('-');
  const [loadingMatch, setLoadingMatch] = useState(true);
  
  const [boardStatus, setBoardStatus] = useState<StatusResponse | null>(null);
  const intervalRef = useRef<any>(null);

  const sessionStr = localStorage.getItem('scorer_session');
  const isTabletMode = sessionStr !== null;

  // 1. MATCH DATA LADEN
  useEffect(() => {
    let isMounted = true;
    const fetchMatch = async (isBackgroundUpdate = false) => {
        if (!isBackgroundUpdate && isMounted) setLoadingMatch(true);
        try {
            const res = await api.get(`/matches/${match_id}`);
            const match = res.data;
            if (isMounted) {
                setPlayerNames({ p1: match.player1_name, p2: match.player2_name });
                setScoreP1(match.score_p1);
                setScoreP2(match.score_p2);
                setIsCompleted(match.is_completed);
                setRefereeName(match.referee_name || '-');
            }
        } catch (err) {
            console.error("Error loading match", err);
        } finally {
            if (isMounted) setLoadingMatch(false);
        }
    };
    fetchMatch(false);
    const matchInterval = setInterval(() => { fetchMatch(true); }, 5000);
    return () => { isMounted = false; clearInterval(matchInterval); };
  }, [match_id]);

  // 2. ZIJBALK STATUS LADEN
  useEffect(() => {
    if (!isTabletMode) return;
    const fetchStatus = async () => {
        try {
            const session = JSON.parse(sessionStr || '{}');
            const res = await api.get(`/scorer/status/${session.tournament_id}/${session.board_number}`);
            setBoardStatus(res.data);
        } catch (err) { console.error("Kon zijbalk status niet laden", err); }
    };
    fetchStatus();
    intervalRef.current = setInterval(fetchStatus, 10000);
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [isTabletMode, sessionStr, match_id]);

  // --- ACTIES ---
  const handleNavigation = () => {
      if (isTabletMode) { navigate('/scorer/standby'); } else { navigate(-1); }
  };

  const updateScore = async (p1: number, p2: number, completed: boolean) => {
    setScoreP1(p1);
    setScoreP2(p2);
    setIsCompleted(completed);
    try {
      await api.put(`/matches/${match_id}/score`, { score_p1: p1, score_p2: p2, is_completed: completed });
      if (completed) handleNavigation();
    } catch (err: any) {
      alert("Fout bij opslaan: " + (err.response?.data?.detail || "Onbekende fout"));
    }
  };

  if (loadingMatch) return (
      <div className="min-h-screen bg-slate-950 flex items-center justify-center text-white">
          <Loader2 className="animate-spin mr-2"/> Laden...
      </div>
  );

  return (
    <div className="h-screen bg-slate-950 text-white flex overflow-hidden">
      
      {/* ========================================================================
          LINKER ZIJBALK (Alleen Desktop/Tablet)
         ======================================================================== */}
      <aside className="w-80 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full z-20 shadow-2xl hidden md:flex">
        <div className="p-4 border-b border-slate-800 bg-slate-900">
             <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Hash size={14}/> <span>Match #{match_id}</span>
            </div>
            {boardStatus && (
                <h2 className="text-xl font-black tracking-tighter text-white">BORD {boardStatus.board_number}</h2>
            )}
        </div>
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            <div className="bg-blue-950/30 border border-blue-900/50 p-4 rounded-xl">
                <div className="text-[10px] font-bold text-blue-400 uppercase mb-2 flex items-center gap-1">
                    <User size={12}/> Huidige Schrijver
                </div>
                <div className="text-lg font-bold text-white truncate leading-tight">{refereeName}</div>
            </div>
            
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2"><Clock size={12}/> Binnenkort</h3>
                 <div className="text-slate-700 text-xs italic bg-slate-800/50 p-3 rounded">Zie tablet voor details</div>
            </div>
        </div>
        <div className="p-4 border-t border-slate-800">
             <button onClick={handleNavigation} className="flex items-center gap-2 text-slate-500 hover:text-white text-sm transition">
                 <ArrowLeft size={16}/> Terug / Afsluiten
             </button>
        </div>
      </aside>


      {/* ========================================================================
          RECHTER HOOFDSCHERM
         ======================================================================== */}
      <main className="flex-1 flex flex-col relative bg-slate-950">
        
        {/* MATCH HEADER */}
        <div className="h-14 md:h-16 flex items-center justify-center border-b border-slate-800/50 bg-slate-900/20 shrink-0 relative">
            <button onClick={handleNavigation} className="absolute left-4 md:hidden text-slate-500">
                <ArrowLeft size={20} />
            </button>
            <Trophy className="text-yellow-500 mr-2 md:mr-3 opacity-50" size={20} />
            <h1 className="text-base md:text-xl font-bold tracking-widest text-slate-300 uppercase">
                {boardStatus?.match_id === parseInt(match_id!) ? 'Live Match' : 'Match Viewer'}
            </h1>
        </div>

        {/* MOBILE INFO BAR */}
        <div className="bg-slate-900 border-b border-slate-800 p-2 flex justify-between items-center px-4 md:hidden shrink-0 text-xs">
            <div className="text-slate-400 flex items-center gap-1">
                <User size={12} className="text-blue-400"/> Ref: <span className="text-white font-bold">{refereeName}</span>
            </div>
            <div className="text-slate-500">
                Match #{match_id}
            </div>
        </div>

        {/* SCORE AREA */}
        <div className="flex-1 overflow-y-auto flex flex-col justify-center gap-4 md:gap-6 p-4 md:p-12">
            
            {/* SPELER 1 RIJ */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
                
                {/* Naam Sectie */}
                <div className="flex-1 min-w-0 text-center md:text-left">
                    <div className="text-[10px] md:text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Speler 1</div>
                    <div className="text-2xl md:text-5xl font-bold text-white truncate px-2">{playerNames.p1}</div>
                </div>
               
                {/* Controls Sectie */}
                <div className="flex items-center justify-between md:justify-end gap-4 bg-black/20 p-2 rounded-xl">
                    <button 
                        onClick={() => updateScore(Math.max(0, scoreP1 - 1), scoreP2, false)}
                        className="w-16 h-14 md:w-20 md:h-20 rounded-xl bg-slate-800 border-2 border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white text-3xl md:text-4xl font-bold transition flex items-center justify-center active:scale-95"
                    >
                        -
                    </button>
                    
                    <div className="w-20 md:w-32 text-center font-mono text-6xl md:text-8xl font-bold text-white leading-none">
                        {scoreP1}
                    </div>

                    <button 
                        onClick={() => updateScore(scoreP1 + 1, scoreP2, false)}
                        className="w-16 h-14 md:w-20 md:h-20 rounded-xl bg-blue-600 hover:bg-blue-500 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 text-white text-3xl md:text-4xl font-bold transition flex items-center justify-center shadow-lg shadow-blue-900/20"
                    >
                        +
                    </button>
                </div>
            </div>

            {/* VS Divider */}
            <div className="text-center shrink-0">
                <span className="text-slate-600 font-black text-xs md:text-sm uppercase tracking-[0.5em]">Legs Won</span>
            </div>

            {/* SPELER 2 RIJ */}
            <div className="flex flex-col md:flex-row items-stretch md:items-center gap-2 md:gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
                
                <div className="flex-1 min-w-0 text-center md:text-left">
                    <div className="text-[10px] md:text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Speler 2</div>
                    <div className="text-2xl md:text-5xl font-bold text-white truncate px-2">{playerNames.p2}</div>
                </div>
                
                <div className="flex items-center justify-between md:justify-end gap-4 bg-black/20 p-2 rounded-xl">
                    <button 
                        onClick={() => updateScore(scoreP1, Math.max(0, scoreP2 - 1), false)}
                        className="w-16 h-14 md:w-20 md:h-20 rounded-xl bg-slate-800 border-2 border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white text-3xl md:text-4xl font-bold transition flex items-center justify-center active:scale-95"
                    >
                        -
                    </button>
                    
                    <div className="w-20 md:w-32 text-center font-mono text-6xl md:text-8xl font-bold text-white leading-none">
                        {scoreP2}
                    </div>

                    <button 
                        onClick={() => updateScore(scoreP1, scoreP2 + 1, false)}
                        className="w-16 h-14 md:w-20 md:h-20 rounded-xl bg-blue-600 hover:bg-blue-500 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 text-white text-3xl md:text-4xl font-bold transition flex items-center justify-center shadow-lg shadow-blue-900/20"
                    >
                        +
                    </button>
                </div>
            </div>

        </div>

        {/* ACTION BAR */}
        <div className="p-4 md:p-6 bg-slate-900/80 border-t border-slate-800 backdrop-blur-sm shrink-0 safe-area-bottom">
            <button 
                onClick={() => updateScore(scoreP1, scoreP2, true)}
                className="w-full max-w-xl mx-auto py-4 md:py-6 rounded-2xl text-lg md:text-2xl font-black flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl bg-green-600 hover:bg-green-500 text-white border-b-4 border-green-800 active:border-b-0 active:translate-y-1"
            >
                <Save size={24} className="md:w-8 md:h-8" />
                BEVESTIG UITSLAG
            </button>
        </div>

      </main>
    </div>
  );
};

export default Scoreboard;