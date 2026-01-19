import { useEffect, useState, useMemo } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api';
import { Trophy, Tablet, LayoutGrid, GitMerge, AlertCircle, Medal } from 'lucide-react';
import { useAuth } from '../../hooks/useAuth';

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
}

interface Tournament {
  id: number;
  name: string;
  status: string;
  format: string;
  scorer_uuid: string;
  matches: Match[];
}

// --- Helper Components ---

// 1. De "Bracket" Weergave (Nieuw!)
const BracketView = ({ matches }: { matches: Match[] }) => {
    // Groepeer wedstrijden per ronde
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
            <div className="bg-white p-12 rounded-lg border border-dashed border-gray-300 text-center text-gray-500">
                <GitMerge className="mx-auto mb-2 opacity-20" size={40} />
                Nog geen knockout wedstrijden.
            </div>
        );
    }

    return (
        <div className="overflow-x-auto pb-8 pt-4">
            <div className="flex gap-8 min-w-max px-4">
                {roundNumbers.map((roundNum, index) => {
                    const isFinal = index === roundNumbers.length - 1;
                    return (
                        <div key={roundNum} className="flex flex-col w-64">
                            {/* Ronde Titel */}
                            <div className="text-center font-bold text-gray-500 uppercase text-xs mb-4 tracking-wider">
                                {isFinal ? 'FINALE' : `Ronde ${roundNum}`}
                            </div>
                            
                            {/* De kolom met wedstrijden - Space Around zorgt voor de "Boom" look */}
                            <div className="flex flex-col justify-around flex-1 gap-4">
                                {rounds[roundNum].map(match => (
                                    <div key={match.id} className="relative flex items-center">
                                        {/* Connector lijn links (behalve eerste ronde) */}
                                        {index > 0 && (
                                            <div className="absolute -left-4 w-4 h-0.5 bg-gray-300"></div>
                                        )}

                                        {/* Match Card */}
                                        <div className={`w-full bg-white border rounded shadow-sm overflow-hidden text-sm relative z-10 
                                            ${match.is_completed ? 'border-gray-300' : 'border-blue-200 ring-1 ring-blue-50'}
                                        `}>
                                            {/* Status streepje */}
                                            <div className={`h-1 w-full ${match.is_completed ? 'bg-gray-400' : 'bg-blue-500'}`}></div>
                                            
                                            {/* Speler 1 */}
                                            <div className={`px-3 py-2 flex justify-between items-center border-b border-gray-50 ${match.score_p1 > match.score_p2 && match.is_completed ? 'bg-green-50 font-bold text-gray-900' : ''}`}>
                                                <span className="truncate">{match.player1_name || 'TBD'}</span>
                                                <span className="font-mono font-bold ml-2">{match.is_completed ? match.score_p1 : '-'}</span>
                                            </div>

                                            {/* Speler 2 */}
                                            <div className={`px-3 py-2 flex justify-between items-center ${match.score_p2 > match.score_p1 && match.is_completed ? 'bg-green-50 font-bold text-gray-900' : ''}`}>
                                                <span className="truncate">{match.player2_name || 'TBD'}</span>
                                                <span className="font-mono font-bold ml-2">{match.is_completed ? match.score_p2 : '-'}</span>
                                            </div>
                                        </div>

                                        {/* Connector lijn rechts (behalve finale) */}
                                        {!isFinal && (
                                            <div className="absolute -right-4 w-4 h-0.5 bg-gray-300"></div>
                                        )}
                                    </div>
                                ))}
                            </div>
                        </div>
                    );
                })}
            </div>
        </div>
    );
};

// 2. Helper voor Poule Standen
const calculateStandings = (matches: Match[]) => {
  const stats: Record<string, { p: number, w: number, l: number, pts: number, ld: number }> = {};
  
  matches.forEach(m => {
    if (m.player1_name && !stats[m.player1_name]) stats[m.player1_name] = { p:0, w:0, l:0, pts:0, ld:0 };
    if (m.player2_name && !stats[m.player2_name]) stats[m.player2_name] = { p:0, w:0, l:0, pts:0, ld:0 };

    if (m.is_completed && m.player1_name && m.player2_name) {
      const p1 = stats[m.player1_name];
      const p2 = stats[m.player2_name];

      p1.p++; p2.p++; 
      p1.ld += (m.score_p1 - m.score_p2); 
      p2.ld += (m.score_p2 - m.score_p1);

      if (m.score_p1 > m.score_p2) {
        p1.w++; p1.pts += 2; 
        p2.l++;
      } else {
        p2.w++; p2.pts += 2;
        p1.l++;
      }
    }
  });

  return Object.entries(stats)
    .map(([name, data]) => ({ name, ...data }))
    .sort((a, b) => b.pts - a.pts || b.ld - a.ld);
};

