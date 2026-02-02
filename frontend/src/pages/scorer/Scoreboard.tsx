import { useEffect, useState, useRef } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { 
    ArrowLeft, Save, Loader2, Clock, History, 
    User, Edit, Trophy, Hash
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
  
  // --- STATE: Huidige Wedstrijd ---
  const [scoreP1, setScoreP1] = useState(0);
  const [scoreP2, setScoreP2] = useState(0);
  const [isCompleted, setIsCompleted] = useState(false);
  const [playerNames, setPlayerNames] = useState({ p1: 'Loading...', p2: 'Loading...' });
  const [refereeName, setRefereeName] = useState<string>('-');
  const [loadingMatch, setLoadingMatch] = useState(true);

  // --- STATE: Bord Informatie (Zijkant) ---
  const [boardStatus, setBoardStatus] = useState<StatusResponse | null>(null);
  
  // Interval ref voor polling van zijbalk
  const intervalRef = useRef<any>(null);

  // Check Tablet Mode
  const sessionStr = localStorage.getItem('scorer_session');
  const isTabletMode = sessionStr !== null;

  // 1. MATCH DATA LADEN & POLLING (Zonder flikkering)
  useEffect(() => {
    let isMounted = true;

    const fetchMatch = async (isBackgroundUpdate = false) => {
        // Alleen spinner tonen als het GEEN achtergrond update is
        if (!isBackgroundUpdate && isMounted) {
            setLoadingMatch(true);
        }
        
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

    // Eerste keer laden (met spinner)
    fetchMatch(false);

    // Interval instellen (zonder spinner, elke 5 sec)
    const matchInterval = setInterval(() => {
        fetchMatch(true); 
    }, 5000);

    return () => {
        isMounted = false;
        clearInterval(matchInterval);
    };
  }, [match_id]);

  // 2. ZIJBALK STATUS LADEN (Polling)
  useEffect(() => {
    if (!isTabletMode) return;

    const fetchStatus = async () => {
        try {
            const session = JSON.parse(sessionStr || '{}');
            const res = await api.get(`/scorer/status/${session.tournament_id}/${session.board_number}`);
            setBoardStatus(res.data);
        } catch (err) {
            console.error("Kon zijbalk status niet laden", err);
        }
    };

    fetchStatus(); // Direct
    intervalRef.current = setInterval(fetchStatus, 10000); // Elke 10 sec verversen

    return () => {
        if (intervalRef.current) clearInterval(intervalRef.current);
    };
  }, [isTabletMode, sessionStr, match_id]);

  // --- ACTIES ---

  const handleNavigation = () => {
      if (isTabletMode) {
          navigate('/scorer/standby');
      } else {
          navigate(-1);
      }
  };

  const updateScore = async (p1: number, p2: number, completed: boolean) => {
    // Optimistic UI update
    setScoreP1(p1);
    setScoreP2(p2);
    setIsCompleted(completed);

    try {
      await api.put(
        `/matches/${match_id}/score`, 
        { score_p1: p1, score_p2: p2, is_completed: completed }
      );
      if (completed) handleNavigation();
    } catch (err: any) {
      alert("Fout bij opslaan: " + (err.response?.data?.detail || "Onbekende fout"));
    }
  };

  const handleCorrectMatch = (targetId: number) => {
    if(confirm("Huidige wedstrijd verlaten en correctie starten?")) {
        navigate(`/board/LOCAL_DEVICE/match/${targetId}`);
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
          LINKER ZIJBALK (30% Breedte - Informatie)
         ======================================================================== */}
      <aside className="w-80 flex-shrink-0 bg-slate-900 border-r border-slate-800 flex flex-col h-full z-20 shadow-2xl hidden md:flex">
        
        {/* Header Zijbalk */}
        <div className="p-4 border-b border-slate-800 bg-slate-900">
            <div className="flex items-center gap-2 text-slate-400 mb-1">
                <Hash size={14}/> <span>Match #{match_id}</span>
            </div>
            {boardStatus && (
                <h2 className="text-xl font-black tracking-tighter text-white">
                    BORD {boardStatus.board_number}
                </h2>
            )}
        </div>

        {/* Scrollable Content */}
        <div className="flex-1 overflow-y-auto p-4 space-y-6">
            
            {/* 1. SCHRIJVER */}
            <div className="bg-blue-950/30 border border-blue-900/50 p-4 rounded-xl">
                <div className="text-[10px] font-bold text-blue-400 uppercase mb-2 flex items-center gap-1">
                    <User size={12}/> Huidige Schrijver
                </div>
                <div className="text-lg font-bold text-white truncate leading-tight">
                    {refereeName}
                </div>
            </div>

            {/* 2. AANKOMEND */}
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <Clock size={12}/> Binnenkort
                </h3>
                {!boardStatus ? (
                    <div className="text-slate-600 text-xs italic">Laden...</div>
                ) : boardStatus.next_matches.length === 0 ? (
                    <div className="text-slate-700 text-xs italic bg-slate-800/50 p-3 rounded">Geen wedstrijden gepland.</div>
                ) : (
                    <div className="space-y-3">
                        {boardStatus.next_matches.map(m => (
                            <div key={m.id} className="bg-slate-800/50 p-3 rounded-lg border border-slate-800">
                                <div className="flex justify-between text-[10px] text-slate-400 mb-1">
                                    <span>{m.round_str}</span>
                                    <span className="text-blue-400 truncate ml-2">Ref: {m.referee_name}</span>
                                </div>
                                <div className="font-bold text-sm flex justify-between items-center text-slate-200">
                                    <span className="truncate w-1/2">{m.player1_name}</span>
                                    <span className="text-slate-600 px-1">vs</span>
                                    <span className="truncate w-1/2 text-right">{m.player2_name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

            {/* 3. HISTORIE & CORRECTIE */}
            <div>
                <h3 className="text-xs font-bold text-slate-500 uppercase mb-3 flex items-center gap-2">
                    <History size={12}/> Gespeeld
                </h3>
                {!boardStatus ? (
                    <div className="text-slate-600 text-xs italic">Laden...</div>
                ) : boardStatus.last_matches.length === 0 ? (
                    <div className="text-slate-700 text-xs italic bg-slate-800/50 p-3 rounded">Nog geen historie.</div>
                ) : (
                    <div className="space-y-3">
                        {boardStatus.last_matches.map((m, idx) => (
                            <div key={m.id} className={`p-3 rounded-lg border ${idx===0 ? 'bg-slate-800 border-slate-600' : 'bg-transparent border-slate-800/50 opacity-60'}`}>
                                <div className="flex justify-between items-center mb-1">
                                    <span className="text-[10px] text-slate-400">{m.round_str}</span>
                                    {idx === 0 && (
                                        <button 
                                            onClick={() => handleCorrectMatch(m.id)}
                                            className="flex items-center gap-1 text-[9px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded border border-red-900/50 hover:bg-red-900 hover:text-white transition uppercase font-bold tracking-wider"
                                        >
                                            <Edit size={8} /> Correctie
                                        </button>
                                    )}
                                </div>
                                <div className="font-bold text-sm flex justify-between items-center text-slate-300">
                                    <span className={`truncate w-1/3 ${m.score_p1 > m.score_p2 ? 'text-green-400' : ''}`}>{m.player1_name}</span>
                                    <span className="bg-slate-950 px-2 py-0.5 rounded text-xs font-mono border border-slate-700">
                                        {m.score_p1} - {m.score_p2}
                                    </span>
                                    <span className={`truncate w-1/3 text-right ${m.score_p2 > m.score_p1 ? 'text-green-400' : ''}`}>{m.player2_name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                )}
            </div>

        </div>
        
        {/* Footer Sidebar */}
        <div className="p-4 border-t border-slate-800">
             <button onClick={handleNavigation} className="flex items-center gap-2 text-slate-500 hover:text-white text-sm transition">
                <ArrowLeft size={16}/> Terug / Afsluiten
             </button>
        </div>
      </aside>


      {/* ========================================================================
          RECHTER HOOFDSCHERM (70% Breedte - Scorebord)
         ======================================================================== */}
      <main className="flex-1 flex flex-col relative bg-slate-950">
        
        {/* MATCH HEADER */}
        <div className="h-16 flex items-center justify-center border-b border-slate-800/50 bg-slate-900/20">
            <Trophy className="text-yellow-500 mr-3 opacity-50" />
            <h1 className="text-xl font-bold tracking-widest text-slate-300 uppercase">
                {boardStatus?.match_id === parseInt(match_id!) ? 'Live Match' : 'Match Viewer'}
            </h1>
        </div>

        {/* SCORE AREA */}
        <div className="flex-1 flex flex-col justify-center gap-6 p-6 md:p-12">
            
            {/* SPELER 1 RIJ */}
            <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
                <div className="flex-1 min-w-0">
                    <div className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Speler 1</div>
                    <div className="text-3xl md:text-5xl font-bold text-white truncate">{playerNames.p1}</div>
                </div>
                
                <div className="flex items-center gap-4 bg-black/20 p-2 rounded-xl">
                    <button 
                        onClick={() => updateScore(Math.max(0, scoreP1 - 1), scoreP2, false)}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-slate-800 border-2 border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white text-4xl font-bold transition flex items-center justify-center active:scale-95"
                    >
                        -
                    </button>
                    <div className="w-24 md:w-32 text-center font-mono text-7xl md:text-8xl font-bold text-white leading-none">
                        {scoreP1}
                    </div>
                    <button 
                        onClick={() => updateScore(scoreP1 + 1, scoreP2, false)}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-blue-600 hover:bg-blue-500 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 text-white text-4xl font-bold transition flex items-center justify-center shadow-lg shadow-blue-900/20"
                    >
                        +
                    </button>
                </div>
            </div>

            {/* VS Divider */}
            <div className="text-center">
                <span className="text-slate-600 font-black text-sm uppercase tracking-[0.5em]">Legs Won</span>
            </div>

            {/* SPELER 2 RIJ */}
            <div className="flex items-center gap-4 bg-slate-900 p-4 rounded-2xl border border-slate-800 shadow-xl">
                <div className="flex-1 min-w-0 text-right">
                    <div className="text-xs text-blue-400 font-bold uppercase tracking-wider mb-1">Speler 2</div>
                    <div className="text-3xl md:text-5xl font-bold text-white truncate">{playerNames.p2}</div>
                </div>
                
                <div className="flex items-center gap-4 bg-black/20 p-2 rounded-xl flex-row-reverse">
                    <button 
                        onClick={() => updateScore(scoreP1, Math.max(0, scoreP2 - 1), false)}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-slate-800 border-2 border-slate-700 hover:border-slate-500 text-slate-400 hover:text-white text-4xl font-bold transition flex items-center justify-center active:scale-95"
                    >
                        -
                    </button>
                    <div className="w-24 md:w-32 text-center font-mono text-7xl md:text-8xl font-bold text-white leading-none">
                        {scoreP2}
                    </div>
                    <button 
                        onClick={() => updateScore(scoreP1, scoreP2 + 1, false)}
                        className="w-16 h-16 md:w-20 md:h-20 rounded-xl bg-blue-600 hover:bg-blue-500 border-b-4 border-blue-800 active:border-b-0 active:translate-y-1 text-white text-4xl font-bold transition flex items-center justify-center shadow-lg shadow-blue-900/20"
                    >
                        +
                    </button>
                </div>
            </div>

        </div>

        {/* ACTION BAR */}
        <div className="p-6 bg-slate-900/80 border-t border-slate-800 backdrop-blur-sm">
            <button 
                onClick={() => updateScore(scoreP1, scoreP2, true)}
                className="w-full max-w-xl mx-auto py-6 rounded-2xl text-2xl font-black flex items-center justify-center gap-3 transition-all active:scale-95 shadow-xl bg-green-600 hover:bg-green-500 text-white border-b-4 border-green-800 active:border-b-0 active:translate-y-1"
            >
                <Save size={32} />
                BEVESTIG UITSLAG
            </button>
        </div>

      </main>
    </div>
  );
};

export default Scoreboard;