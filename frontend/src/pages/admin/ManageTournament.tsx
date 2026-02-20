// FILE: frontend/src/pages/admin/ManageTournament.tsx
import { useEffect, useState } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { 
    Save, RefreshCcw, ShieldAlert, Settings, ChevronDown, ChevronRight, 
    SaveAll, GitMerge, Trophy, AlertCircle, LayoutGrid, Medal, 
    UserPlus, Monitor, X, Target, User, Edit2, ArrowRightLeft, Beer
} from 'lucide-react';
import { Dartboard, Tournament, Match } from '../../types';

import { polyfill } from 'mobile-drag-drop';
import { scrollBehaviourDragImageTranslateOverride } from 'mobile-drag-drop/scroll-behaviour';
import 'mobile-drag-drop/default.css';

// --- TYPE FIXES ---
// We breiden de geïmporteerde Tournament interface lokaal uit
// zodat TypeScript niet klaagt over 'mode' of 'players'.
interface TournamentExtended extends Omit<Tournament, 'players'> {
    mode: 'singles' | 'doubles';
    players: { id: number; name: string }[]; // Nu mag dit wel!
    teams: { id: number; name: string }[];
    qualifiers_per_poule?: number;
    allow_byes: boolean;
    shuffle_boards: boolean;
    public_uuid?: string;
    format: string;
    enable_beer_fetchers: boolean;
}

// Uitgebreide interface voor UI-specifieke properties van Match
interface MatchWithUI extends Match {
  best_of_legs?: number;
  player1_name: string;
  player2_name: string;
  score_p1: number;
  score_p2: number;
  is_completed: boolean;
  round_number: number;
  poule_number: number | null;
  board_number?: number | null; 
  
  // Schrijver velden
  referee_id?: number | null;     
  referee_team_id?: number | null; 
  custom_referee_name?: string | null; 
  referee_name?: string;     
  
  beer_fetcher_id?: number | null;
  beer_fetcher_team_id?: number | null;
  beer_fetcher_name?: string;
  
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
    is_expired?: boolean;
}

