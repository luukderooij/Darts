import { useEffect, useState, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import { Target, Wifi, Clock, History, RotateCcw, User, Edit, PlayCircle } from 'lucide-react';

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
    state: string; // 'active_match' | 'waiting' | ...
    last_matches: MatchInfo[];
    next_matches: MatchInfo[];
}

const ScorerStandby = () => {
    const navigate = useNavigate();
    const [sessionData, setSessionData] = useState<{tournament_id: number, board_number: number} | null>(null);
    const [data, setData] = useState<StatusResponse | null>(null);
    const intervalRef = useRef<any>(null);

    // Initial Load
    useEffect(() => {
        const stored = localStorage.getItem('scorer_session');
        if (!stored) { navigate('/scorer'); return; }
        setSessionData(JSON.parse(stored));
    }, [navigate]);

    // Polling Logic
    useEffect(() => {
        if (!sessionData) return;

        const checkStatus = async () => {
            try {
                const res = await api.get(`/scorer/status/${sessionData.tournament_id}/${sessionData.board_number}`);
                const statusData: StatusResponse = res.data;
                setData(statusData);

                // LET OP: De automatische navigatie is hier verwijderd.
                // We laten de gebruiker nu zelf klikken op de knop die verschijnt.
            } catch (err) {
                console.error("Polling error", err);
            }
        };

        checkStatus();
        intervalRef.current = setInterval(checkStatus, 5000);
        return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
    }, [sessionData, navigate]);

    // Navigeer naar wedstrijd
    const startMatch = (matchId: number) => {
        navigate(`/board/LOCAL_DEVICE/match/${matchId}`);
    };

    const handleCorrectMatch = (matchId: number) => {
        if(confirm("Wil je deze wedstrijd heropenen om de uitslag te corrigeren?")) {
            navigate(`/board/LOCAL_DEVICE/match/${matchId}`);
        }
    }

    if (!sessionData || !data) return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center text-white">
            <div className="animate-pulse flex flex-col items-center">
                <Wifi size={48} className="text-blue-500 mb-4"/>
                <span className="text-xl">Verbinden met Bord {sessionData?.board_number}...</span>
            </div>
        </div>
    );

    return (
        <div className="min-h-screen bg-slate-900 text-white p-6 flex flex-col">
            
            {/* HEADER */}
            <header className="flex justify-between items-center mb-8 border-b border-slate-700 pb-4">
                <div className="flex items-center gap-4">
                    <div className="bg-blue-600 p-3 rounded-lg">
                        <Target size={32} />
                    </div>
                    <div>
                        <h1 className="text-4xl font-black tracking-tight">BORD {sessionData.board_number}</h1>
                        <p className="text-slate-400 text-sm font-mono uppercase tracking-widest flex items-center gap-2">
                            <span className="w-2 h-2 rounded-full bg-green-500 animate-pulse"></span> Online
                        </p>
                    </div>
                </div>
                <button 
                    onClick={() => { localStorage.removeItem('scorer_session'); navigate('/scorer'); }}
                    className="text-xs text-slate-600 hover:text-red-400 border border-slate-700 px-3 py-1 rounded"
                >
                    Ontkoppel
                </button>
            </header>

            <main className="flex-1 grid grid-cols-1 lg:grid-cols-2 gap-8">
                
                {/* LINKS: VOLGENDE WEDSTRIJDEN */}
                <div className="bg-slate-800/50 rounded-2xl border border-slate-700 p-6 flex flex-col">
                    <h2 className="text-xl font-bold text-blue-400 mb-6 flex items-center gap-2">
                        <Clock /> AANKOMEND
                    </h2>

                    {/* 1. GROTE START KNOP (Als er een actieve match is) */}
                    {data.state === 'active_match' && data.match_id && (
                        <div className="mb-6 bg-blue-600 rounded-xl p-1 shadow-lg shadow-blue-900/50 animate-in fade-in slide-in-from-top-4 duration-500">
                             <button 
                                onClick={() => startMatch(data.match_id!)}
                                className="w-full bg-slate-900 hover:bg-slate-800 transition rounded-lg p-6 text-left group relative overflow-hidden"
                             >
                                <div className="absolute top-0 right-0 p-3 opacity-10 group-hover:opacity-20 transition">
                                    <Target size={100} />
                                </div>
                                <div className="relative z-10 flex justify-between items-center">
                                    <div>
                                        <div className="text-blue-400 font-bold uppercase text-xs tracking-widest mb-1">Klaar om te starten</div>
                                        <div className="text-2xl font-black text-white">Match #{data.match_id}</div>
                                        <div className="text-slate-400 text-sm mt-1">Klik om te openen</div>
                                    </div>
                                    <PlayCircle size={48} className="text-green-400 group-hover:scale-110 transition-transform" />
                                </div>
                             </button>
                        </div>
                    )}

                    {/* 2. LIJST MET WEDSTRIJDEN */}
                    {data.next_matches.length === 0 && data.state !== 'active_match' ? (
                        <div className="flex-1 flex flex-col items-center justify-center text-slate-500">
                            <p>Geen geplande wedstrijden.</p>
                            <p className="text-sm mt-2">Wacht op wedstrijdleiding...</p>
                        </div>
                    ) : (
                        <div className="space-y-4">
                            {data.next_matches.map((m, idx) => (
                                <div 
                                    key={m.id} 
                                    onClick={() => startMatch(m.id)}
                                    className="bg-slate-800 p-4 rounded-xl border border-slate-600 shadow-lg relative overflow-hidden hover:border-blue-500 cursor-pointer transition group"
                                >
                                    {/* Labeltje als dit de eerstvolgende is (maar niet active) */}
                                    {idx === 0 && data.state !== 'active_match' && (
                                        <div className="absolute top-0 right-0 bg-blue-600 text-[10px] px-2 py-0.5 font-bold uppercase rounded-bl-lg">Next</div>
                                    )}
                                    
                                    <div className="flex justify-between items-center mb-2">
                                        <span className="text-xs font-mono text-slate-400 bg-slate-900 px-2 py-1 rounded">{m.round_str}</span>
                                    </div>
                                    <div className="flex items-center justify-between text-lg font-bold group-hover:text-blue-300 transition-colors">
                                        <span className="truncate w-1/3 text-right">{m.player1_name}</span>
                                        <span className="text-slate-500 text-sm px-2">VS</span>
                                        <span className="truncate w-1/3 text-left">{m.player2_name}</span>
                                    </div>
                                    <div className="mt-3 pt-3 border-t border-slate-700 flex items-center gap-2 text-xs text-slate-400">
                                        <User size={12} /> Ref: <span className="text-slate-300 font-bold group-hover:text-white">{m.referee_name}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                    )}
                </div>

                {/* RECHTS: GESPEELD (HISTORIE) */}
                <div className="bg-slate-800/30 rounded-2xl border border-slate-700 p-6 flex flex-col">
                    <h2 className="text-xl font-bold text-slate-400 mb-6 flex items-center gap-2">
                        <History /> GESPEELD
                    </h2>

                    <div className="space-y-3">
                        {data.last_matches.map((m, idx) => (
                            <div key={m.id} className={`p-4 rounded-xl border flex items-center justify-between ${idx === 0 ? 'bg-slate-800 border-slate-600' : 'bg-transparent border-slate-800 opacity-60'}`}>
                                
                                <div className="flex-1">
                                    <div className="flex items-center gap-2 mb-1">
                                        <span className="text-[10px] font-mono text-slate-500">{m.round_str}</span>
                                        {/* ALLEEN BIJ DE ALLERLAATSTE MATCH (idx 0) TONEN WE DE EDIT KNOP */}
                                        {idx === 0 && (
                                            <button 
                                                onClick={() => handleCorrectMatch(m.id)}
                                                className="flex items-center gap-1 text-[10px] bg-red-900/30 text-red-400 px-2 py-0.5 rounded border border-red-900/50 hover:bg-red-900/50 transition"
                                            >
                                                <Edit size={10} /> Correctie
                                            </button>
                                        )}
                                    </div>

                                    <div className="flex items-center gap-3">
                                        <span className={`font-bold ${m.score_p1 > m.score_p2 ? 'text-green-400' : 'text-slate-300'}`}>{m.player1_name}</span>
                                        <span className="bg-slate-900 px-2 py-1 rounded text-sm font-mono border border-slate-700">
                                            {m.score_p1} - {m.score_p2}
                                        </span>
                                        <span className={`font-bold ${m.score_p2 > m.score_p1 ? 'text-green-400' : 'text-slate-300'}`}>{m.player2_name}</span>
                                    </div>

                                    <div className="text-[10px] text-slate-500 mt-1">
                                        Schrijver: {m.referee_name}
                                    </div>
                                </div>

                                {idx === 0 && <RotateCcw size={16} className="text-slate-600 ml-2" />}
                            </div>
                        ))}

                        {data.last_matches.length === 0 && (
                            <p className="text-slate-500 text-center text-sm italic py-4">Nog geen wedstrijden gespeeld.</p>
                        )}
                    </div>
                </div>

            </main>
        </div>
    );
};

export default ScorerStandby;