import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Save, RefreshCcw, ShieldAlert, Settings, ChevronDown, ChevronRight, SaveAll, GitMerge, Trophy, AlertCircle, LayoutGrid, Medal, UserPlus, Monitor, X, Link as LinkIcon, Target, User } from 'lucide-react';
import { Dartboard, Tournament, Match } from '../../types';

// Uitgebreide interface voor UI-specifieke properties
interface MatchWithUI extends Match {
  best_of_legs: number;
  player1_name: string;
  player2_name: string;
  score_p1: number;
  score_p2: number;
  is_completed: boolean;
  round_number: number;
  poule_number: number | null;
  board_number?: number | null; 
  referee_id?: number | null;     
  custom_referee_name?: string | null; 
  referee_name?: string;               
  
  // UI States
  is_saving?: boolean;
  save_success?: boolean;
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

interface BoardCode {
    board_number: number;
    code: string;
}

const ManageTournament = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // --- STATE ---
  const [tournament, setTournament] = useState<Tournament | null>(null);
  const [matches, setMatches] = useState<MatchWithUI[]>([]);
  const [standings, setStandings] = useState<Record<number, StandingsItem[]>>({});
  const [loading, setLoading] = useState(true);
  
  // Settings State
  const [allowByes, setAllowByes] = useState(true);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // UI State: Welke rondes zijn opengeklapt?
  const [openRounds, setOpenRounds] = useState<Record<string, boolean>>({});
  const [allBoards, setAllBoards] = useState<Dartboard[]>([]);

  const [showCodesModal, setShowCodesModal] = useState(false);
  const [boardCodes, setBoardCodes] = useState<BoardCode[]>([]);




    const handleShowCodes = async () => {
        try {
            // Roep de nieuwe endpoint aan die we in de backend hebben gemaakt
            const res = await api.post(`/scorer/generate-codes/${id}`);
            setBoardCodes(res.data);
            setShowCodesModal(true);
        } catch (err) {
            alert("Kon codes niet ophalen.");
        }
    };


  useEffect(() => {
    loadData();
  }, [id]);

  // --- DATA LADEN ---
const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      // 1. WIJZIGING: Haal Toernooi EN Borden tegelijk op met Promise.all
      const [tournRes, boardsRes] = await Promise.all([
          api.get(`/tournaments/${id}`),
          api.get('/dartboards/') 
      ]);

      const currentTourn = tournRes.data;
      
      // 2. Sla de data op in de state
      setTournament(currentTourn);
      setAllBoards(boardsRes.data); // Nu is boardsRes wel bekend!
      setAllowByes(currentTourn.allow_byes);

