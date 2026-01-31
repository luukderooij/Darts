import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Save, RefreshCcw, ShieldAlert, Settings, ChevronDown, ChevronRight, SaveAll, GitMerge, Trophy, AlertCircle, LayoutGrid, Medal } from 'lucide-react';
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

// Dezelfde structuur als in TournamentView
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

const ManageTournament = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<MatchWithUI[]>([]);
  // We slaan de standen nu ook op in de admin state
  const [standings, setStandings] = useState<Record<number, StandingsItem[]>>({});
  
  const [loading, setLoading] = useState(true);
  
  // Settings State
  const [allowByes, setAllowByes] = useState(true);
  const [settingsDirty, setSettingsDirty] = useState(false);
  
  // Round Collapses
  const [openRounds, setOpenRounds] = useState<Record<string, boolean>>({});

  useEffect(() => {
    loadData();
  }, [id]);


  // Voeg 'isBackground' parameter toe, standaard false
  const loadData = async (isBackground = false) => {
    // Alleen loading spinner tonen als het GEEN achtergrond refresh is
    if (!isBackground) setLoading(true);
    
    try {
      const tournRes = await api.get(`/tournaments/${id}`);
      const currentTourn = tournRes.data;
      setTournament(currentTourn);
      setAllowByes(currentTourn.allow_byes);

      if (currentTourn.public_uuid) {
          const matchesRes = await api.get(`/matches/by-tournament/${currentTourn.public_uuid}`);
          
          // Hier behouden we de lokale state van 'is_saving' en 'save_success' als we refreshen
          // Dit voorkomt dat vinkjes direct verdwijnen tijdens de refresh
          setMatches(prevMatches => {
              const newMatches = matchesRes.data;
              return newMatches.map((nm: MatchWithUI) => {
                  const existing = prevMatches.find(pm => pm.id === nm.id);
                  return existing ? { ...nm, is_saving: existing.is_saving, save_success: existing.save_success } : nm;
              });
          });

          const standRes = await api.get(`/tournaments/${currentTourn.id}/standings`);
          setStandings(standRes.data);

          // Alleen openklappen bij de EERSTE keer laden (niet bij background refresh)
          if (!isBackground && matchesRes.data.length > 0) {
              const maxRoundMatch = matchesRes.data.reduce((prev: any, current: any) => {
                  return (prev.id > current.id) ? prev : current;
              });
              const type = maxRoundMatch.poule_number !== null ? 'P' : 'K';
              const num = maxRoundMatch.poule_number !== null ? maxRoundMatch.poule_number : maxRoundMatch.round_number;
              const key = `${type}-${num}`;
              
              setOpenRounds((prev) => ({ ...prev, [key]: true }));
          }
      }
    } catch (error) {
      console.error("Fout bij laden data:", error);
    } finally {
      // Loading alleen uitzetten als we hem ook hadden aangezet
      if (!isBackground) setLoading(false);
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
        // Na reset herladen we alles zodat ook de stand update
        loadData();
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

  const handleScoreChange = (id: number, field: 'score_p1' | 'score_p2', value: string) => {
      const numVal = value === '' ? 0 : parseInt(value);
      setMatches(prev => prev.map(m => 
          m.id === id ? { ...m, [field]: numVal, save_success: false } : m
      ));
  };

  // Deze functie gebruikt nu de data uit de backend in plaats van zelf te rekenen!
  const canStartKnockout = () => {
    if (!tournament || !matches.length) return false;
    if (tournament.format !== 'hybrid') return false; 

    const pouleMatches = matches.filter(m => m.poule_number !== null);
    const koMatches = matches.filter(m => m.poule_number === null);

    if (pouleMatches.length === 0) return false;
    
    // Alles moet gespeeld zijn
    const allPoulesFinished = pouleMatches.every(m => m.is_completed);
    const koNotStarted = koMatches.length === 0;

    // Check of er unresolved ties zijn volgens de backend data
    // We loopen door alle poules in de 'standings' state
    const hasUnresolvedTies = Object.values(standings).some(pouleList => 
        pouleList.some(player => player.needs_shootout)
    );

    return allPoulesFinished && koNotStarted && !hasUnresolvedTies;
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
          
          // AANPASSING HIER: Geef 'true' mee voor background refresh
          loadData(true); 

          setTimeout(() => {
            setMatches(prev => prev.map(m => m.id === match.id ? { ...m, save_success: false } : m));
          }, 2000);
      } catch (err: any) {
          // ... (foutafhandeling blijft hetzelfde)
          console.error(err);
          const errorMessage = err.response?.data?.detail || "Error saving score";
          alert(errorMessage); 
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

  // --- UPDATED GROUPING LOGIC ---
  const groupedMatches = matches.reduce((acc, match) => {
    let key = '';
    if (match.poule_number !== null) {
        key = `P-${match.poule_number}`;
    } else {
        key = `K-${match.round_number}`;
    }
    if (!acc[key]) acc[key] = [];
    acc[key].push(match);
    return acc;
  }, {} as Record<string, MatchWithUI[]>);

  const sortedGroupKeys = Object.keys(groupedMatches).sort((a, b) => {
      const [typeA, numStrA] = a.split('-');
      const [typeB, numStrB] = b.split('-');
      const numA = Number(numStrA);
      const numB = Number(numStrB);
      if (typeA !== typeB) return typeA === 'P' ? -1 : 1;
      return numA - numB;
  });

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
            <button onClick={() => loadData()} className="p-2 bg-gray-200 rounded hover:bg-gray-300">
                <RefreshCcw size={20} />
            </button>
        </div>

        {/* KNOCKOUT BLOCKER / STARTER */}
        {tournament.status === 'active' && 
        matches.some(m => m.poule_number !== null) && 
        matches.filter(m => m.poule_number === null).length === 0 && (
            <div className={`rounded-lg p-4 mb-6 flex justify-between items-center shadow-sm border ${
                canStartKnockout() ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'
            }`}>
                <div className="flex items-center gap-3">
                    <div className={`p-2 rounded-full ${
                        canStartKnockout() ? 'bg-green-100 text-green-600' : 'bg-amber-100 text-amber-600'
                    }`}>
                        {canStartKnockout() ? <GitMerge size={24} /> : <AlertCircle size={24} />}
                    </div>
                    <div>
                        <h4 className={`font-bold ${canStartKnockout() ? 'text-green-800' : 'text-amber-800'}`}>
                            {canStartKnockout() ? 'Klaar voor Knockout!' : 'Gelijkstand / Onvoltooide Poules'}
                        </h4>
                        <p className="text-sm opacity-80">
                            {canStartKnockout() 
                                ? 'Alle poulewedstrijden zijn klaar. Genereer nu de bracket.' 
                                : 'Er is een gelijkspel (Shootout nodig) of nog niet alles is gespeeld.'}
                        </p>
                    </div>
                </div>
                <button 
                    disabled={!canStartKnockout()}
                    onClick={handleStartKnockout}
                    className={`font-bold py-2 px-6 rounded-lg shadow transition-all ${
                        canStartKnockout() 
                        ? 'bg-green-600 hover:bg-green-700 text-white transform hover:scale-105' 
                        : 'bg-gray-300 text-gray-500 cursor-not-allowed'
                    }`}
                >
                    Start Knockout Fase
                </button>
            </div>
        )}

        {/* SETTINGS CARD */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-yellow-200 mb-8">
            <div className="flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2">
                    <ShieldAlert className="text-yellow-500" /> Instellingen
                </h3>
                {settingsDirty && (
                    <button onClick={handleUpdateSettings} className="bg-blue-600 text-white px-4 py-1 rounded shadow hover:bg-blue-700 flex items-center gap-2 animate-pulse">
                        <Save size={16} /> Opslaan
                    </button>
                )}
            </div>
            <div className="mt-2">
                <label className="flex items-center gap-2 cursor-pointer">
                    <input type="checkbox" checked={allowByes} onChange={e => { setAllowByes(e.target.checked); setSettingsDirty(true); }} className="w-5 h-5 accent-blue-600"/>
                    <span className="font-medium text-gray-700">Allow Byes (Vrijlotingen toestaan in KO)</span>
                </label>
            </div>
        </div>

        <div className="space-y-4">
            {sortedGroupKeys.map((groupKey) => {
                const [type, numStr] = groupKey.split('-');
                const number = Number(numStr);
                const roundMatches = groupedMatches[groupKey].sort((a,b) => {
                    if (a.round_number !== b.round_number) return a.round_number - b.round_number;
                    return a.id - b.id;
                });
                
                const isOpen = openRounds[groupKey];
                const isPoule = type === 'P';

                // Haal de stand op voor deze poule (als die bestaat)
                const pouleStanding = isPoule ? (standings[number] || []) : [];

                return (
                    <div key={groupKey} className={`rounded-lg shadow-sm border overflow-hidden ${isPoule ? 'bg-white border-gray-200' : 'bg-orange-50/50 border-orange-200'}`}>
                        {/* HEADER */}
                        <div 
                            className={`p-4 flex justify-between items-center cursor-pointer select-none ${isPoule ? 'bg-gray-50' : 'bg-orange-100 text-orange-900'}`} 
                            onClick={() => toggleRound(groupKey)}
                        >
                            <div className="flex items-center gap-2 font-bold text-gray-700">
                                {isOpen ? <ChevronDown size={20} /> : <ChevronRight size={20} />}
                                
                                {isPoule ? (
                                   <span className="flex items-center gap-2"><Trophy size={16} className="text-blue-500"/> Poule {number}</span>
                                ) : (
                                    <span className="text-orange-800 flex items-center gap-2">
                                        <GitMerge size={16}/> Knockout - {getRoundName(number, roundMatches.length)}
                                    </span>
                                )}
                                
                                <span className={`text-xs px-2 py-0.5 rounded font-normal ${isPoule ? 'bg-gray-200 text-gray-600' : 'bg-orange-200 text-orange-800'}`}>
                                    {roundMatches.length} wedstrijden
                                </span>
                            </div>
                            
                            {isOpen && !isPoule && (
                                <div className="flex items-center gap-2" onClick={e => e.stopPropagation()}>
                                    <span className="text-xs text-gray-500 font-bold">Zet Best of:</span>
                                    <input type="number" min="1" className="w-12 text-center border rounded p-1 text-xs no-spinner" 
                                        placeholder={roundMatches[0].best_of_legs?.toString() || "5"}
                                        onKeyDown={(e) => e.key === 'Enter' && handleBatchUpdateRound(number, parseInt(e.currentTarget.value))}
                                    />
                                </div>
                            )}
                        </div>

                        {isOpen && (
                        // AANPASSING: We maken hier een Grid/Flex container van.
                        // Op mobiel (flex-col-reverse) staan de wedstrijden BOVEN (dus geen verspringen) en de stand ONDER.
                        // Op desktop (lg:grid) staan ze naast elkaar.
                        <div className="p-0 flex flex-col-reverse lg:grid lg:grid-cols-3 lg:gap-0">
                            
                            {/* BLOK 1: DE WEDSTRIJDEN (Nu als eerste in de code) */}
                            {/* We geven dit blok 2 kolommen breedte op desktop */}
                            <div className="divide-y divide-gray-100 lg:col-span-2 lg:border-r lg:border-gray-100">
                                {roundMatches.map(match => (
                                    <div key={match.id} className={`p-3 transition-colors flex items-center justify-between ${match.save_success ? 'bg-green-50' : 'hover:bg-white'}`}>
                                        <div className="w-16 flex flex-col items-center justify-center gap-1 border-r border-gray-100 mr-2 pr-2">
                                            <div className="text-xs text-gray-400 font-mono">#{match.id}</div>
                                            <div className="flex flex-col items-center mt-1">
                                                <span className="text-[9px] text-gray-400 uppercase leading-none">Ref:</span>
                                                <div className="text-[10px] text-blue-400 font-bold uppercase tracking-tighter" title={`Referee: ${match.referee_name}`}>
                                                    {match.referee_name ? match.referee_name.split(' ')[0] : '-'}
                                                </div>
                                            </div>
                                        </div>

                                        <div className="flex-1 flex items-center justify-center gap-2">
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

                            {/* BLOK 2: HET SCOREBOARD (Nu als tweede, of rechts op desktop) */}
                            {isPoule && pouleStanding.length > 0 && (
                                <div className="bg-blue-50/30 p-4 border-t lg:border-t-0 lg:col-span-1">
                                    <h5 className="font-bold text-xs uppercase text-blue-400 mb-2 flex items-center gap-2"><LayoutGrid size={14}/> Huidige Stand</h5>
                                    <div className="overflow-x-auto">
                                        <table className="w-full text-xs text-left">
                                            <thead>
                                                <tr className="text-gray-400 border-b">
                                                    <th className="pb-1">#</th>
                                                    <th className="pb-1">Naam</th>
                                                    <th className="pb-1 text-center">Pts</th>
                                                    <th className="pb-1 text-center">+/-</th>
                                                    <th className="pb-1">Status</th>
                                                </tr>
                                            </thead>
                                            <tbody>
                                                {pouleStanding.map((p, idx) => (
                                                    <tr key={p.id} className="border-b border-gray-100 last:border-0">
                                                        <td className="py-2 font-mono text-gray-500 w-8">{idx + 1}</td>
                                                        <td className="py-2 font-bold text-gray-700">{p.name}</td>
                                                        <td className="py-2 text-center font-bold text-blue-600">{p.points}</td>
                                                        <td className="py-2 text-center text-gray-500">{p.leg_diff}</td>
                                                        <td className="py-2">
                                                            {p.needs_shootout && (
                                                                <span className="flex items-center w-fit gap-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold border border-red-200">
                                                                    <AlertCircle size={10} /> SO
                                                                </span>
                                                            )}
                                                            {idx < (tournament?.qualifiers_per_poule || 2) && !p.needs_shootout && (
                                                                <span className="text-green-500"><Medal size={14}/></span>
                                                            )}
                                                        </td>
                                                    </tr>
                                                ))}
                                            </tbody>
                                        </table>
                                        <div className="mt-2 text-[10px] text-gray-400 italic">
                                            * Stand update live
                                        </div>
                                    </div>
                                </div>
                            )}
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