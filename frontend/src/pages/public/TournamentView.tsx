import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Trophy, LayoutGrid, GitMerge, RefreshCw, Medal, Target, PenTool, Info, ListFilter } from 'lucide-react';

// --- Types ---
interface Match {
  id: number;
  round_number: number;
  poule_number: number | null;
  player1_name: string;
  player2_name: string;
  score_p1: number;
  score_p2: number;
  is_completed: boolean;
  best_of_legs?: number;
  referee_name?: string;
  board_id?: number; 
}

interface Tournament {
  id: number;
  name: string;
  status: string;
  format: string;
  scorer_uuid: string;
  qualifiers_per_poule?: number; 
  matches: Match[];
  boards?: {id: number; name: string; number: number}[];
}

interface StandingsItem {
  id: number;
  name: string;
  points: number;
  played: number;
  legs_won: number;
  legs_lost: number;
  leg_diff: number;
  needs_shootout: boolean;
}

// --- Helper Functions ---
const getBoardName = (tournament: Tournament | null, boardId?: number | null, short = false) => {
    if (!boardId || !tournament?.boards) return '-';
    const board = tournament.boards.find(b => b.id === boardId);
    if (board) {
        if (short) return `Bord ${board.number}`;
        return board.name ? `Bord ${board.number}: ${board.name}` : `Bord ${board.number}`;
    }
    return '-';
};

// --- Components ---

// 1. MATCH CARD (TV STYLE - DARK)
const MatchCard = ({ m, tournament }: { m: Match, tournament: Tournament | null }) => (
    <div className={`
        flex flex-col p-3 rounded-xl border shadow-lg transition-all mb-3 relative overflow-hidden
        ${m.is_completed 
            ? 'bg-slate-900/40 border-slate-800 opacity-70 hover:opacity-100' 
            : 'bg-gradient-to-br from-slate-800 to-slate-700 border-slate-600'}
    `}>
        {/* Header: Board & Referee */}
        <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10 text-xs font-bold uppercase tracking-wider text-slate-400 gap-3">
            <div className="flex items-center gap-2 text-blue-300 shrink-0">
                <Target size={14} />
                <span className="whitespace-nowrap">{getBoardName(tournament, m.board_id)}</span>
            </div>
            
            {/* Rechts: Ronde nummer of Schrijver */}
            <div className="flex items-center justify-end gap-2 text-slate-500 min-w-0 overflow-hidden">
                {m.referee_name ? (
                     <div className="flex items-center gap-1 text-orange-300/80">
                        <PenTool size={12} />
                        <span className="truncate max-w-[80px]">{m.referee_name}</span>
                     </div>
                ) : (
                    <span>RND {m.round_number}</span>
                )}
            </div>
        </div>

        {/* Players & Score */}
        <div className="flex items-center justify-between gap-2">
            <div className={`text-lg font-bold flex-1 text-right truncate ${m.score_p1 > m.score_p2 && m.is_completed ? 'text-green-400' : 'text-white'}`}>
                {m.player1_name || 'Bye'}
            </div>
            
            <div className={`px-3 py-1 rounded-lg font-mono text-xl font-bold border min-w-[70px] text-center shadow-inner mx-1 shrink-0
                ${m.is_completed ? 'bg-slate-900 text-yellow-500 border-slate-700' : 'bg-slate-600 text-slate-400 border-slate-500'}
            `}>
                {m.is_completed ? `${m.score_p1} - ${m.score_p2}` : 'VS'}
            </div>

            <div className={`text-lg font-bold flex-1 text-left truncate ${m.score_p2 > m.score_p1 && m.is_completed ? 'text-green-400' : 'text-white'}`}>
                {m.player2_name || 'Bye'}
            </div>
        </div>
    </div>
);

