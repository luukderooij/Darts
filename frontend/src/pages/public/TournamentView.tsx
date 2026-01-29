import { useEffect, useState, useMemo, useRef } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Trophy, LayoutGrid, GitMerge, RefreshCw, Play, Pause, Medal, AlertCircle } from 'lucide-react';

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

// Nieuw Type voor de data die uit de backend /standings endpoint komt
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
    
    const getRoundName = (matchCount: number, roundIndex: number) => {
        if (matchCount === 1) return "FINALE";
        if (matchCount === 2) return "HALVE FINALE";
        if (matchCount === 4) return "KWARTFINALE";
        if (matchCount === 8) return "LAATSTE 16";
        return `RONDE ${roundIndex + 1}`;
    };

    if (matches.length === 0) {
        return (
            <div className="bg-white p-12 rounded-lg border-2 border-dashed border-gray-300 text-center text-gray-500">
                <GitMerge className="mx-auto mb-2 opacity-20" size={40} />
                <p className="text-xl">Knockout Phase Pending...</p>
            </div>
        );
    }

    const BASE_HEIGHT = 160;
    
    return (
        <div className="overflow-x-auto pb-8 pt-4 flex justify-center">
            <div className="flex px-4">
                {roundNumbers.map((roundNum, colIndex) => {
                    const currentRoundMatches = rounds[roundNum];
                    const roundName = getRoundName(currentRoundMatches.length, colIndex);
                    const isLastColumn = colIndex === roundNumbers.length - 1;
                    const slotHeight = BASE_HEIGHT * Math.pow(2, colIndex);

                    return (
                        <div key={roundNum} className="flex flex-col w-64 md:w-80 transition-all duration-500">
                            <div className="text-center font-bold text-gray-500 uppercase text-xs mb-6 tracking-wider border-b border-gray-200 pb-2 mx-4">
                                {roundName}
                            </div>
                            <div className="flex flex-col justify-center flex-1">
                                {currentRoundMatches.map((match, matchIndex) => {
                                    const isTop = matchIndex % 2 === 0;
                                    const isBottom = matchIndex % 2 !== 0;

                                    return (
                                        <div 
                                            key={match.id} 
                                            className="relative flex items-center justify-center"
                                            style={{ height: `${slotHeight}px` }} 
                                        >
                                            {colIndex > 0 && (
                                                <div className="absolute -left-6 w-6 h-0.5 bg-gray-300"></div>
                                            )}
                                            {!isLastColumn && (
                                                <>
                                                    {isTop && (
                                                        <div className="absolute -right-6 top-1/2 w-6 border-t-2 border-r-2 border-gray-300 rounded-tr-md" style={{ height: '50%' }}></div>
                                                    )}
                                                    {isBottom && (
                                                        <div className="absolute -right-6 top-0 w-6 border-b-2 border-r-2 border-gray-300 rounded-br-md" style={{ height: '50%' }}></div>
                                                    )}
                                                </>
                                            )}

                                            <div className={`w-full mx-2 bg-white border-2 rounded-lg shadow-sm overflow-hidden text-sm relative z-10 transform transition-transform hover:scale-105
                                                ${match.is_completed ? 'border-gray-200' : 'border-blue-400 ring-2 ring-blue-100'}
                                            `}>
                                                <div className={`px-3 py-3 flex justify-between items-center border-b border-gray-100 ${match.score_p1 > match.score_p2 && match.is_completed ? 'bg-green-100 font-bold text-gray-900' : ''}`}>
                                                    <span className="truncate font-medium text-base">{match.player1_name || 'TBD'}</span>
                                                    <span className="font-mono font-bold ml-2 bg-gray-100 px-2 py-1 rounded text-gray-800 text-lg">
                                                        {match.is_completed ? match.score_p1 : '-'}
                                                    </span>
                                                </div>
                                                <div className={`px-3 py-3 flex justify-between items-center ${match.score_p2 > match.score_p1 && match.is_completed ? 'bg-green-100 font-bold text-gray-900' : ''}`}>
                                                    <span className={`truncate font-medium text-base ${!match.player2_name ? 'text-gray-400 italic' : ''}`}>
                                                        {match.player2_name ? match.player2_name : (match.is_completed ? 'BYE' : 'TBD')}
                                                    </span>
                                                    <span className="font-mono font-bold ml-2 bg-gray-100 px-2 py-1 rounded text-gray-800 text-lg">
                                                        {match.is_completed ? match.score_p2 : '-'}
                                                    </span>
                                                </div>
                                            </div>
                                        </div>
                                    );
                                })}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// --- MAIN COMPONENT ---
const TournamentView = () => {
  const { public_uuid } = useParams();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  
  // Nieuwe state voor de officiële standen uit de backend
  const [allStandings, setAllStandings] = useState<Record<number, StandingsItem[]>>({});
  
  const [loading, setLoading] = useState(true);
  
  const [activeTab, setActiveTab] = useState<number | 'ko'>(1);
  const [hasInitialized, setHasInitialized] = useState(false);
  
  const [isAutoPlay, setIsAutoPlay] = useState(false);
  const autoPlayRef = useRef<NodeJS.Timeout | null>(null);

  const loadData = async () => {
    try {
      // 1. Haal toernooi details op (inclusief matches voor de lijst)
      const res = await api.get(`/tournaments/public/${public_uuid}`);
      const tData = res.data;
      setTournament(tData);

      // 2. Haal de berekende standen op van de backend (Source of Truth)
      // We gebruiken tData.id omdat de public user dat nu heeft
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
                setIsAutoPlay(false);
            } else {
                if (availablePoules.length > 0) {
                    setActiveTab(availablePoules[0]);
                }
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

  // Haal de juiste stand op uit de backend data
  const standings = useMemo(() => {
    if (activeTab === 'ko') return [];
    // We geven de lijst terug die de backend heeft berekend
    return allStandings[activeTab as number] || [];
  }, [allStandings, activeTab]);

  const handleTabClick = (tab: number | 'ko') => {
    setActiveTab(tab);
  };

  if (loading || !tournament || !hasInitialized) {
      return (
        <div className="min-h-screen bg-slate-900 flex flex-col items-center justify-center text-white gap-4">
            <RefreshCw className="animate-spin text-blue-500" size={40} />
            <span className="text-xl font-medium tracking-wide">Loading Tournament...</span>
        </div>
      );
  }

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <header className="bg-slate-900 text-white p-4 lg:p-6 shadow-xl sticky top-0 z-50">
        <div className="max-w-7xl mx-auto flex justify-between items-center">
            <div>
               <h1 className="text-2xl md:text-4xl font-extrabold flex items-center gap-3 tracking-tight">
                  <Trophy className="text-yellow-400" size={32} />
                  {tournament.name}
              </h1>
              <div className="flex items-center gap-3 mt-2 opacity-80">
                <span className="text-sm font-medium bg-slate-800 px-3 py-1 rounded-full border border-slate-700">
                    {tournament.format === 'hybrid' ? 'Hybride' : tournament.format}
                </span>
                <span className={`text-sm px-3 py-1 rounded-full font-bold border ${tournament.status === 'active' ? 'bg-green-500/20 border-green-500 text-green-400' : 'bg-gray-500/20 border-gray-500'}`}>
                    {tournament.status}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-4">
                {(availablePoules.length > 1 && !hasKnockout) && (
                    <button 
                        onClick={() => setIsAutoPlay(!isAutoPlay)}
                        className={`flex items-center gap-2 px-4 py-2 rounded-lg font-bold transition-all border ${
                            isAutoPlay 
                            ? 'bg-blue-600 text-white border-blue-500 shadow-[0_0_15px_rgba(37,99,235,0.5)]' 
                            : 'bg-slate-800 text-slate-400 border-slate-700 hover:bg-slate-700'
                        }`}
                    >
                        {isAutoPlay ? <Pause size={20} /> : <Play size={20} />}
                        <span className="hidden md:inline">{isAutoPlay ? 'AUTO ON' : 'TV MODE'}</span>
                    </button>
                )}
                <button 
                    onClick={loadData} 
                    className="p-2 bg-slate-800 rounded-lg hover:bg-slate-700 text-slate-400 hover:text-white transition"
                >
                    <RefreshCw size={24} />
                </button>
            </div>
        </div>
      </header>

      <main className="flex-1 max-w-7xl w-full mx-auto p-4 lg:p-8">
        <div className="flex border-b border-gray-200 mb-8 overflow-x-auto no-scrollbar gap-1">
            {availablePoules.map(num => (
                <button
                    key={num}
                    onClick={() => handleTabClick(num)}
                    className={`flex items-center gap-2 px-6 py-4 font-bold text-lg transition-all rounded-t-lg whitespace-nowrap ${
                        activeTab === num 
                        ? 'bg-white border-x border-t border-gray-200 text-blue-600 shadow-sm relative top-[1px]' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <LayoutGrid size={20} />
                    POULE {num}
                </button>
            ))}
            
            {hasKnockout && (
                <button
                    onClick={() => handleTabClick('ko')}
                    className={`flex items-center gap-2 px-6 py-4 font-bold text-lg transition-all rounded-t-lg whitespace-nowrap ${
                        activeTab === 'ko'
                        ? 'bg-white border-x border-t border-gray-200 text-orange-600 shadow-sm relative top-[1px]' 
                        : 'text-gray-400 hover:text-gray-600 hover:bg-gray-100'
                    }`}
                >
                    <GitMerge size={20} />
                    KNOCKOUT
                </button>
            )}
        </div>

        <div className="animate-fade-in">
            {activeTab !== 'ko' ? (
                <div className="grid gap-8 xl:grid-cols-3">
                    <div className="xl:col-span-2 flex flex-col">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex-1">
                            <div className="bg-gradient-to-r from-blue-600 to-blue-700 p-4 text-white">
                                <h3 className="font-bold text-xl flex items-center gap-2">
                                    <LayoutGrid size={24} /> 
                                    STANDINGS - POULE {activeTab}
                                </h3>
                            </div>
                            <div className="overflow-x-auto">
                                <table className="w-full text-left border-collapse">
                                    <thead>
                                        <tr className="bg-gray-50 text-gray-500 text-sm uppercase tracking-wider border-b border-gray-200">
                                            <th className="p-4 w-12 text-center">#</th>
                                            <th className="p-4">Player</th>
                                            <th className="p-4 text-center">W</th>
                                            <th className="p-4 text-center">L</th>
                                            <th className="p-4 text-center">+/-</th>
                                            <th className="p-4 text-center font-bold text-gray-800">PTS</th>
                                        </tr>
                                    </thead>
                                    <tbody className="text-gray-700">
                                        {standings.map((row, index) => {
                                            const isQualified = index < (tournament.qualifiers_per_poule || 2);
                                            // Bereken Winst/Verlies voor display (Backend geeft alleen punten)
                                            // Aanname: 2 punten per winst.
                                            const wins = Math.floor(row.points / 2);
                                            const losses = row.played - wins;

                                            return (
                                                <tr key={row.name} className={`border-b border-gray-50 hover:bg-blue-50/50 transition-colors ${isQualified ? 'bg-green-50/30' : ''}`}>
                                                    <td className="p-4 text-center font-mono text-gray-400">{index + 1}</td>
                                                    
                                                    <td className="p-4 font-bold text-lg flex items-center gap-3">
                                                        <span className="truncate">{row.name}</span>
                                                        {isQualified && (
                                                            <span title="Gekwalificeerd">
                                                                <Medal size={16} className="text-green-500" />
                                                            </span>
                                                        )}
                                                        {/* De Backend bepaalt nu of er een shootout nodig is */}
                                                        {row.needs_shootout && (
                                                            <span 
                                                                className="flex items-center gap-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full animate-pulse font-bold border border-red-200"
                                                                title="9-Dart Shoot-out vereist: Spelers staan exact gelijk"
                                                            >
                                                                <AlertCircle size={10} /> 9-DART SO
                                                            </span>
                                                        )}
                                                    </td>

                                                    <td className="p-4 text-center font-medium text-green-600">{wins}</td>
                                                    <td className="p-4 text-center text-red-400">{losses}</td>
                                                    <td className="p-4 text-center text-gray-500 font-mono">
                                                        {row.leg_diff > 0 ? `+${row.leg_diff}` : row.leg_diff}
                                                    </td>
                                                    <td className="p-4 text-center font-bold text-2xl text-blue-700">{row.points}</td>
                                                </tr>
                                            );
                                        })}
                                    </tbody>
                                </table>
                            </div>
                        </div>
                    </div>

                    <div className="flex flex-col">
                        <div className="bg-white rounded-xl shadow-lg border border-gray-100 overflow-hidden flex-1 max-h-[600px] flex flex-col">
                            <div className="bg-gray-100 p-4 border-b border-gray-200">
                                <h3 className="font-bold text-gray-700 text-lg">MATCHES</h3>
                            </div>
                            <div className="divide-y divide-gray-100 overflow-y-auto p-0 flex-1">
                                {filteredMatches.map((match) => (
                                    <div key={match.id} className="p-4 hover:bg-gray-50 transition-colors">
                                        <div className="flex justify-between text-xs font-bold text-gray-400 uppercase tracking-wide mb-2">
                                            <span>Ronde {match.round_number}</span>
                                            <span className="flex items-center gap-1 text-gray-500">
                                                Ref: <span className="text-gray-700">{match.referee_name || "-"}</span>
                                            </span>
                                            {match.is_completed && <span className="text-green-600 font-bold">Finished</span>}
                                        </div>
                                        <div className="flex items-center justify-between gap-2">
                                            <span className={`flex-1 truncate text-right font-medium text-lg ${match.score_p1 > match.score_p2 && match.is_completed ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
                                                {match.player1_name || 'Bye'}
                                            </span>
                                            <div className={`px-3 py-1 rounded-lg font-mono font-bold text-lg min-w-[3.5rem] text-center ${match.is_completed ? 'bg-slate-800 text-white' : 'bg-gray-100 text-gray-400'}`}>
                                                {match.is_completed ? `${match.score_p1}-${match.score_p2}` : 'VS'}
                                            </div>
                                            <span className={`flex-1 truncate text-left font-medium text-lg ${match.score_p2 > match.score_p1 && match.is_completed ? 'text-gray-900 font-bold' : 'text-gray-500'}`}>
                                                {match.player2_name || 'Bye'}
                                            </span>
                                        </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    </div>
                </div>
            ) : (
                <div className="bg-white p-4 md:p-8 rounded-xl shadow-lg border border-gray-200 overflow-x-auto min-h-[500px]">
                    <BracketView matches={filteredMatches} />
                </div>
            )}
        </div>
      </main>
    </div>
  );
};

export default TournamentView;