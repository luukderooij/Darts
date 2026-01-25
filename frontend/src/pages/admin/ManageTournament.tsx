import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Save, RefreshCcw, ShieldAlert, Settings, ChevronDown, ChevronRight, SaveAll, GitMerge } from 'lucide-react';
import { Tournament, Match } from '../../types';

interface MatchWithUI extends Match {
  best_of_legs: number;
  player1_name: string;
  player2_name: string;
  score_p1: number;
  score_p2: number;
  is_completed: boolean;
  round_number: number;
  poule_number: number | null;
  is_saving?: boolean;
  save_success?: boolean;
}

const ManageTournament = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<MatchWithUI[]>([]);
  const [loading, setLoading] = useState(true);
  
  // Settings State
  const [allowByes, setAllowByes] = useState(true);
  const [settingsDirty, setSettingsDirty] = useState(false);

  // Round Collapses
  const [openRounds, setOpenRounds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, [id]);

  const loadData = async () => {
    setLoading(true);
    try {
      const tournRes = await api.get(`/tournaments/${id}`);
      const currentTourn = tournRes.data;
      setTournament(currentTourn);
      setAllowByes(currentTourn.allow_byes);

      if (currentTourn.public_uuid) {
          const matchesRes = await api.get(`/matches/by-tournament/${currentTourn.public_uuid}`);
          
          // --- FIX: GEBRUIK DIRECT DE DATA VAN DE BACKEND ---
          // De backend (matches.py) heeft al bepaald of het een speler-naam of team-naam is
          // en heeft dit in 'player1_name' en 'player2_name' gezet.
          // We hoeven hier NIETS meer te berekenen.
          
          setMatches(matchesRes.data);
          
          // Open automatisch de hoogste ronde of poule fase
          if (matchesRes.data.length > 0) {
              const maxRoundMatch = matchesRes.data.reduce((prev: any, current: any) => {
                  return (prev.id > current.id) ? prev : current;
              });
              
              const type = maxRoundMatch.poule_number !== null ? 'P' : 'K';
              const key = `${type}-${maxRoundMatch.round_number}`;
              
              setOpenRounds((prev) => ({ ...prev, [key]: true }));
          }
      }
    } catch (error) {
      console.error("Fout bij laden data:", error);
    } finally {
      setLoading(false);
    }
  };

  // --- ACTIES ---

  const handleUpdateSettings = async () => {
    if (!tournament) return;
    try {
        await api.patch(`/tournaments/${tournament.id}`, { allow_byes: allowByes });
        setSettingsDirty(false);
        alert("Instellingen opgeslagen.");
    } catch (err) {
        alert("Fout bij opslaan instellingen.");
    }
  };

  const handleResetMatch = async (matchId: number) => {
    if (!confirm("Resetten naar 0-0 en open zetten?")) return;
    try {
        await api.put(`/matches/${matchId}/score`, {
            score_p1: 0,
            score_p2: 0,
            is_completed: false
        });
        setMatches(prev => prev.map(m => m.id === matchId ? { ...m, score_p1: 0, score_p2: 0, is_completed: false } : m));
    } catch (err) {
        alert("Reset mislukt.");
    }
  };

  const handleBatchUpdateRound = async (roundNum: number, legs: number) => {
    if (!tournament) return;
    if (!confirm(`Zet alle ONGESPEELDE wedstrijden in ronde ${roundNum} naar Best of ${legs}?`)) return;
    try {
        await api.post(`/tournaments/${tournament.id}/rounds/${roundNum}/update-format?best_of_legs=${legs}`);
        loadData();
    } catch (err) {
        alert("Update mislukt.");
    }
  };

  const toggleRound = (key: string) => setOpenRounds(prev => ({...prev, [key]: !prev[key]}));

  // --- SPREADSHEET LOGICA ---

  const handleScoreChange = (id: number, field: 'score_p1' | 'score_p2', value: string) => {
      const numVal = value === '' ? 0 : parseInt(value);
      setMatches(prev => prev.map(m => 
          m.id === id ? { ...m, [field]: numVal, save_success: false } : m
      ));
  };

  const canStartKnockout = () => {
      if (!tournament || !matches.length) return false;
      if (tournament.format !== 'hybrid') return false; 

      const pouleMatches = matches.filter(m => m.poule_number !== null);
      const koMatches = matches.filter(m => m.poule_number === null);

      if (pouleMatches.length === 0) return false;
      const allPoulesFinished = pouleMatches.every(m => m.is_completed);
      const koNotStarted = koMatches.length === 0;

      return allPoulesFinished && koNotStarted;
  };

  const handleStartKnockout = async () => {
      if (!confirm("Weet je zeker dat je de Poule-fase wilt afsluiten en de Knockout wilt genereren?")) return;
      
      try {
          await api.post(`/tournaments/${id}/start-knockout`);
          alert("Knockout fase gegenereerd!");
          loadData(); 
      } catch (err) {
          console.error(err);
          alert("Er ging iets mis bij het starten van de knockout.");
      }
  };

  const saveMatchScore = async (match: MatchWithUI) => {
      setMatches(prev => prev.map(m => m.id === match.id ? { ...m, is_saving: true } : m));

      try {
          await api.put(`/matches/${match.id}/score`, {
              score_p1: match.score_p1,
              score_p2: match.score_p2,
              is_completed: true 
          });

          setMatches(prev => prev.map(m => m.id === match.id ? { ...m, is_saving: false, save_success: true, is_completed: true } : m));
          
          setTimeout(() => {
            setMatches(prev => prev.map(m => m.id === match.id ? { ...m, save_success: false } : m));
          }, 2000);

      } catch (err) {
          console.error(err);
          setMatches(prev => prev.map(m => m.id === match.id ? { ...m, is_saving: false } : m));
      }
  };

  const handleKeyDown = (e: React.KeyboardEvent, match: MatchWithUI) => {
      if (e.key === 'Enter') {
          saveMatchScore(match);
          (e.currentTarget as HTMLInputElement).blur(); 
      }
  };

  const getRoundName = (roundNum: number, matchCount: number) => {
    if (matchCount === 1) return "Finale";
    if (matchCount === 2) return "Halve Finale";
    if (matchCount === 4) return "Kwartfinale";
    return `Ronde ${roundNum}`;
};

  const groupedMatches = matches.reduce((acc, match) => {
    const type = match.poule_number !== null ? 'P' : 'K'; 
    const key = `${type}-${match.round_number}`;
    
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {} as Record<string, MatchWithUI[]>);

  const sortedGroupKeys = Object.keys(groupedMatches).sort((a, b) => {
      const [typeA, roundA] = a.split('-');
      const [typeB, roundB] = b.split('-');

      if (typeA !== typeB) return typeA === 'P' ? -1 : 1;
      return Number(roundA) - Number(roundB);
  });

  // --- RENDERING ---

  if (loading) {
    return (
      <AdminLayout>
          <div className="flex justify-center items-center h-64 text-gray-500">
              <span className="animate-pulse">Gegevens ophalen...</span>
          </div>
      </AdminLayout>
    );
  }

  if (!tournament) {
    return (
      <AdminLayout>
          <div className="max-w-5xl mx-auto mt-8 bg-red-50 text-red-600 p-6 rounded-lg border border-red-200">
              <h3 className="font-bold text-lg flex items-center gap-2"><ShieldAlert /> Toernooi niet gevonden</h3>
              <button onClick={() => navigate('/dashboard')} className="mt-4 text-blue-600 hover:underline">&larr; Terug</button>
          </div>
      </AdminLayout>
    );
  }

  return (
    <AdminLayout>
      <style>{`
        .no-spinner::-webkit-inner-spin-button, 
        .no-spinner::-webkit-outer-spin-button { 
          -webkit-appearance: none; 
          margin: 0; 
        } 
        .no-spinner { 
          -moz-appearance: textfield; 
        }
      `}</style>

      <div className="max-w-5xl mx-auto pb-20">
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                <Settings className="text-gray-600" />
                Beheer: <span className="text-blue-600">{tournament.name}</span>
            </h2>
            <button onClick={loadData} className="p-2 bg-gray-200 rounded hover:bg-gray-300">
                <RefreshCcw size={20} />
            </button>
        </div>

        {canStartKnockout() && (
            <div className="bg-green-50 border border-green-200 rounded-lg p-4 mb-6 flex justify-between items-center shadow-sm animate-pulse">
                <div className="flex items-center gap-3">
                    <div className="bg-green-100 p-2 rounded-full text-green-600">
                        <GitMerge size={24} />
                    </div>
                    <div>
                        <h4 className="font-bold text-green-800">Poule Fase Voltooid!</h4>
                        <p className="text-sm text-green-600">Alle wedstrijden zijn gespeeld. Je kunt nu de bracket genereren.</p>
                    </div>
                </div>
                <button 
                    onClick={handleStartKnockout}
                    className="bg-green-600 hover:bg-green-700 text-white font-bold py-2 px-6 rounded-lg shadow transition-transform transform hover:scale-105"
                >
                    Start Knockout Fase
                </button>
            </div>
        )}

        <div className="bg-white p-6 rounded-lg shadow-sm border border-yellow-200 mb-8">
            <h3 className="font-bold text-lg mb-4 flex items-center gap-2">
                <ShieldAlert className="text-yellow-500" /> Instellingen
            </h3>
            <div className="flex items-center gap-6">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={allowByes} onChange={e => { setAllowByes(e.target.checked); setSettingsDirty(true); }} className="w-5 h-5 accent-blue-600"/>
                    <span className="font-medium text-gray-700">Allow Byes</span>
                </label>
                {settingsDirty && (
                    <button onClick={handleUpdateSettings} className="bg-blue-600 text-white px-4 py-1 rounded shadow hover:bg-blue-700 flex items-center gap-2 animate-pulse">
                        <Save size={16} /> Opslaan
                    </button>
                )}
            </div>
        </div>

        <div className="space-y-4">
            {sortedGroupKeys.map((groupKey) => {
                const [type, roundStr] = groupKey.split('-');
                const roundNum = Number(roundStr);
                const roundMatches = groupedMatches[groupKey];
                
                const isOpen = openRounds[groupKey];
                const isPoule = type === 'P';

                return (
                    <div key={groupKey} className={`rounded-lg shadow-sm border overflow-hidden ${isPoule ? 'bg-white border-gray-200' : 'bg-orange-50/50 border-orange-200'}`}>
                        <div 
                            className={`p-4 flex justify-between items-center cursor-pointer select-none ${isPoule ? 'bg-gray-50' : 'bg-orange-100 text-orange-900'}`} 
                            onClick={() => toggleRound(groupKey)}
                        >
                            <div className="flex items-center gap-2 font-bold text-gray-700">
                                {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                
                                {isPoule ? (
                                    <span>Poule Fase - Ronde {roundNum}</span>
                                ) : (
                                    <span className="text-orange-800 flex items-center gap-2">
                                        <GitMerge size={16}/> Knockout - {getRoundName(roundNum, roundMatches.length)}
                                    </span>
                                )}
                                
                                <span className={`text-xs px-2 py-0.5 rounded font-normal ${isPoule ? 'bg-gray-200 text-gray-600' : 'bg-orange-200 text-orange-800'}`}>
                                    {roundMatches.length} wedstrijden
                                </span>
                            </div>
                            
                            {isOpen && (
                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                    <span className="text-xs text-gray-500 font-bold">Zet Best of:</span>
                                    <input type="number" min="1" className="w-12 text-center border rounded p-1 text-xs no-spinner" 
                                        placeholder={roundMatches[0].best_of_legs?.toString() || "5"}
                                        onKeyDown={(e) => e.key === 'Enter' && handleBatchUpdateRound(roundNum, parseInt(e.currentTarget.value))}
                                    />
                                </div>
                            )}
                        </div>

                        {isOpen && (
                            <div className="divide-y divide-gray-100">
                                {roundMatches.map(match => (
                                    <div key={match.id} className={`p-3 transition-colors flex items-center justify-between ${match.save_success ? 'bg-green-50' : 'hover:bg-white'}`}>
                                        
                                        <div className="w-8 text-xs text-gray-400 font-mono text-center">#{match.id}</div>

                                        <div className="flex-1 flex items-center justify-center gap-2">
                                            
                                            {/* SPELER 1 (Of Team 1) */}
                                            <div className={`flex-1 text-right truncate font-medium ${match.score_p1 > match.score_p2 && match.is_completed ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
                                                {match.player1_name || <span className="italic text-gray-400">Bye</span>}
                                            </div>

                                            <div className="flex items-center bg-white border rounded shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400 transition-all">
                                                <input 
                                                    type="number" 
                                                    className={`w-12 text-center p-2 outline-none font-bold no-spinner ${match.save_success ? 'text-green-600' : 'text-gray-800'}`}
                                                    value={match.score_p1}
                                                    onChange={(e) => handleScoreChange(match.id, 'score_p1', e.target.value)}
                                                    onFocus={(e) => e.target.select()} 
                                                    onBlur={() => saveMatchScore(match)}
                                                    onKeyDown={(e) => handleKeyDown(e, match)}
                                                />
                                                <span className="text-gray-300 font-light px-1">|</span>
                                                <input 
                                                    type="number" 
                                                    className={`w-12 text-center p-2 outline-none font-bold no-spinner ${match.save_success ? 'text-green-600' : 'text-gray-800'}`}
                                                    value={match.score_p2}
                                                    onChange={(e) => handleScoreChange(match.id, 'score_p2', e.target.value)}
                                                    onFocus={(e) => e.target.select()}
                                                    onBlur={() => saveMatchScore(match)}
                                                    onKeyDown={(e) => handleKeyDown(e, match)}
                                                />
                                            </div>

                                            {/* SPELER 2 (Of Team 2) */}
                                            <div className={`flex-1 text-left truncate font-medium ${match.score_p2 > match.score_p1 && match.is_completed ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
                                                {match.player2_name || <span className="italic text-gray-400">Bye</span>}
                                            </div>

                                        </div>

                                        <div className="w-20 flex justify-end gap-1">
                                            {match.is_saving ? (
                                                <span className="p-2 text-blue-500 animate-spin"><RefreshCcw size={16}/></span>
                                            ) : match.save_success ? (
                                                <span className="p-2 text-green-500"><SaveAll size={16}/></span>
                                            ) : (
                                                <button onClick={() => handleResetMatch(match.id)} className="p-2 text-gray-300 hover:text-red-500 transition" title="Reset">
                                                    <RefreshCcw size={16} />
                                                </button>
                                            )}
                                        </div>

                                    </div>
                                ))}
                            </div>
                        )}
                    </div>
                );
            })}
        </div>
      </div>
    </AdminLayout>
  );
};

export default ManageTournament;