      // 3. Als het toernooi publiek is, haal dan de wedstrijden op
      if (currentTourn.public_uuid) {
          const matchesRes = await api.get(`/matches/by-tournament/${currentTourn.public_uuid}`);
          
          setMatches(prevMatches => {
              const newMatches = matchesRes.data;
              return newMatches.map((nm: MatchWithUI) => {
                  const existing = prevMatches.find(pm => pm.id === nm.id);
                  return existing ? { 
                      ...nm, 
                      is_saving: existing.is_saving, 
                      save_success: existing.save_success 
                  } : nm;
              });
          });

          const standRes = await api.get(`/tournaments/${currentTourn.id}/standings`);
          setStandings(standRes.data);

          // Eerste keer laden: klap de hoogste actieve ronde open
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
      if (!isBackground) setLoading(false);
    }
  };

  // --- ACTIES ---

  // 1. Instellingen Opslaan
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

  // 2. Wedstrijd Resetten
  const handleResetMatch = async (matchId: number) => {
    if (!confirm("Resetten naar 0-0 en open zetten?")) return;
    try {
        await api.put(`/matches/${matchId}/score`, {
            score_p1: 0,
            score_p2: 0,
            is_completed: false
        });
        loadData();
    } catch (err) {
        alert("Reset mislukt.");
    }
  };

  // 3. Batch Update (Best of X)
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

  // 4. Score Updaten (Lokaal + Save Trigger)
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
              is_completed: true,
              referee_id: match.referee_id,        
              custom_referee_name: match.custom_referee_name 
          });
          setMatches(prev => prev.map(m => m.id === match.id ? { ...m, is_saving: false, save_success: true, is_completed: true } : m));
          loadData(true); // Background refresh voor standen
          setTimeout(() => {
            setMatches(prev => prev.map(m => m.id === match.id ? { ...m, save_success: false } : m));
          }, 2000);
      } catch (err: any) {
          console.error(err);
          const errorMessage = err.response?.data?.detail || "Error saving score";
          alert(errorMessage); 
          setMatches(prev => prev.map(m => m.id === match.id ? { ...m, is_saving: false } : m));
      }
  };

  // 5. Bord Wijzigen (NIEUW)
  const handleBoardChange = async (matchId: number, newBoardVal: string) => {
    // Als input leeg is, doen we niks (of stuur null als je bord wilt clearen, hieronder assumptie valid int)
    const boardNum = parseInt(newBoardVal);
    if (isNaN(boardNum)) return;

    // Optimistische update in UI
    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, board_number: boardNum } : m));

    try {
        await api.patch(`/matches/${matchId}/assign-board`, { board_number: boardNum });
        // Geen volledige reload nodig, bord staat al goed
    } catch (err) {
        console.error(err);
        alert("Kon bord niet wijzigen.");
        loadData(true); // Revert bij fout
    }
  };

  // 6. Knockout Genereren
  const canStartKnockout = () => {
    if (!tournament || !matches.length) return false;
    if (tournament.format !== 'hybrid') return false; 

    const pouleMatches = matches.filter(m => m.poule_number !== null);
    const koMatches = matches.filter(m => m.poule_number === null);

    if (pouleMatches.length === 0) return false;
    
    const allPoulesFinished = pouleMatches.every(m => m.is_completed);
    const koNotStarted = koMatches.length === 0;
    
    // Check shootouts
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

  // 7. Admin Toevoegen
  const handleAddAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newAdminEmail) return;

      try {
          await api.post(`/tournaments/${id}/admins`, { email: newAdminEmail });
          alert(`Gebruiker ${newAdminEmail} is succesvol toegevoegd als admin!`);
          setNewAdminEmail(''); // Veld leegmaken
      } catch (err: any) {
          console.error(err);
          // Toon de specifieke foutmelding van de backend (bijv. "Gebruiker niet gevonden")
          alert(err.response?.data?.detail || "Kon admin niet toevoegen.");
      }
  };

  // --- RENDERING HELPERS ---
  
  const handleKeyDown = (e: React.KeyboardEvent, match: MatchWithUI) => {
      if (e.key === 'Enter') {
          saveMatchScore(match);
          (e.currentTarget as HTMLInputElement).blur(); 
      }
  };

  const toggleRound = (key: string) => setOpenRounds(prev => ({...prev, [key]: !prev[key]}));

  const getRoundName = (roundNum: number, matchCount: number) => {
    if (matchCount === 1) return "Finale";
    if (matchCount === 2) return "Halve Finale";
    if (matchCount === 4) return "Kwartfinale";
    return `Ronde ${roundNum}`;
  };

  // Group Matches Logic
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

  const handleRefereeChange = async (matchId: number, value: string) => {
    let payload: any = { 
        // We sturen de huidige scores mee omdat de backend-validator dit vereist
        score_p1: matches.find(m => m.id === matchId)?.score_p1 || 0,
        score_p2: matches.find(m => m.id === matchId)?.score_p2 || 0
    };

    if (value === "CUSTOM_PROMPT") {
        const customName = prompt("Voer de naam van de schrijver in:");
        if (!customName) return;
        payload.custom_referee_name = customName;
        payload.referee_id = null;
    } else if (value === "") {
        payload.referee_id = null;
        payload.custom_referee_name = null;
    } else {
        payload.referee_id = parseInt(value);
        payload.custom_referee_name = null;
    }

    try {
        await api.put(`/matches/${matchId}/score`, payload);
        loadData(false); // Ververs de lijst
    } catch (err) {
        console.error("Update failed", err);
    }
};

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
        
        {/* HEADER */}
        <div className="flex justify-between items-center mb-6">
            <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-3">
                <Settings className="text-gray-600" />
                Beheer: <span className="text-blue-600">{tournament.name}</span>
            </h2>
            <button 
            onClick={handleShowCodes} 
            className="px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition flex items-center gap-2 font-bold shadow-sm"
        >
            <Monitor size={18} /> Bord Codes
        </button>
            <button onClick={() => loadData()} className="p-2 bg-gray-200 rounded hover:bg-gray-300 transition">
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

        {/* ADMINS CARD */}
        <div className="bg-white p-6 rounded-lg shadow-sm border border-purple-200 mb-8">
            <h3 className="font-bold text-lg flex items-center gap-2 mb-4 text-gray-800">
                <UserPlus className="text-purple-500" /> Extra Beheerders
            </h3>
            <p className="text-sm text-gray-500 mb-4">
                Geef een andere gebruiker volledige rechten om dit toernooi te beheren. 
                De gebruiker moet al geregistreerd zijn.
            </p>
            
            <form onSubmit={handleAddAdmin} className="flex gap-3">
                <input 
                    type="email" 
                    placeholder="E-mailadres van de gebruiker (bijv. jan@darts.nl)" 
                    className="flex-1 border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                    value={newAdminEmail}
                    onChange={(e) => setNewAdminEmail(e.target.value)}
                    required
                />
                <button 
                    type="submit" 
                    className="bg-purple-600 text-white px-4 py-2 rounded-md font-bold hover:bg-purple-700 transition flex items-center gap-2"
                >
                    <UserPlus size={18} /> Toevoegen
                </button>
            </form>
        </div>

        {/* WEDSTRIJDEN LIJST */}
        <div className="space-y-4">
            {sortedGroupKeys.map((groupKey) => {
                const [type, numStr] = groupKey.split('-');
                const number = Number(numStr);
                const roundMatches = groupedMatches[groupKey].sort((a,b) => {
                    // Eerst op ronde
                    if (a.round_number !== b.round_number) return a.round_number - b.round_number;
                    // Daarna gewoon op volgorde van aanmaken (ID)
                    return a.id - b.id;
                });
                
                const isOpen = openRounds[groupKey];
                const isPoule = type === 'P';
                const pouleStanding = isPoule ? (standings[number] || []) : [];

                return (
                    <div key={groupKey} className={`rounded-lg shadow-sm border overflow-hidden ${isPoule ? 'bg-white border-gray-200' : 'bg-orange-50/50 border-orange-200'}`}>
                        
                        {/* RONDE HEADER */}
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
                            
                            {/* Best of X input voor Knockout */}
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
                            <div className="p-0 flex flex-col-reverse lg:grid lg:grid-cols-3 lg:gap-0">
                                
{/* KOLOM 1 & 2: WEDSTRIJDEN */}
<div className="divide-y divide-gray-100 lg:col-span-2 lg:border-r lg:border-gray-100">
    {roundMatches.map((match, index) => (
        <div key={match.id} className={`p-4 transition-colors flex flex-col md:flex-row md:items-center justify-between gap-4 ${match.save_success ? 'bg-green-50' : 'hover:bg-white'}`}>
            
            {/* 1. HEADER (Mobiel): Match # en Reset knop */}
            <div className="flex justify-between items-center md:hidden border-b border-gray-100 pb-2 mb-2">
                <span className="text-[10px] text-gray-400 font-mono uppercase tracking-wider">Match #{index + 1}</span>
                {/* Reset knop (Mobiel) */}
                <button onClick={() => handleResetMatch(match.id)} className="p-1 text-gray-300 hover:text-red-500 transition-colors">
                    <RefreshCcw size={14} />
                </button>
            </div>

            {/* 2. INSTELLINGEN (Bord & Schrijver) - Gegroepeerd */}
            {/* Mobiel: Naast elkaar (grid-cols-2). Desktop: Onder elkaar (flex-col) in linker kolom */}
            <div className="grid grid-cols-2 md:flex md:flex-col gap-3 md:gap-2 md:w-48 md:border-r md:border-gray-100 md:pr-4 md:mr-2">
                
                {/* A. BORD SELECTOR */}
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5">
                        <Target size={12} className="text-blue-400"/> Bord
                    </label>
                    <div className="relative">
                        <select 
                            className="w-full bg-gray-50 border border-gray-200 text-xs rounded px-2 py-1.5 outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-500 font-medium appearance-none"
                            value={match.board_number || ''}
                            onChange={(e) => handleBoardChange(match.id, e.target.value)}
                        >
                            <option value="">-- Kies --</option>
                            {allBoards.map(board => (
                                <option key={board.id} value={board.number}>
                                    Bord {board.number} {board.name ? `(${board.name})` : ''}
                                </option>
                            ))}
                        </select>
                        {/* Klein pijltje voor styling (optioneel, browser default is ook prima) */}
                        <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <ChevronDown size={12} />
                        </div>
                    </div>
                </div>

                {/* B. SCHRIJVER SELECTOR */}
                <div className="flex flex-col gap-1">
                    <label className="text-[10px] font-bold text-gray-400 uppercase flex items-center gap-1.5">
                        <User size={12} className="text-purple-400"/> Schrijver
                    </label>
                    <div className="relative">
                        <select 
                            className={`w-full text-xs rounded px-2 py-1.5 outline-none border appearance-none ${
                                match.referee_id || match.custom_referee_name 
                                ? 'bg-blue-50 border-blue-200 text-blue-800 font-bold' 
                                : 'bg-white border-gray-200 text-gray-400'
                            }`}
                            value={match.referee_id || (match.custom_referee_name ? "CUSTOM_DISPLAY" : "")}
                            onChange={(e) => handleRefereeChange(match.id, e.target.value)}
                        >
                            <option value="">-- Kies --</option>
                            {match.custom_referee_name && <option value="CUSTOM_DISPLAY">✎ {match.custom_referee_name}</option>}
                            <optgroup label="Spelers">
                                {tournament?.players?.map(p => (
                                    <option key={p.id} value={p.id}>{p.name}</option>
                                ))}
                            </optgroup>
                            <option value="CUSTOM_PROMPT" className="text-blue-600 font-bold">+ Handmatig</option>
                        </select>
                         <div className="pointer-events-none absolute inset-y-0 right-0 flex items-center px-2 text-gray-500">
                            <ChevronDown size={12} />
                        </div>
                    </div>
                </div>
            </div>

            {/* 3. SCORE & SPELERS (Centraal) */}
            <div className="flex items-center justify-between gap-3 flex-1">
                {/* Speler 1 */}
                <div className={`flex-1 text-right text-sm md:text-base truncate font-medium ${match.score_p1 > match.score_p2 && match.is_completed ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
                    {match.player1_name || 'Bye'}
                </div>

                {/* Score Inputs */}
                <div className="flex items-center bg-white border-2 border-gray-100 rounded-lg shadow-sm overflow-hidden focus-within:border-blue-400 transition-colors shrink-0">
                    <input 
                        type="number" 
                        className={`w-12 h-10 text-center outline-none font-bold no-spinner text-lg ${match.save_success ? 'text-green-600' : 'text-gray-800'}`}
                        value={match.score_p1}
                        onChange={(e) => handleScoreChange(match.id, 'score_p1', e.target.value)}
                        onBlur={() => saveMatchScore(match)}
                        onKeyDown={(e) => handleKeyDown(e, match)}
                    />
                    <div className="h-full w-px bg-gray-100"></div>
                    <input 
                        type="number" 
                        className={`w-12 h-10 text-center outline-none font-bold no-spinner text-lg ${match.save_success ? 'text-green-600' : 'text-gray-800'}`}
                        value={match.score_p2}
                        onChange={(e) => handleScoreChange(match.id, 'score_p2', e.target.value)}
                        onBlur={() => saveMatchScore(match)}
                        onKeyDown={(e) => handleKeyDown(e, match)}
                    />
                </div>

                {/* Speler 2 */}
                <div className={`flex-1 text-left text-sm md:text-base truncate font-medium ${match.score_p2 > match.score_p1 && match.is_completed ? 'text-green-700 font-bold' : 'text-gray-700'}`}>
                    {match.player2_name || 'Bye'}
                </div>
            </div>

            {/* 4. ACTIES (Desktop: Rechts) */}
            <div className="hidden md:flex w-8 justify-end">
                {match.is_saving ? (
                    <RefreshCcw size={16} className="animate-spin text-blue-500" />
                ) : match.save_success ? (
                    <SaveAll size={16} className="text-green-500" />
                ) : (
                    <button onClick={() => handleResetMatch(match.id)} className="p-2 text-gray-300 hover:text-red-500 transition-colors" title="Reset Match">
                        <RefreshCcw size={16} />
                    </button>
                )}
            </div>
        </div>
    ))}
</div>

                                {/* KOLOM 3: STANDEN (Alleen zichtbaar bij Poules) */}
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
                                                            <td className="py-2 font-bold text-gray-700 truncate max-w-[100px]" title={p.name}>{p.name}</td>
                                                            <td className="py-2 text-center font-bold text-blue-600">{p.points}</td>
                                                            <td className="py-2 text-center text-gray-500">{p.leg_diff}</td>
                                                            <td className="py-2">
                                                                {p.needs_shootout && (
                                                                    <span className="flex items-center w-fit gap-1 text-[10px] bg-red-100 text-red-600 px-2 py-0.5 rounded-full font-bold border border-red-200" title="Shootout vereist">
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
                                                * Live Stand
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


{/* --- CODES MODAL --- */}
{showCodesModal && (
    <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCodesModal(false)}>
        <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden" onClick={e => e.stopPropagation()}>
            <div className="bg-indigo-600 p-4 text-white flex justify-between items-center">
                <h3 className="font-bold text-lg flex items-center gap-2"><Monitor /> Koppelcodes voor Tablets</h3>
                <button onClick={() => setShowCodesModal(false)}><X /></button>
            </div>
            
            <div className="p-6 grid grid-cols-1 gap-4">
                {boardCodes.map((b) => {
                    // Gebruik de scorer_uuid van het toernooi voor de link
                    const directUrl = `${window.location.origin}/board/${tournament?.scorer_uuid}`;
                    
                    return (
                        <div key={b.board_number} className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-4 flex items-center justify-between">
                            <div className="text-left">
                                <div className="text-xs font-bold text-gray-400 uppercase mb-1">Bord {b.board_number}</div>
                                <div className="text-4xl font-mono font-bold text-indigo-600 tracking-widest">{b.code}</div>
                            </div>
                            
                            <div className="flex flex-col gap-2">
                                <a 
                                    href={directUrl}
                                    target="_blank"
                                    rel="noreferrer"
                                    className="flex items-center gap-2 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition text-sm font-bold"
                                >
                                    <Monitor size={16} /> Open Scorer
                                </a>
                                <button 
                                    onClick={() => {
                                        navigator.clipboard.writeText(directUrl);
                                        alert(`Link voor bord ${b.board_number} gekopieerd!`);
                                    }}
                                    className="text-[10px] text-gray-400 hover:text-indigo-600 underline text-center"
                                >
                                    Kopieer Link
                                </button>
                            </div>
                        </div>
                    );
                })}
            </div>
            
            <div className="p-4 bg-gray-50 text-center text-sm text-gray-500 border-t">
                Scan de code op de tablet of gebruik de directe links hierboven.
            </div>
        </div>
    </div>
)}

    </AdminLayout>
  );
};

export default ManageTournament;