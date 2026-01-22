import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Save, RefreshCcw, ShieldAlert, Settings, ChevronDown, ChevronRight, SaveAll } from 'lucide-react';
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
  const [openRounds, setOpenRounds] = useState<Record<number, boolean>>({});

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
          setMatches(matchesRes.data);

          if (matchesRes.data.length > 0) {
              const maxRound = Math.max(...matchesRes.data.map((m: any) => m.round_number));
              setOpenRounds((prev) => ({ ...prev, [maxRound]: true }));
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

  const toggleRound = (r: number) => setOpenRounds(prev => ({...prev, [r]: !prev[r]}));

  // --- SPREADSHEET LOGICA ---

  const handleScoreChange = (id: number, field: 'score_p1' | 'score_p2', value: string) => {
      const numVal = value === '' ? 0 : parseInt(value);
      setMatches(prev => prev.map(m => 
          m.id === id ? { ...m, [field]: numVal, save_success: false } : m
      ));
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

  const matchesByRound = matches.reduce((acc, match) => {
    const r = match.round_number;
    if (!acc[r]) acc[r] = [];
    acc[r].push(match);
    return acc;
  }, {} as Record<number, MatchWithUI[]>);

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
      {/* CSS Hack om de pijltjes (spinners) van input[type=number] te verbergen */}
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

        {/* SETTINGS */}
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

        {/* MATCHES LIST */}
        <div className="space-y-4">
            {Object.keys(matchesByRound).map((roundKey) => {
                const roundNum = Number(roundKey);
                const roundMatches = matchesByRound[roundNum];
                const isOpen = openRounds[roundNum];
                const isPoule = roundMatches[0].poule_number !== null;

                return (
                    <div key={roundNum} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                        {/* HEADER */}
                        <div className="bg-gray-50 p-4 flex justify-between items-center cursor-pointer select-none" onClick={() => toggleRound(roundNum)}>
                            <div className="flex items-center gap-2 font-bold text-gray-700">
                                {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                {isPoule ? `Poule Fase - Ronde ${roundNum}` : `Knockout - Ronde ${roundNum}`}
                                <span className="text-xs bg-gray-200 px-2 py-0.5 rounded text-gray-600 font-normal">{roundMatches.length} wedstrijden</span>
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

                        {/* ROWS */}
                        {isOpen && (
                            <div className="divide-y divide-gray-100">
                                {roundMatches.map(match => (
                                    <div key={match.id} className={`p-3 transition-colors flex items-center justify-between ${match.save_success ? 'bg-green-50' : 'hover:bg-gray-50'}`}>
                                        
                                        {/* ID */}
                                        <div className="w-8 text-xs text-gray-400 font-mono text-center">#{match.id}</div>

                                        {/* PLAYERS & INPUTS */}
                                        <div className="flex-1 flex items-center justify-center gap-2">
                                            
                                            <div className={`flex-1 text-right truncate font-medium ${match.score_p1 > match.score_p2 && match.is_completed ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
                                                {match.player1_name || <span className="italic text-gray-400">Bye</span>}
                                            </div>

                                            {/* INPUTS CONTAINER */}
                                            <div className="flex items-center bg-white border rounded shadow-sm overflow-hidden focus-within:ring-2 focus-within:ring-blue-400 focus-within:border-blue-400 transition-all">
                                                <input 
                                                    type="number" 
                                                    className={`w-12 text-center p-2 outline-none font-bold no-spinner ${match.save_success ? 'text-green-600' : 'text-gray-800'}`}
                                                    value={match.score_p1}
                                                    onChange={(e) => handleScoreChange(match.id, 'score_p1', e.target.value)}
                                                    onFocus={(e) => e.target.select()} // Selecteer tekst bij klik
                                                    onBlur={() => saveMatchScore(match)}
                                                    onKeyDown={(e) => handleKeyDown(e, match)}
                                                />
                                                
                                                <span className="text-gray-300 font-light px-1">|</span>

                                                <input 
                                                    type="number" 
                                                    className={`w-12 text-center p-2 outline-none font-bold no-spinner ${match.save_success ? 'text-green-600' : 'text-gray-800'}`}
                                                    value={match.score_p2}
                                                    onChange={(e) => handleScoreChange(match.id, 'score_p2', e.target.value)}
                                                    onFocus={(e) => e.target.select()} // Selecteer tekst bij klik
                                                    onBlur={() => saveMatchScore(match)}
                                                    onKeyDown={(e) => handleKeyDown(e, match)}
                                                />
                                            </div>

                                            <div className={`flex-1 text-left truncate font-medium ${match.score_p2 > match.score_p1 && match.is_completed ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
                                                {match.player2_name || <span className="italic text-gray-400">Bye</span>}
                                            </div>

                                        </div>

                                        {/* ACTIONS */}
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