const ManageTournament = () => {
  const { id } = useParams();
  const navigate = useNavigate();
  
  // --- STATE ---
  // Gebruik hier de Extended interface
  const [tournament, setTournament] = useState<TournamentExtended | null>(null);
  const [matches, setMatches] = useState<MatchWithUI[]>([]);
  const [standings, setStandings] = useState<Record<number, StandingsItem[]>>({});
  const [loading, setLoading] = useState(true);
  
  // Settings State
  const [allowByes, setAllowByes] = useState(true);
  const [shuffleBoards, setShuffleBoards] = useState(false);
  const [settingsDirty, setSettingsDirty] = useState(false);
  const [newAdminEmail, setNewAdminEmail] = useState('');

  // UI State
  const [openRounds, setOpenRounds] = useState<Record<string, boolean>>({});
  const [expandedMatchIds, setExpandedMatchIds] = useState<number[]>([]);
  
  const [allBoards, setAllBoards] = useState<Dartboard[]>([]);
  const [showCodesModal, setShowCodesModal] = useState(false);
  const [boardCodes, setBoardCodes] = useState<BoardCode[]>([]);


  // TAB STATE
  const [activeTab, setActiveTab] = useState<'matches' | 'poules'>('matches');

    const handleShowCodes = async () => {
        try {
            const res = await api.post(`/scorer/generate-codes/${id}`);
            setBoardCodes(res.data);
            setShowCodesModal(true);
        } catch (err) {
            alert("Kon codes niet ophalen.");
        }
    };

    const handleRefreshCodes = async () => {
        if (!confirm("Weet je het zeker? Dit maakt alle huidige codes ongeldig. Tablets moeten opnieuw inloggen.")) return;
        try {
            const res = await api.post(`/scorer/refresh-codes/${id}`);
            setBoardCodes(res.data);
        } catch (err) {
            alert("Kon codes niet vernieuwen.");
        }
    };

  useEffect(() => {
    // Activeer de mobile drag & drop workaround
    polyfill({
        dragImageTranslateOverride: scrollBehaviourDragImageTranslateOverride
    });
    
    // Voorkom dat iOS/Android probeert te scrollen als je een draggable item vastpakt
    window.addEventListener( 'touchmove', function() {}, {passive: false});
    loadData();
  }, [id]);

  // --- DATA LADEN ---
  const loadData = async (isBackground = false) => {
    if (!isBackground) setLoading(true);
    try {
      const [tournRes, boardsRes] = await Promise.all([
          api.get(`/tournaments/${id}`),
          api.get('/dartboards/') 
      ]);

      const currentTourn = tournRes.data;
      
      setTournament(currentTourn);
      setAllBoards(boardsRes.data);
      setAllowByes(currentTourn.allow_byes);
      setShuffleBoards(currentTourn.shuffle_boards || false);

      if (currentTourn.public_uuid) {
          const matchesRes = await api.get(`/matches/by-tournament/${currentTourn.public_uuid}`);
          const allMatches = matchesRes.data;
          
          setMatches(prevMatches => {
              return allMatches.map((nm: MatchWithUI) => {
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

          if (!isBackground && allMatches.length > 0) {
              const newOpenRounds: Record<string, boolean> = {};
              allMatches.forEach((m: any) => {
                  const type = m.poule_number !== null ? 'P' : 'K';
                  const num = m.poule_number !== null ? m.poule_number : m.round_number;
                  const key = `${type}-${num}`;
                  if (!m.is_completed) {
                      newOpenRounds[key] = true;
                  } else if (newOpenRounds[key] !== true) {
                      newOpenRounds[key] = false;
                  }
              });
              setOpenRounds(newOpenRounds);
          }
      }
    } catch (error) {
      console.error("Fout bij laden data:", error);
    } finally {
      if (!isBackground) setLoading(false);
    }
  };

  // --- ACTIES ---

  const handleUpdateSettings = async () => {
    if (!tournament) return;
    try {
        await api.patch(`/tournaments/${tournament.id}`, { 
            allow_byes: allowByes, 
            shuffle_boards: shuffleBoards 
        });
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
          setExpandedMatchIds(prev => prev.filter(id => id !== match.id));
          loadData(true); 
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

  const handleBoardChange = async (matchId: number, newBoardVal: string) => {
    const boardNum = parseInt(newBoardVal);
    if (isNaN(boardNum)) return;

    setMatches(prev => prev.map(m => m.id === matchId ? { ...m, board_number: boardNum } : m));

    try {
        await api.patch(`/matches/${matchId}/assign-board`, { board_number: boardNum });
    } catch (err) {
        console.error(err);
        alert("Kon bord niet wijzigen.");
        loadData(true);
    }
  };

  const canStartKnockout = () => {
    if (!tournament || !matches.length) return false;
    if (tournament.format !== 'hybrid') return false; 

    const pouleMatches = matches.filter(m => m.poule_number !== null);
    const koMatches = matches.filter(m => m.poule_number === null);

    if (pouleMatches.length === 0) return false;
    
    const allPoulesFinished = pouleMatches.every(m => m.is_completed);
    const koNotStarted = koMatches.length === 0;
    
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

  const handleAddAdmin = async (e: React.FormEvent) => {
      e.preventDefault();
      if (!newAdminEmail) return;

      try {
          await api.post(`/tournaments/${id}/admins`, { email: newAdminEmail });
          alert(`Gebruiker ${newAdminEmail} is succesvol toegevoegd als admin!`);
          setNewAdminEmail(''); 
      } catch (err: any) {
          console.error(err);
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

  const toggleMatchExpand = (matchId: number) => {
    setExpandedMatchIds(prev => 
        prev.includes(matchId) 
        ? prev.filter(id => id !== matchId) 
        : [...prev, matchId]
    );
  };

  const getRoundName = (roundNum: number, matchCount: number) => {
    if (matchCount === 1) return "Finale";
    if (matchCount === 2) return "Halve Finale";
    if (matchCount === 4) return "Kwartfinale";
    return `Ronde ${roundNum}`;
  };

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

  // --- NIEUW: Genereer poule-overzicht uit de wedstrijden (ipv standings) ---
  const pouleLayout = matches.reduce((acc, match) => {
      // Sla knockout wedstrijden over, we willen alleen poules
      if (match.poule_number === null) return acc; 

      const pNum = match.poule_number;
      if (!acc[pNum]) acc[pNum] = [];

      // Helper functie om te checken of speler al in de lijst staat voor deze poule
      const addPlayer = (id: number | undefined | null, name: string) => {
          if (!id) return; // Geen ID (bijv. placeholder/bye)? Sla over.
          // Als speler nog niet in de lijst van deze poule staat, voeg toe
          if (!acc[pNum].find(p => p.id === id)) {
              acc[pNum].push({ id, name });
          }
      };

      // Voeg beide spelers van de match toe aan de lijst
      if (tournament?.mode === 'doubles') {
          addPlayer(match.team1_id, match.player1_name);
          addPlayer(match.team2_id, match.player2_name);
      } else {
          addPlayer(match.player1_id, match.player1_name);
          addPlayer(match.player2_id, match.player2_name);
      }

      return acc;
  }, {} as Record<number, { id: number, name: string }[]>);

  const handleRefereeChange = async (matchId: number, value: string) => {
    let payload: any = { 
        score_p1: matches.find(m => m.id === matchId)?.score_p1 || 0,
        score_p2: matches.find(m => m.id === matchId)?.score_p2 || 0
    };

    if (value === "CUSTOM_PROMPT") {
        const customName = prompt("Voer de naam van de schrijver in:");
        if (!customName) return;
        payload.custom_referee_name = customName;
        payload.referee_id = null;
        payload.referee_team_id = null;
    } else if (value === "") {
        payload.referee_id = null;
        payload.referee_team_id = null;
        payload.custom_referee_name = null;
    } else {
        const idVal = parseInt(value);
        if (tournament?.mode === 'doubles') {
            payload.referee_team_id = idVal;
            payload.referee_id = null;
        } else {
            payload.referee_id = idVal;
            payload.referee_team_id = null;
        }
        payload.custom_referee_name = null;
    }

    try {
        await api.put(`/matches/${matchId}/score`, payload);
        loadData(false); 
    } catch (err) {
        console.error("Update failed", err);
    }
  };

const handleBeerFetcherChange = async (matchId: number, value: string) => {
    const idVal = value === "" ? null : parseInt(value);

    try {
        const payload: any = {};
        if (tournament?.mode === 'singles') {
            payload.beer_fetcher_id = idVal;
        } else {
            payload.beer_fetcher_team_id = idVal;
        }
        
        await api.patch(`/matches/${matchId}/beer-fetcher`, payload);
        loadData(false);
    } catch (error) {
        console.error('Error updating beer fetcher:', error);
        alert('Fout bij updaten bierhaler');
    }
};

  // --- POULE SWAP LOGIC ---
    const handleDrop = async (sourceId: number, targetId: number) => {
        if (sourceId === targetId) return;
        
        const doSwap = async (confirmed: boolean) => {
            try {
                const res = await api.post(`/tournaments/${id}/swap-participants`, {
                    entity_id_1: sourceId,
                    entity_id_2: targetId,
                    confirmed: confirmed
                });

                if (res.data.require_confirmation) {
                    if (window.confirm(res.data.message)) {
                        doSwap(true); // Retry met bevestiging
                    }
                } else {
                    // Succes! Herlaad data
                    loadData(true);
                }
            } catch (err: any) {
                alert("Er ging iets mis bij het wisselen: " + (err.response?.data?.detail || err.message));
            }
        };

        doSwap(false);
    };

    // --- MATCH SWAP LOGIC ---
const handleMatchDrop = async (sourceMatchId: number, targetMatchId: number) => {
        if (sourceMatchId === targetMatchId) return;
        
        // 1. Onthoud positie
        const currentScroll = window.scrollY; 
        
        try {
            await api.post(`/tournaments/${id}/swap-matches`, {
                match_id_1: sourceMatchId,
                match_id_2: targetMatchId
            });
            
            await loadData(true);
            
            // 2. Herstel positie (voor de zekerheid)
            window.scrollTo(0, currentScroll);
            
        } catch (err: any) {
            // ... error handling
        }
    };

    // --- DRAG HANDLERS (UPDATED) ---
    
    // Start met slepen (Speler OF Match)
    const onDragStart = (e: React.DragEvent, type: 'player' | 'match', id: number) => {
        e.stopPropagation(); // Belangrijk! Zorgt dat match-drag niet start als je een speler pakt
        e.dataTransfer.setData("type", type);
        e.dataTransfer.setData("id", id.toString());
        e.dataTransfer.effectAllowed = "move";
    };

const onDragOver = (e: React.DragEvent) => {
        e.preventDefault(); 
        // Expliciet aangeven dat we hier iets mogen verplaatsen (helpt voor mobiel)
        e.dataTransfer.dropEffect = "move"; 
    };

    // Drop handler
    const onDropAny = (e: React.DragEvent, targetType: 'player' | 'match', targetId: number) => {
        e.preventDefault();
        e.stopPropagation();
        
        const sourceType = e.dataTransfer.getData("type");
        const sourceId = parseInt(e.dataTransfer.getData("id"));

        if (isNaN(sourceId)) return;

        // Scenario 1: Speler op Speler (Bestaande logica)
        if (sourceType === 'player' && targetType === 'player') {
            handleDrop(sourceId, targetId); // Je oude handleDrop functie voor spelers
        }
        
        // Scenario 2: Match op Match (Nieuwe logica)
        if (sourceType === 'match' && targetType === 'match') {
            handleMatchDrop(sourceId, targetId);
        }
    };

const matchesByRound = matches.reduce((acc: { [key: number]: MatchWithUI[] }, match) => {
    const rId = match.round_id || match.round_number || 0;
    if (!acc[rId]) acc[rId] = [];
    acc[rId].push(match);
    return acc;
}, {});

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
        
        /* Zorgt dat mobiel slepen soepel werkt (geen scroll) */
        .draggable-item {
            touch-action: none;
            user-select: none;
            -webkit-user-select: none;
        }

        /* --- NIEUW: DE FIX VOOR HET DROPPEN --- */
        /* Zorgt dat het 'spook-plaatje' onder je vinger genegeerd wordt door de touch events, 
           zodat de drop erdoorheen valt op het juiste doel. */
        .dnd-poly-drag-image {
            pointer-events: none !important;
        }
      `}</style>

      <div className="max-w-5xl mx-auto pb-20">
        
        {/* HEADER */}
        <div className="flex flex-col md:flex-row md:justify-between md:items-center gap-4 mb-6">
            <h2 className="text-2xl md:text-3xl font-bold text-gray-800 flex items-center gap-2 md:gap-3">
                <Settings className="text-gray-600 w-6 h-6 md:w-8 md:h-8" />
                <span className="truncate flex-1">Beheer: <span className="text-blue-600">{tournament.name}</span></span>
            </h2>
            
            <div className="flex gap-2 w-full md:w-auto">
                <button 
                    onClick={handleShowCodes} 
                    className="flex-1 md:flex-none justify-center px-4 py-2 bg-indigo-600 text-white rounded hover:bg-indigo-700 transition flex items-center gap-2 font-bold shadow-sm"
                >
                    <Monitor size={18} /> Bord Codes
                </button>
                <button onClick={() => loadData()} className="p-2 bg-gray-200 rounded hover:bg-gray-300 transition shrink-0">
                    <RefreshCcw size={20} />
                </button>
            </div>
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
                <label className="flex items-center gap-2 cursor-pointer mt-2">
                    <input type="checkbox" checked={shuffleBoards} onChange={e => { setShuffleBoards(e.target.checked); setSettingsDirty(true); }} className="w-5 h-5 accent-blue-600"/>
                    <span className="font-medium text-gray-700">Borden Hussel (Wedstrijden roteren over borden)</span>
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

        {/* --- TABS --- */}
        <div className="flex border-b border-gray-200 mb-6">
            <button
                onClick={() => setActiveTab('matches')}
                className={`px-6 py-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
                    activeTab === 'matches' ? 'border-blue-600 text-blue-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                <Trophy size={18} /> Wedstrijden
            </button>
            <button
                onClick={() => setActiveTab('poules')}
                className={`px-6 py-3 font-bold text-sm flex items-center gap-2 border-b-2 transition-colors ${
                    activeTab === 'poules' ? 'border-purple-600 text-purple-600' : 'border-transparent text-gray-500 hover:text-gray-700'
                }`}
            >
                <ArrowRightLeft size={18} /> Poule Indeling (Slepen)
            </button>
        </div>

{/* --- VIEW: POULE & KNOCKOUT MANAGER (DRAG & DROP) --- */}
            {activeTab === 'poules' && (
                <div className="animate-fade-in space-y-8">
                      <div className="bg-blue-50 border border-blue-200 p-4 rounded-lg flex items-start gap-3">
                        <div className="p-2 bg-blue-100 text-blue-600 rounded-full mt-1"><ArrowRightLeft size={20}/></div>
                        <div>
                            <h4 className="font-bold text-blue-800">Indeling & Seeding Aanpassen</h4>
                            <p className="text-sm text-blue-600">Sleep spelers naar een andere positie om te wisselen. <br/>Dit werkt voor Poules én voor Ronde 1 van de Knockout (bracket seeding).</p>
                        </div>
                    </div>

                    {/* SECTIE 1: POULES */}
                    <div>
                        <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><LayoutGrid size={20}/> Poule Indeling</h3>
                        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
                            {Object.entries(pouleLayout)
                                .sort(([a], [b]) => Number(a) - Number(b))
                                .map(([pouleNum, participants]) => (
                                <div key={pouleNum} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
                                    <div className="bg-gray-50 p-3 border-b border-gray-200 font-bold text-gray-700 flex justify-between items-center">
                                        <span>Poule {pouleNum}</span>
                                        <span className="text-xs bg-gray-200 px-2 py-1 rounded text-gray-600">{participants.length} spelers</span>
                                    </div>
                                    <div className="p-2 space-y-2 min-h-[50px]">
                                        {participants.map(p => (
                                            <div
                                                key={p.id}
                                                draggable
                                                onDragStart={(e) => onDragStart(e, 'player', p.id)}
                                                onDragOver={onDragOver}
                                                onDragEnter={onDragOver}
                                                onDrop={(e) => onDropAny(e, 'player', p.id)}
                                                className="draggable-item p-3 border border-gray-200 rounded bg-white hover:border-purple-400 hover:shadow-md cursor-grab active:cursor-grabbing transition-all flex items-center gap-3 group"                                                      >
                                                <div className="bg-gray-100 p-1.5 rounded text-gray-400 group-hover:text-purple-500">
                                                    <User size={16}/>
                                                </div>
                                                <div className="font-medium text-gray-800">{p.name}</div>
                                            </div>
                                        ))}
                                    </div>
                                </div>
                            ))}
                            {Object.keys(pouleLayout).length === 0 && <p className="text-gray-400 italic">Geen poules actief.</p>}
                        </div>
                    </div>

                    {/* SECTIE 1.5: POULE WEDSTRIJD VOLGORDE */}
{matches.some(m => m.poule_number !== null) && (
    <div className="border-t pt-6 mt-6">
        <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2">
            <Trophy size={20}/> Poule Wedstrijd Volgorde
        </h3>
        <p className="text-xs text-gray-500 mb-4">
            Sleep de wedstrijden om de speelvolgorde binnen de poules aan te passen.
        </p>
        
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6">
            {/* Groepeer matches per poule */}
            {Object.entries(matches.reduce((acc, m) => {
                if (m.poule_number === null) return acc;
                if (!acc[m.poule_number]) acc[m.poule_number] = [];
                acc[m.poule_number].push(m);
                return acc;
            }, {} as Record<number, MatchWithUI[]>))
            .sort(([a], [b]) => Number(a) - Number(b)) // Sorteer op poule nummer
            .map(([pouleNum, pouleMatches]) => (
                <div key={pouleNum} className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden flex flex-col">
                    <div className="bg-gray-100 p-2 font-bold text-gray-700 text-sm border-b">
                        Poule {pouleNum} - Wedstrijden
                    </div>
                    <div className="p-2 space-y-2 flex-1">
                        {pouleMatches
                            // Sorteer op ID of een volgorde veld als je dat hebt
                            .sort((a, b) => a.id - b.id) 
                            .map((match, idx) => (
                            <div 
                                key={match.id}
                                draggable
                                onDragStart={(e) => onDragStart(e, 'match', match.id)}
                                onDragOver={onDragOver}
                                onDragEnter={onDragOver}
                                onDrop={(e) => onDropAny(e, 'match', match.id)}
                                className="draggable-item bg-white border border-gray-200 p-2 rounded text-xs flex justify-between items-center cursor-move hover:shadow hover:border-blue-400 group"
                            >
                                <span className="text-gray-400 font-mono w-4">{idx + 1}.</span>
                                <div className="flex-1 flex justify-between px-2">
                                    <span className="truncate max-w-[40%]">{match.player1_name}</span>
                                    <span className="text-gray-400 text-[10px]">vs</span>
                                    <span className="truncate max-w-[40%] text-right">{match.player2_name}</span>
                                </div>
                            </div>
                        ))}
                    </div>
                </div>
            ))}
        </div>
    </div>
)}

{/* SECTIE 2: KNOCKOUT (Ronde 1) */}
                    {matches.some(m => m.poule_number === null) && (
                        <div className="border-t pt-6">
                            <h3 className="font-bold text-gray-700 mb-3 flex items-center gap-2"><GitMerge size={20}/> Knockout Seeding (Ronde 1)</h3>
                            <p className="text-xs text-gray-500 mb-4">Tip: Sleep een <span className="font-bold">hele wedstrijd</span> om de volgorde te wijzigen (bijv. Byes verplaatsen), of sleep <span className="font-bold">spelers</span> om specifieke matchups aan te passen.</p>
                            
                            <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
                                {matches
                                    .filter(m => m.poule_number === null && m.round_number === 1)
                                    .sort((a,b) => a.id - b.id)
                                    .map((match, idx) => (
                                    <div 
                                            key={match.id} 
                                            draggable
                                            onDragStart={(e) => onDragStart(e, 'match', match.id)}
                                            onDragOver={onDragOver}
                                            onDragEnter={onDragOver}
                                            onDrop={(e) => onDropAny(e, 'match', match.id)}
                                            className="draggable-item bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden cursor-move hover:shadow-md transition-shadow group"
                                    >
                                            <div className="bg-orange-50 p-2 border-b border-orange-100 font-bold text-orange-800 text-xs flex justify-between items-center">
                                                <span className="flex items-center gap-1"><LayoutGrid size={12}/> Match {idx + 1}</span>
                                                {match.player2_name === "Bye" ? <span className="bg-green-200 text-green-800 px-1 rounded">BYE</span> : <span className="opacity-50">vs</span>}
                                            </div>
                                            
                                            <div className="p-2 space-y-2 cursor-default"> {/* cursor-default reset de cursor voor de inhoud */}
                                                {/* Speler 1 */}
                                                {match.player1_id && (
                                                    <div
                                                        draggable
                                                        onDragStart={(e) => onDragStart(e, 'player', match.player1_id!)}
                                                        onDragOver={onDragOver}
                                                        onDragEnter={onDragOver}
                                                        onDrop={(e) => onDropAny(e, 'player', match.player1_id!)}
                                                        className="draggable-item p-2 border border-gray-100 rounded bg-gray-50 hover:bg-white hover:border-blue-400 cursor-grab flex items-center gap-2 text-sm"                                                                >
                                                        <span className="font-bold text-gray-700 truncate">{match.player1_name}</span>
                                                    </div>
                                                )}
                                                
                                                {/* Speler 2 */}
                                                {match.player2_id && (
                                                    <div
                                                        draggable
                                                        onDragStart={(e) => onDragStart(e, 'player', match.player2_id!)}
                                                        onDragOver={onDragOver}
                                                        onDragEnter={onDragOver}
                                                        onDrop={(e) => onDropAny(e, 'player', match.player2_id!)}
                                                        className="draggable-item p-2 border border-gray-100 rounded bg-gray-50 hover:bg-white hover:border-blue-400 cursor-grab flex items-center gap-2 text-sm"                                                                >
                                                        <span className="font-bold text-gray-700 truncate">{match.player2_name}</span>
                                                    </div>
                                                )}
                                            </div>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}
                </div>
            )}

        {/* --- VIEW: WEDSTRIJDEN LIJST --- */}
{activeTab === 'matches' && (
            <div className="space-y-8 animate-fade-in">
                {Object.keys(matchesByRound)
                    .sort((a, b) => Number(a) - Number(b))
                    .map((roundId) => {
                        const roundMatches = matchesByRound[Number(roundId)];
                        const roundNum = roundMatches[0]?.round_number || roundId;
                        
                        // Check of dit blok open of dicht is (we gebruiken de roundId als key)
                        const isOpen = openRounds[`R-${roundId}`] !== false; // Standaard open

                        return (
                            <div key={roundId} className="bg-white border border-gray-200 rounded-xl shadow-sm overflow-hidden">
                                
                                {/* RONDE-BLOK HEADER */}
                                <div 
                                    className="bg-gray-50 px-6 py-4 border-b border-gray-200 flex justify-between items-center cursor-pointer select-none"
                                    onClick={() => setOpenRounds(prev => ({...prev, [`R-${roundId}`]: !isOpen}))}
                                >
                                    <div className="flex items-center gap-3">
                                        {isOpen ? <ChevronDown size={20} className="text-gray-400" /> : <ChevronRight size={20} className="text-gray-400" />}
                                        <div>
                                            <h3 className="text-lg font-bold text-gray-800 flex items-center gap-2">
                                                <LayoutGrid size={20} className="text-indigo-600" />
                                                Ronde {roundNum}
                                            </h3>
                                            <p className="text-[10px] text-gray-500 uppercase font-bold tracking-wider">
                                                {roundMatches.length} wedstrijden op de borden
                                            </p>
                                        </div>
                                    </div>

                                    {/* Snelle status indicator */}
                                    <div className="hidden sm:flex gap-2">
                                        {roundMatches.filter(m => m.is_completed).length} / {roundMatches.length} Klaar
                                    </div>
                                </div>

                                {isOpen && (
                                    <div className="p-6 grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-6 bg-gray-50/30">
                                        {roundMatches.map((match) => (
                                            <div 
                                                key={match.id} 
                                                className={`relative p-5 rounded-xl border-2 transition-all ${
                                                    match.is_completed 
                                                        ? 'bg-white border-gray-100 opacity-80' 
                                                        : 'bg-white border-white shadow-sm hover:border-indigo-300 ring-1 ring-black/5'
                                                }`}
                                            >
                                                {/* Bord & Type Info */}
                                                <div className="flex justify-between items-center mb-4">
                                                    <div className="flex gap-2">
                                                        <span className="bg-indigo-600 text-white text-[10px] font-black px-2 py-1 rounded shadow-sm">
                                                            BORD {match.board_number}
                                                        </span>
                                                        {match.poule_number && (
                                                            <span className="bg-blue-100 text-blue-700 text-[10px] font-bold px-2 py-1 rounded">
                                                                POULE {match.poule_number}
                                                            </span>
                                                        )}
                                                    </div>
                                                    {match.is_completed && <Medal size={18} className="text-green-500" />}
                                                </div>

                                                {/* Scores & Namen */}
                                                <div className="space-y-3 mb-5">
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className={`text-sm truncate flex-1 ${match.score_p1 > match.score_p2 && match.is_completed ? 'font-black text-gray-900' : 'font-medium text-gray-700'}`}>
                                                            {match.player1_name}
                                                        </span>
                                                        <input 
                                                            type="number"
                                                            className="w-12 h-9 text-center border-2 rounded-lg font-bold text-lg focus:border-indigo-500 outline-none transition-colors no-spinner"
                                                            value={match.score_p1}
                                                            onChange={(e) => handleScoreChange(match.id, 'score_p1', e.target.value)}
                                                            onBlur={() => saveMatchScore(match)}
                                                            onKeyDown={(e) => handleKeyDown(e, match)}
                                                        />
                                                    </div>
                                                    <div className="flex items-center justify-between gap-3">
                                                        <span className={`text-sm truncate flex-1 ${match.score_p2 > match.score_p1 && match.is_completed ? 'font-black text-gray-900' : 'font-medium text-gray-700'}`}>
                                                            {match.player2_name}
                                                        </span>
                                                        <input 
                                                            type="number"
                                                            className="w-12 h-9 text-center border-2 rounded-lg font-bold text-lg focus:border-indigo-500 outline-none transition-colors no-spinner"
                                                            value={match.score_p2}
                                                            onChange={(e) => handleScoreChange(match.id, 'score_p2', e.target.value)}
                                                            onBlur={() => saveMatchScore(match)}
                                                            onKeyDown={(e) => handleKeyDown(e, match)}
                                                        />
                                                    </div>
                                                </div>

                                                {/* Personeel: Schrijver & Bierhaler */}
                                                <div className="pt-4 border-t border-gray-100 space-y-3">
                                                    {/* Schrijver Selector */}
                                                    <div className="flex flex-col gap-1">
                                                        <label className="text-[9px] font-black text-gray-400 uppercase tracking-widest">Schrijver</label>
                                                        <select 
                                                            className="text-xs bg-gray-50 border-none rounded-md py-1 px-2 font-bold text-gray-600 focus:ring-1 focus:ring-indigo-500"
                                                            value={match.referee_id || match.referee_team_id || ''} 
                                                            onChange={(e) => handleRefereeChange(match.id, e.target.value)}
                                                        >
                                                            <option value="">{match.referee_name || '-- Kies Schrijver --'}</option>
                                                            {(match.poule_number && pouleLayout[match.poule_number] 
                                                                ? pouleLayout[match.poule_number] 
                                                                : (tournament.mode === 'doubles' ? tournament.teams : tournament.players)
                                                            )?.map(entity => (
                                                                <option key={entity.id} value={entity.id}>{entity.name}</option>
                                                            ))}
                                                            <option value="CUSTOM_PROMPT">Handmatig...</option>
                                                        </select>
                                                    </div>

                                                    {/* Bierhaler Display/Selector */}
                                                    {tournament.enable_beer_fetchers && (
                                                        <div className="flex flex-col gap-1 bg-amber-50/50 p-2 rounded-lg border border-amber-100">
                                                            <label className="text-[9px] font-black text-amber-500 uppercase tracking-widest flex items-center gap-1">
                                                                <Beer size={10} /> Bierhaler
                                                            </label>
                                                            <select 
                                                                className="text-xs bg-transparent border-none rounded-md py-0 px-0 font-black text-amber-800 focus:ring-0 cursor-pointer"
                                                                value={match.beer_fetcher_id || match.beer_fetcher_team_id || ''} 
                                                                onChange={(e) => handleBeerFetcherChange(match.id, e.target.value)}
                                                            >
                                                                <option value="">{match.beer_fetcher_name || 'Handige Peppie'}</option>
                                                                {(match.poule_number && pouleLayout[match.poule_number] 
                                                                    ? pouleLayout[match.poule_number] 
                                                                    : (tournament.mode === 'doubles' ? tournament.teams : tournament.players)
                                                                )?.map(entity => (
                                                                    <option key={entity.id} value={entity.id}>{entity.name}</option>
                                                                ))}
                                                            </select>
                                                        </div>
                                                    )}
                                                </div>

                                                {/* Reset Button (Hover Only) */}
                                                <div className="absolute top-2 right-2 opacity-0 group-hover:opacity-100 transition-opacity">
                                                    <button 
                                                        onClick={() => handleResetMatch(match.id)} 
                                                        className="p-1.5 text-gray-300 hover:text-red-500 hover:bg-red-50 rounded-full transition-colors"
                                                        title="Match resetten"
                                                    >
                                                        <RefreshCcw size={14} />
                                                    </button>
                                                </div>
                                            </div>
                                        ))}
                                    </div>
                                )}
                            </div>
                        );
                    })}
                {Object.keys(matchesByRound).length === 0 && (
                    <div className="text-center py-20 bg-gray-50 rounded-xl border-2 border-dashed border-gray-200">
                        <Trophy size={48} className="mx-auto text-gray-300 mb-4" />
                        <p className="text-gray-500 font-medium">Nog geen wedstrijden gegenereerd.</p>
                    </div>
                )}
            </div>
        )}

      {/* --- CODES MODAL --- */}
{showCodesModal && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50 p-4" onClick={() => setShowCodesModal(false)}>
            <div className="bg-white rounded-xl shadow-2xl max-w-lg w-full overflow-hidden flex flex-col max-h-[90vh]" onClick={e => e.stopPropagation()}>
                
                {/* Header */}
                <div className="bg-indigo-600 p-4 text-white flex justify-between items-center shrink-0">
                    <h3 className="font-bold text-lg flex items-center gap-2"><Monitor /> Koppelcodes</h3>
                    <button onClick={() => setShowCodesModal(false)}><X /></button>
                </div>
                
                {/* Scrollable Content */}
<div className="p-6 overflow-y-auto">
    <div className="grid grid-cols-1 gap-4">
        {boardCodes.map((b) => {
            // VERANDERING: We linken nu naar /scorer en geven de code mee in de URL
            const directUrl = `${window.location.origin}/scorer?code=${b.code}`;
            
            return (
                <div key={b.board_number} className={`border-2 border-dashed rounded-lg p-4 flex items-center justify-between ${b.is_expired ? 'bg-red-50 border-red-300' : 'bg-gray-50 border-gray-300'}`}>
                    <div className="text-left">
                        <div className="text-xs font-bold text-gray-400 uppercase mb-1">
                            Bord {b.board_number} {b.is_expired && <span className="text-red-500">(Verlopen)</span>}
                        </div>
                        <div className={`text-4xl font-mono font-bold tracking-widest ${b.is_expired ? 'text-red-400 decoration-line-through' : 'text-indigo-600'}`}>
                            {b.code}
                        </div>
                    </div>
                    <div className="flex flex-col gap-2">
                        <a 
                            href={directUrl} 
                            target="_blank" 
                            rel="noreferrer"
                            className="flex items-center gap-2 px-3 py-2 bg-indigo-100 text-indigo-700 rounded-md hover:bg-indigo-200 transition text-sm font-bold"
                        >
                            <Monitor size={16} /> Open
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
</div>
                {/* Footer met Actieknop */}
                <div className="p-4 bg-gray-100 border-t border-gray-200 text-center shrink-0">
                    <p className="text-xs text-gray-500 mb-3">Codes zijn 7 dagen geldig.</p>
                    <button 
                        onClick={handleRefreshCodes}
                        className="w-full py-3 bg-white border border-red-200 text-red-600 hover:bg-red-50 font-bold rounded-lg shadow-sm flex items-center justify-center gap-2 transition-colors"
                    >
                        <RefreshCcw size={16}/> Genereer Nieuwe Codes (Reset 7 Dagen)
                    </button>
                </div>
            </div>
        </div>
      )}
    </div>
    </AdminLayout>
  );
};

export default ManageTournament;