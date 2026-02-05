import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Trophy, LayoutGrid, GitMerge, RefreshCw, Play, Pause, Medal, AlertCircle, BarChart3 } from 'lucide-react';

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
}

interface Tournament {
  id: number;
  name: string;
  status: string;
  format: string;
  scorer_uuid: string;
  qualifiers_per_poule?: number; 
  starting_legs_group?: number;
  starting_legs_ko?: number;
  matches: Match[];
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

// --- Helper Components ---

const BracketView = ({ matches }: { matches: Match[] }) => {
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
            <div className="bg-white p-8 rounded-lg border-2 border-dashed border-gray-300 text-center text-gray-500">
                <GitMerge className="mx-auto mb-2 opacity-20" size={32} />
                <p className="text-sm">Knockout Phase Pending...</p>
            </div>
        );
    }

    const BASE_HEIGHT = 120;
    
    return (
        <div className="overflow-x-auto pb-4 pt-2 flex justify-start md:justify-center">
            <div className="flex px-2">
                {roundNumbers.map((roundNum, colIndex) => {
                    const currentRoundMatches = rounds[roundNum];
                    return (
                        <div key={roundNum} className="flex flex-col w-64 md:w-72">
                             <div className="text-center font-bold text-gray-500 text-[10px] md:text-xs mb-4 tracking-wider border-b border-gray-200 pb-2 mx-2">
                                {`RONDE ${roundNum}`}
                             </div>
                             <div className="flex flex-col justify-center flex-1">
                                {currentRoundMatches.map((match, i) => (
                                    <div key={match.id} style={{ height: BASE_HEIGHT * Math.pow(2, colIndex) }} className="flex items-center justify-center relative">
                                        <div className={`w-full mx-1 bg-white border rounded shadow-sm p-2 text-xs relative z-10 ${match.is_completed ? 'border-gray-200' : 'border-blue-400 ring-1 ring-blue-50'}`}>
                                            <div className={`flex justify-between border-b pb-1 mb-1 ${match.score_p1 > match.score_p2 && match.is_completed ? 'font-bold text-gray-900 bg-green-50' : ''}`}>
                                                <span className="truncate">{match.player1_name}</span>
                                                <span className="font-mono">{match.score_p1}</span>
                                            </div>
                                            <div className={`flex justify-between ${match.score_p2 > match.score_p1 && match.is_completed ? 'font-bold text-gray-900 bg-green-50' : ''}`}>
                                                <span className="truncate">{match.player2_name}</span>
                                                <span className="font-mono">{match.score_p2}</span>
                                            </div>
                                        </div>
                                    </div>
                                ))}
                             </div>
                        </div>
                    )
                })}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const TournamentView = () => {
  const { public_uuid } = useParams();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [allStandings, setAllStandings] = useState<Record<number, StandingsItem[]>>({});
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<number | 'ko'>(1);
  const [hasInitialized, setHasInitialized] = useState(false);
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

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
    if (tournament && !loading) {
        if (!hasInitialized) {
            if (hasKnockout) {
                setActiveTab('ko');
            } else if (availablePoules.length > 0) {
                setActiveTab(availablePoules[0]);
            }
            setHasInitialized(true);
        }
    }
  }, [loading, hasKnockout, hasInitialized, tournament, availablePoules]);

  useEffect(() => {
    if (isAutoPlay && !hasKnockout) { 
      autoPlayRef.current = setInterval(() => {
        setActiveTab((current) => {
          const sequence: (number | 'ko')[] = [...availablePoules];
          const currentIndex = sequence.indexOf(current);
          const nextIndex = (currentIndex + 1) % sequence.length;
          return sequence[nextIndex];
        });
      }, 10000);
    } else {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    }
    return () => {
      if (autoPlayRef.current) clearInterval(autoPlayRef.current);
    };
  }, [isAutoPlay, availablePoules, hasKnockout]);

  const filteredMatches = useMemo(() => {
    if (!tournament) return [];
    if (activeTab === 'ko') return tournament.matches.filter(m => m.poule_number === null);
    return tournament.matches.filter(m => m.poule_number === activeTab);
  }, [tournament, activeTab]);

  const standings = useMemo(() => {
    if (activeTab === 'ko') return [];
    return allStandings[activeTab as number] || [];
  }, [allStandings, activeTab]);

  const handleTabClick = (tab: number | 'ko') => {
    setActiveTab(tab);
  };

  if (loading || !tournament || !hasInitialized) return <div className="p-10 text-center text-white">Loading...</div>;

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col w-full overflow-x-hidden">
      
      {/* Header */}
      <header className="bg-slate-900 text-white p-3 shadow-xl sticky top-0 z-50 w-full">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <h1 className="text-lg md:text-3xl font-extrabold flex items-center gap-2">
                <Trophy className="text-yellow-400 shrink-0" size={20} />
                <span className="truncate max-w-[200px] md:max-w-none">{tournament.name}</span>
            </h1>
            <div className="flex gap-2">
                {/* AutoPlay alleen tonen op grotere schermen */}
                <button 
                     onClick={() => setIsAutoPlay(!isAutoPlay)}
                     className={`hidden md:flex items-center gap-2 px-3 py-1 rounded-lg font-bold border text-sm ${isAutoPlay ? 'bg-blue-600 border-blue-500' : 'bg-slate-800 border-slate-700'}`}
                 >
                     {isAutoPlay ? <Pause size={16} /> : <Play size={16} />}
                     TV MODE
                 </button>
                <button onClick={loadData} className="p-2 bg-slate-800 rounded text-slate-400"><RefreshCw size={18} /></button>
            </div>
        </div>
      </header>

      <main className="flex-1 w-full max-w-7xl mx-auto p-2 md:p-6">
        {/* Tabs Scroller */}
        <div className="flex border-b border-gray-200 mb-4 overflow-x-auto gap-1 pb-1">
            {availablePoules.map(num => (
                <button
                    key={num}
                    onClick={() => handleTabClick(num)}
                    className={`px-4 py-2 font-bold text-sm md:text-lg rounded-t-lg whitespace-nowrap ${
                        activeTab === num ? 'bg-white border text-blue-600' : 'text-gray-400'
                    }`}
                >
                    POULE {num}
                </button>
            ))}
            {hasKnockout && (
                <button
                    onClick={() => handleTabClick('ko')}
                    className={`px-4 py-2 font-bold text-sm md:text-lg rounded-t-lg whitespace-nowrap ${
                        activeTab === 'ko' ? 'bg-white border text-orange-600' : 'text-gray-400'
                    }`}
                >
                    KO
                </button>
            )}
        </div>

        {activeTab !== 'ko' ? (
            <div className="grid gap-4 xl:grid-cols-3">
                
                {/* === STANDINGS BLOCK === */}
                <div className="xl:col-span-2 bg-white rounded-xl shadow border border-gray-100 overflow-hidden">
                    <div className="bg-blue-600 p-3 text-white font-bold flex items-center gap-2">
                        <LayoutGrid size={18} /> STANDINGS
                    </div>
                    
                    {/* A. MOBILE CARD VIEW (Alleen zichtbaar op mobile) */}
                    <div className="block md:hidden bg-gray-50 p-2 space-y-2">
                        {standings.map((row, index) => {
                            const isQualified = index < (tournament.qualifiers_per_poule || 2);
                            return (
                                <div key={row.name} className="bg-white p-3 rounded shadow-sm border border-gray-200 relative">
                                    <div className="flex justify-between items-center mb-2">
                                        <div className="flex items-center gap-2 overflow-hidden">
                                            <span className="text-gray-400 font-mono font-bold w-5 text-sm">#{index + 1}</span>
                                            <span className="font-bold text-gray-800 text-base truncate">{row.name}</span>
                                            {isQualified && <Medal size={14} className="text-green-500 shrink-0" />}
                                        </div>
                                        <div className="bg-blue-100 text-blue-800 font-bold px-2 py-0.5 rounded text-sm shrink-0">
                                            {row.points} P
                                        </div>
                                    </div>
                                    
                                    <div className="grid grid-cols-3 gap-1 text-center text-xs text-gray-500 bg-gray-50 rounded p-1.5">
                                         <div className="flex flex-col border-r border-gray-200">
                                            <span className="text-[10px] uppercase">Gewonnen</span>
                                            <span className="text-green-600 font-bold text-sm">{Math.floor(row.points/2)}</span>
                                         </div>
                                         <div className="flex flex-col border-r border-gray-200">
                                            <span className="text-[10px] uppercase">Verloren</span>
                                            <span className="text-red-400 font-bold text-sm">{row.played - Math.floor(row.points/2)}</span>
                                         </div>
                                         <div className="flex flex-col">
                                            <span className="text-[10px] uppercase">Saldo</span>
                                            <span className="text-gray-700 font-bold text-sm">{row.leg_diff > 0 ? `+${row.leg_diff}` : row.leg_diff}</span>
                                         </div>
                                    </div>
                                    
                                    {row.needs_shootout && (
                                        <div className="mt-1 text-center bg-red-50 text-red-600 text-[10px] font-bold py-1 rounded border border-red-100">
                                            ⚠️ Shoot-out nodig
                                        </div>
                                    )}
                                </div>
                            );
                        })}
                    </div>

                    {/* B. DESKTOP TABLE VIEW (Alleen zichtbaar op desktop) */}
                    <div className="hidden md:block overflow-x-auto">
                        <table className="w-full text-left">
                            <thead className="bg-gray-50 text-gray-500 text-sm border-b">
                                <tr>
                                    <th className="p-4 text-center w-12">#</th>
                                    <th className="p-4">Player</th>
                                    <th className="p-4 text-center w-16">W</th>
                                    <th className="p-4 text-center w-16">L</th>
                                    <th className="p-4 text-center w-16">+/-</th>
                                    <th className="p-4 text-center w-20 font-bold">PTS</th>
                                </tr>
                            </thead>
                            <tbody>
                                {standings.map((row, index) => {
                                    const isQualified = index < (tournament.qualifiers_per_poule || 2);
                                    const wins = Math.floor(row.points / 2);
                                    const losses = row.played - wins;

                                    return (
                                        <tr key={row.name} className={`border-b hover:bg-gray-50 ${isQualified ? 'bg-green-50/20' : ''}`}>
                                            <td className="p-4 text-center text-gray-400 font-mono">{index + 1}</td>
                                            <td className="p-4 font-bold flex items-center gap-2">
                                                {row.name}
                                                {isQualified && <Medal size={16} className="text-green-500" />}
                                                {row.needs_shootout && (
                                                    <span className="text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold">SO</span>
                                                )}
                                            </td>
                                            <td className="p-4 text-center text-green-600">{wins}</td>
                                            <td className="p-4 text-center text-red-400">{losses}</td>
                                            <td className="p-4 text-center text-gray-500">{row.leg_diff > 0 ? `+${row.leg_diff}` : row.leg_diff}</td>
                                            <td className="p-4 text-center font-bold text-blue-700 text-xl">{row.points}</td>
                                        </tr>
                                    );
                                })}
                            </tbody>
                        </table>
                    </div>
                </div>

{/* === MATCHES BLOCK === */}
<div className="bg-white rounded-xl shadow border border-gray-100 overflow-hidden flex flex-col max-h-[600px]">
    <div className="bg-gray-100 p-3 font-bold text-gray-700 border-b flex items-center gap-2">
            <BarChart3 size={18} /> MATCHES
    </div>
    <div className="overflow-y-auto p-0">
        {filteredMatches.map((match) => (
            <div key={match.id} className="p-3 border-b hover:bg-gray-50 transition-colors">
                {/* Header: Ronde info */}
                <div className="text-[10px] font-bold text-gray-400 mb-2 flex justify-between">
                    <span>RND {match.round_number}</span>
                    {match.is_completed && <span className="text-green-600">FIN</span>}
                </div>
                
                {/* De Flex Container: Kolom op mobiel (onder elkaar), Rij op desktop (naast elkaar) */}
                <div className="flex flex-col md:flex-row items-center justify-between gap-1 md:gap-4">
                    
                    {/* SPELER 1 */}
                    <span className={`w-full md:flex-1 truncate text-center md:text-right text-base md:text-sm order-1 md:order-1 ${
                        match.score_p1 > match.score_p2 && match.is_completed ? 'font-bold text-gray-900' : 'text-gray-600'
                    }`}>
                        {match.player1_name || 'Bye'}
                    </span>
                    
                    {/* SCORE BADGE */}
                    <span className={`order-2 md:order-2 shrink-0 min-w-[3rem] text-center px-3 py-1 rounded-full font-mono font-bold text-xs my-1 md:my-0 ${
                        match.is_completed ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-400'
                    }`}>
                        {match.is_completed ? `${match.score_p1}-${match.score_p2}` : 'VS'}
                    </span>
                    
                    {/* SPELER 2 */}
                    <span className={`w-full md:flex-1 truncate text-center md:text-left text-base md:text-sm order-3 md:order-3 ${
                        match.score_p2 > match.score_p1 && match.is_completed ? 'font-bold text-gray-900' : 'text-gray-600'
                    }`}>
                        {match.player2_name || 'Bye'}
                    </span>

                </div>
            </div>
        ))}
    </div>
</div>

            </div>
        ) : (
            <div className="bg-white p-2 md:p-8 rounded-xl shadow-lg border border-gray-200 overflow-x-auto min-h-[500px]">
                <BracketView matches={filteredMatches} />
            </div>
        )}
      </main>
    </div>
  );
};

export default TournamentView;