// --- HOOFD COMPONENT ---
const TournamentView = () => {
  const { public_uuid } = useParams();
  const { user } = useAuth();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [loading, setLoading] = useState(true);
  const [activeTab, setActiveTab] = useState<number | 'ko'>(1);

  // --- Data Laden ---
  useEffect(() => {
    const loadData = async () => {
      try {
        const res = await api.get(`/tournaments/public/${public_uuid}`);
        setTournament(res.data);
      } catch (err) {
        console.error("Error loading tournament", err);
      } finally {
        setLoading(false);
      }
    };
    loadData();
    const interval = setInterval(loadData, 10000);
    return () => clearInterval(interval);
  }, [public_uuid]);

  // --- Logica ---
  const handleStartKnockout = async () => {
    if (!tournament) return;
    if (!confirm("Weet je zeker dat je de Knockout fase wilt starten?")) return;
    try {
        await api.post(`/tournaments/${tournament.id}/start-knockout`);
        alert("Knockout fase gegenereerd!");
        window.location.reload(); 
    } catch (err) {
        alert("Kon knockout niet starten.");
    }
  };

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
        if (availablePoules.length === 0 && hasKnockout) setActiveTab('ko');
    }
  }, [loading, availablePoules, hasKnockout]);

  const filteredMatches = useMemo(() => {
    if (!tournament) return [];
    if (activeTab === 'ko') return tournament.matches.filter(m => m.poule_number === null);
    return tournament.matches.filter(m => m.poule_number === activeTab);
  }, [tournament, activeTab]);

  const standings = useMemo(() => {
    if (activeTab === 'ko') return [];
    return calculateStandings(filteredMatches);
  }, [filteredMatches, activeTab]);

  const showKnockoutButton = user && tournament?.format === 'hybrid' && !hasKnockout;

  if (loading) return <div className="p-10 text-center text-gray-500">Laden...</div>;
  if (!tournament) return <div className="p-10 text-center text-red-500">Toernooi niet gevonden</div>;

  return (
    <div className="min-h-screen bg-gray-50 pb-20">
      
      {/* Header */}
      <header className="bg-slate-900 text-white p-6 shadow-md">
        <div className="max-w-6xl mx-auto flex flex-col md:flex-row justify-between items-center gap-4">
            <div>
               <h1 className="text-3xl font-bold flex items-center gap-3">
                <Trophy className="text-yellow-400" />
                {tournament.name}
              </h1>
              <div className="flex items-center gap-3 mt-2">
                <span className="bg-slate-700 px-3 py-0.5 rounded-full text-xs uppercase tracking-wider text-slate-300">
                    {tournament.format === 'hybrid' ? 'Hybride' : tournament.format}
                </span>
                <span className={`text-xs px-2 py-0.5 rounded-full uppercase font-bold ${tournament.status === 'active' ? 'bg-green-500 text-white' : 'bg-gray-500'}`}>
                    {tournament.status}
                </span>
              </div>
            </div>

            <div className="flex items-center gap-3">
                {showKnockoutButton && (
                    <button 
                        onClick={handleStartKnockout}
                        className="bg-orange-600 hover:bg-orange-500 text-white font-bold py-2 px-4 rounded-lg flex items-center gap-2 transition shadow-lg border border-orange-500 animate-pulse"
                    >
                        <GitMerge size={20} />
                        Start Knockout
                    </button>
                )}
                {user && (
                  <Link 
                    to={`/board/${tournament.scorer_uuid}`} 
                    target="_blank"
                    className="bg-blue-600 hover:bg-blue-500 text-white font-bold py-2 px-6 rounded-lg flex items-center gap-2 transition shadow-lg border border-blue-500"
                  >
                    <Tablet size={20} />
                    Open Scorer
                  </Link>
                )}
            </div>
        </div>
      </header>

      <div className="max-w-6xl mx-auto mt-8 px-4">
        
        {/* TABS */}
        <div className="flex border-b border-gray-200 mb-6 overflow-x-auto">
            {availablePoules.map(num => (
                <button
                    key={num}
                    onClick={() => setActiveTab(num)}
                    className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                        activeTab === num 
                        ? 'border-b-2 border-blue-600 text-blue-600 bg-white' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                >
                    <LayoutGrid size={16} />
                    Poule {num}
                </button>
            ))}
            
            {hasKnockout && (
                <button
                    onClick={() => setActiveTab('ko')}
                    className={`flex items-center gap-2 px-6 py-3 font-medium transition-colors whitespace-nowrap ${
                        activeTab === 'ko'
                        ? 'border-b-2 border-orange-500 text-orange-600 bg-white' 
                        : 'text-gray-500 hover:text-gray-700 hover:bg-gray-100'
                    }`}
                >
                    <GitMerge size={16} />
                    Knockout Bracket
                </button>
            )}
        </div>

        {/* CONTENT */}
        {activeTab !== 'ko' ? (
            // --- POULE VIEW (Tabel + Lijst) ---
            <div className="grid gap-8 lg:grid-cols-3">
                {/* Kolom 1: Stand (Breder op desktop) */}
                <div className="lg:col-span-2">
                    <div className="bg-white rounded-lg shadow-sm overflow-hidden border border-gray-200 mb-6">
                        <div className="bg-gray-50 p-3 border-b border-gray-200">
                            <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                <LayoutGrid size={18} className="text-gray-400"/> Stand
                            </h3>
                        </div>
                        <div className="overflow-x-auto">
                            <table className="w-full text-left text-sm">
                                <thead className="bg-gray-50 border-b border-gray-100">
                                    <tr>
                                        <th className="p-3 text-gray-500 w-10">#</th>
                                        <th className="p-3 text-gray-500">Speler</th>
                                        <th className="p-3 text-center text-gray-500">W</th>
                                        <th className="p-3 text-center text-gray-500">L</th>
                                        <th className="p-3 text-center text-gray-500">+/-</th>
                                        <th className="p-3 text-center text-gray-800 font-bold">PT</th>
                                    </tr>
                                </thead>
                                <tbody className="divide-y divide-gray-50">
                                    {standings.map((row, index) => (
                                        <tr key={row.name} className={`hover:bg-blue-50 transition-colors ${index < (tournament.qualifiers_per_poule || 2) ? 'bg-green-50/40' : ''}`}>
                                            <td className="p-3 text-gray-400 font-mono">{index + 1}</td>
                                            <td className="p-3 font-medium text-gray-900 flex items-center gap-2">
                                                {row.name}
                                                {index < (tournament.qualifiers_per_poule || 2) && <Medal size={12} className="text-green-600" />}
                                            </td>
                                            <td className="p-3 text-center text-green-600 font-medium">{row.w}</td>
                                            <td className="p-3 text-center text-red-400">{row.l}</td>
                                            <td className="p-3 text-center text-gray-500">{row.ld > 0 ? `+${row.ld}` : row.ld}</td>
                                            <td className="p-3 text-center font-bold text-blue-700">{row.pts}</td>
                                        </tr>
                                    ))}
                                </tbody>
                            </table>
                        </div>
                    </div>
                </div>

                {/* Kolom 2: Wedstrijden Lijst */}
                <div>
                     <div className="bg-white rounded-lg shadow-sm border border-gray-200">
                        <div className="bg-gray-50 p-3 border-b border-gray-200">
                            <h3 className="font-bold text-gray-700">Wedstrijden</h3>
                        </div>
                        <div className="divide-y divide-gray-100 max-h-[500px] overflow-y-auto">
                            {filteredMatches.map((match) => (
                                <div key={match.id} className="p-3 hover:bg-gray-50 text-sm">
                                    <div className="flex justify-between text-xs text-gray-400 mb-1">
                                        <span>Ronde {match.round_number}</span>
                                        {match.is_completed && <span className="text-green-600 font-bold">Afgerond</span>}
                                    </div>
                                    <div className="flex items-center justify-between">
                                        <span className={`truncate w-1/3 ${match.score_p1 > match.score_p2 && match.is_completed ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{match.player1_name || 'Bye'}</span>
                                        <span className="bg-gray-100 px-2 py-0.5 rounded font-mono font-bold text-gray-700 text-xs">
                                            {match.is_completed ? `${match.score_p1} - ${match.score_p2}` : 'vs'}
                                        </span>
                                        <span className={`truncate w-1/3 text-right ${match.score_p2 > match.score_p1 && match.is_completed ? 'font-bold text-gray-900' : 'text-gray-600'}`}>{match.player2_name || 'Bye'}</span>
                                    </div>
                                </div>
                            ))}
                        </div>
                     </div>
                </div>
            </div>
        ) : (
            // --- KNOCKOUT VIEW (BRACKET) ---
            <div className="bg-gray-100/50 p-6 rounded-xl border border-gray-200 overflow-x-auto min-h-[400px]">
                <BracketView matches={filteredMatches} />
            </div>
        )}

      </div>
    </div>
  );
};

export default TournamentView;