// 2. BRACKET VIEW (TV STYLE - DARK)
const BracketView = ({ matches, tournament }: { matches: Match[], tournament: Tournament | null }) => {
    const rounds = useMemo(() => {
        const groups: Record<number, Match[]> = {};
        matches.forEach(m => {
            if (!groups[m.round_number]) groups[m.round_number] = [];
            groups[m.round_number].push(m);
        });
        return groups;
    }, [matches]);

    const roundNumbers = Object.keys(rounds).map(Number).sort((a, b) => a - b);
    
    if (matches.length === 0) {
        return (
            <div className="p-8 rounded-lg border-2 border-dashed border-slate-700 text-center text-slate-500">
                <GitMerge className="mx-auto mb-2 opacity-20" size={32} />
                <p className="text-sm">Nog geen knockout wedstrijden.</p>
            </div>
        );
    }

    return (
        <div className="overflow-x-auto pb-4 pt-2 flex justify-start lg:justify-center">
            <div className="flex px-2 gap-4">
                {roundNumbers.map((roundNum) => {
                    const currentRoundMatches = rounds[roundNum];
                    let roundName = `Ronde ${roundNum}`;
                    if (currentRoundMatches.length === 1) roundName = "FINALE";
                    else if (currentRoundMatches.length === 2) roundName = "HALVE FINALE";
                    else if (currentRoundMatches.length === 4) roundName = "KWARTFINALE";

                    return (
                        <div key={roundNum} className="flex flex-col w-72 shrink-0">
                             <div className="text-center font-bold text-blue-400 text-xs mb-4 tracking-wider border-b border-slate-700 pb-2 mx-2 uppercase">
                                {roundName}
                             </div>
                             <div className="flex flex-col gap-3">
                                {currentRoundMatches.sort((a,b) => a.id - b.id).map((match) => (
                                    <MatchCard key={match.id} m={match} tournament={tournament} />
                                ))}
                             </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

// --- MAIN PAGE COMPONENT ---
const TournamentView = () => {
  const { public_uuid } = useParams();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [allStandings, setAllStandings] = useState<Record<number, StandingsItem[]>>({});
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<number | 'ko'>(1);
  const [hasInitialized, setHasInitialized] = useState(false);

  const loadData = async () => {
    try {
      const res = await api.get(`/tournaments/public/${public_uuid}`);
      const tData = res.data;
      setTournament(tData);
      if (tData.id) {
          const standRes = await api.get(`/tournaments/${tData.id}/standings`);
          setAllStandings(standRes.data);
      }
    } catch (err) {
      console.error("Error loading tournament data", err);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
    const interval = setInterval(loadData, 15000); 
    return () => clearInterval(interval);
  }, [public_uuid]);

  const availablePoules = useMemo(() => {
    if (!tournament) return [];
    const poules = new Set<number>();
    tournament.matches.forEach(m => {
        if (m.poule_number) poules.add(m.poule_number);
    });
    return Array.from(poules).sort((a, b) => a - b);
  }, [tournament]);

  const hasKnockout = useMemo(() => {
    return tournament?.matches.some(m => m.poule_number === null) || false;
  }, [tournament]);

  useEffect(() => {
    if (tournament && !loading && !hasInitialized) {
        if (hasKnockout) {
            setActiveTab('ko'); // Standaard naar KO als die er is
        } else if (availablePoules.length > 0) {
            setActiveTab(availablePoules[0]);
        }
        setHasInitialized(true);
    }
  }, [loading, hasKnockout, hasInitialized, tournament, availablePoules]);

  const filteredMatches = useMemo(() => {
    if (!tournament) return [];
    if (activeTab === 'ko') return tournament.matches.filter(m => m.poule_number === null);
    return tournament.matches.filter(m => m.poule_number === activeTab);
  }, [tournament, activeTab]);

  const standings = useMemo(() => {
    if (activeTab === 'ko') return [];
    return allStandings[activeTab as number] || [];
  }, [allStandings, activeTab]);

  if (loading || !tournament) return <div className="min-h-screen bg-slate-900 flex items-center justify-center text-slate-500">Toernooi laden...</div>;

  return (
    <div className="min-h-screen bg-slate-900 text-white flex flex-col w-full overflow-x-hidden font-sans">
      
      {/* 1. HEADER */}
      <header className="bg-slate-800 p-3 shadow-xl sticky top-0 z-50 w-full border-b border-slate-700">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-lg md:text-2xl font-black flex items-center gap-3 uppercase tracking-wider">
                <Trophy className="text-yellow-500 shrink-0" size={24} />
                <span className="truncate max-w-[200px] md:max-w-none text-white">{tournament.name}</span>
            </h1>
            <button 
                onClick={loadData} 
                className="p-2 bg-slate-700 hover:bg-slate-600 rounded-lg text-slate-300 hover:text-white transition-colors border border-slate-600"
                title="Verversen"
            >
                <RefreshCw size={18} />
            </button>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-3 md:p-6">
        
        {/* 2. TABBLADEN NAVIGATIE */}
        <div className="flex border-b border-slate-700 mb-6 overflow-x-auto gap-1 pb-0 scrollbar-hide">
            {availablePoules.map(num => (
                <button
                    key={num}
                    onClick={() => setActiveTab(num)}
                    className={`px-5 py-3 font-bold text-sm md:text-base rounded-t-xl whitespace-nowrap transition-all border-t border-l border-r ${
                        activeTab === num 
                        ? 'bg-slate-800 border-slate-700 text-blue-400 translate-y-[1px]' 
                        : 'bg-slate-900 border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    }`}
                >
                    POULE {num}
                </button>
            ))}
            {hasKnockout && (
                <button
                    onClick={() => setActiveTab('ko')}
                    className={`px-5 py-3 font-bold text-sm md:text-base rounded-t-xl whitespace-nowrap transition-all border-t border-l border-r ${
                        activeTab === 'ko' 
                        ? 'bg-slate-800 border-slate-700 text-orange-500 translate-y-[1px]' 
                        : 'bg-slate-900 border-transparent text-slate-500 hover:text-slate-300 hover:bg-slate-800/50'
                    }`}
                >
                    KNOCKOUT
                </button>
            )}
        </div>

        {/* 3. INHOUD */}
        {activeTab !== 'ko' ? (
            <div className="grid gap-6 xl:grid-cols-12">
                
                {/* === LEFT: STANDINGS (TV Style) === */}
                <div className="xl:col-span-7 bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden flex flex-col">
                    <div className="bg-blue-900/40 p-4 border-b border-slate-600 font-bold text-lg text-blue-200 flex items-center gap-3">
                        <LayoutGrid size={20} /> TUSSENSTAND
                    </div>
                    
                    {/* A. MOBILE CARD VIEW */}
                    <div className="block md:hidden bg-slate-800 p-3 space-y-3">
                        {standings.map((row, index) => {
                            const isQualified = index < (tournament.qualifiers_per_poule || 2);
                            return (
                                <div key={row.name} className="bg-slate-700/50 p-4 rounded-xl border border-slate-600 relative">
                                    <div className="flex justify-between items-center mb-3">
                                        <div className="flex items-center gap-3 overflow-hidden">
                                            <span className="text-slate-500 font-mono font-bold w-6 text-sm">#{index + 1}</span>
                                            <span className="font-bold text-white text-lg truncate">{row.name}</span>
                                            {isQualified && <Medal size={16} className="text-green-500 shrink-0" />}
                                        </div>
                                        <div className="bg-slate-900 text-yellow-500 font-bold px-3 py-1 rounded-lg text-sm shrink-0 border border-slate-700">
                                            {row.points} P
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-1 text-center text-xs text-slate-400 bg-slate-800/50 rounded-lg p-2">
                                         <div className="flex flex-col border-r border-slate-600">
                                            <span className="text-[10px] uppercase tracking-wider mb-1">Gewonnen</span>
                                            <span className="text-green-400 font-bold text-sm">{Math.floor(row.points/2)}</span>
                                         </div>
                                         <div className="flex flex-col border-r border-slate-600">
                                            <span className="text-[10px] uppercase tracking-wider mb-1">Verloren</span>
                                            <span className="text-red-400 font-bold text-sm">{row.played - Math.floor(row.points/2)}</span>
                                         </div>
                                         <div className="flex flex-col">
                                            <span className="text-[10px] uppercase tracking-wider mb-1">Saldo</span>
                                            <span className="text-slate-200 font-bold text-sm">{row.leg_diff > 0 ? `+${row.leg_diff}` : row.leg_diff}</span>
                                         </div>
                                    </div>
                                    
                                    {row.needs_shootout && (
                                        <div className="mt-2 text-center bg-red-900/30 text-red-400 text-[10px] font-bold py-1 rounded border border-red-900/50">
                                            ⚠️ Shoot-out nodig
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* B. DESKTOP TABLE VIEW */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-slate-800 text-slate-500 text-xs uppercase tracking-wider border-b border-slate-700">
                                <tr>
                                    <th className="p-4 text-center w-14">#</th>
                                    <th className="p-4">Speler</th>
                                    <th className="p-4 text-center w-16" title="Gewonnen">W</th>
                                    <th className="p-4 text-center w-16" title="Verloren">V</th>
                                    <th className="p-4 text-center w-16">+/-</th>
                                    <th className="p-4 text-center w-24 font-bold text-white">PNT</th>
                                </tr>
                            </thead>
                            <tbody className="divide-y divide-slate-700">
                                {standings.map((row, index) => {
                                    const isQualified = index < (tournament.qualifiers_per_poule || 2);
                                    const wins = Math.floor(row.points / 2);
                                    const losses = row.played - wins;

                                    return (
                                        <tr key={row.name} className={`hover:bg-slate-700/50 transition-colors ${isQualified ? 'bg-green-900/10' : ''}`}>
                                            <td className="p-4 text-center text-slate-500 font-mono text-lg font-bold">{index + 1}</td>
                                            <td className="p-4 font-bold text-lg flex items-center gap-3">
                                                {row.name}
                                                {isQualified && <Medal size={16} className="text-green-500" />}
                                                {row.needs_shootout && (
                                                    <span className="text-[10px] bg-red-900/50 text-red-400 px-2 py-0.5 rounded-full font-bold border border-red-800">SO</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center text-green-400/80">{wins}</td>
                                            <td className="p-4 text-center text-red-400/80">{losses}</td>
                                            <td className="p-4 text-center text-slate-400">{row.leg_diff > 0 ? `+${row.leg_diff}` : row.leg_diff}</td>
                                            <td className="p-4 text-center font-bold text-yellow-500 text-xl">{row.points}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                     <div className="bg-slate-900/30 p-2 border-t border-slate-700 flex items-center justify-center gap-2 text-[10px] md:text-xs text-slate-500 shrink-0">
                        <Info size={14} className="text-blue-400" />
                        <span className="font-medium tracking-wide">
                            Ranking: Punten &gt; Saldo &gt; Onderling &gt; Shoot-out
                        </span>
                    </div>
                </div>

                {/* === RIGHT: MATCHES LIST (TV Style) === */}
                <div className="xl:col-span-5 flex flex-col gap-4">
                    <div className="bg-slate-800 rounded-2xl shadow-xl border border-slate-700 overflow-hidden flex flex-col h-full max-h-[800px]">
                        <div className="bg-slate-700/50 p-4 font-bold text-slate-300 border-b border-slate-600 flex items-center gap-3">
                            <ListFilter size={20} /> WEDSTRIJDEN
                        </div>
                        <div className="overflow-y-auto p-4 custom-scrollbar space-y-1">
                            {filteredMatches.map((match) => (
                                <MatchCard key={match.id} m={match} tournament={tournament} />
                            ))}
                            {filteredMatches.length === 0 && (
                                <div className="text-center text-slate-500 py-8 italic">Geen wedstrijden gevonden.</div>
                            )}
                        </div>
                    </div>
                </div>

            </div>
        ) : (
            // === KNOCKOUT VIEW ===
            <div className="bg-slate-800 p-4 md:p-8 rounded-2xl shadow-xl border border-slate-700 overflow-x-auto min-h-[500px]">
                <BracketView matches={filteredMatches} tournament={tournament} />
            </div>
        )}
      </main>
    </div>
  );
};

export default TournamentView;