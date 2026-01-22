import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Player, Dartboard } from '../../types';
import { Trophy, AlertCircle, LayoutGrid, Users, Target, Scissors, Shuffle, UserPlus, Trash2, Save } from 'lucide-react';

// --- STYLING CONSTANTEN ---
const LABEL_STYLE = "block text-xs font-bold text-gray-500 uppercase mb-1";
const INPUT_STYLE = "w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm";

interface Team {
    id: number;
    name: string;
    players: Player[];
}

const CreateTournament = () => {
    const navigate = useNavigate();

    // --- Wizard State ---
    const [step, setStep] = useState<1 | 2>(1); // Stap 1: Setup, Stap 2: Teams
    const [createdTournamentId, setCreatedTournamentId] = useState<number | null>(null);

    // --- Data State ---
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [allBoards, setAllBoards] = useState<Dartboard[]>([]);
    const [loading, setLoading] = useState(true);
    const [teams, setTeams] = useState<Team[]>([]); // Gemaakte teams

    // --- Selection State ---
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
    const [selectedBoardIds, setSelectedBoardIds] = useState<number[]>([]);

    // --- Form State ---
    const defaultName = `Toernooi ${new Date().toLocaleDateString('nl-NL')}`;
    const [name, setName] = useState(defaultName);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);

    // Format settings
    const [participationMode, setParticipationMode] = useState<'singles' | 'doubles'>('singles'); // NIEUW
    const [format, setFormat] = useState('hybrid');
    const [poules, setPoules] = useState(1);
    const [qualifiersPerPoule, setQualifiersPerPoule] = useState(2);
    const [allowByes, setAllowByes] = useState(true);

    // Match length settings
    const [groupLegs, setGroupLegs] = useState(3);
    const [koLegs, setKoLegs] = useState(5);
    const [sets, setSets] = useState(1);

    const [error, setError] = useState<string | null>(null);

    // --- Manual Team Input State ---
    const [manualTeamName, setManualTeamName] = useState("");
    const [manualSelection, setManualSelection] = useState<number[]>([]);

    // --- Load Data ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [pRes, bRes] = await Promise.all([
                    api.get('/players/'),
                    api.get('/dartboards/')
                ]);
                setAllPlayers(pRes.data);
                setAllBoards(bRes.data);

                // --- NIEUW: Standaard 1e bord selecteren ---
                // We checken eerst of de lijst niet leeg is, om errors te voorkomen.
                if (bRes.data.length > 0) {
                    // We pakken het ID van het eerste bord in de lijst
                    setSelectedBoardIds([bRes.data[0].id]);
                }
                // ------------------------------------------

            } catch (err) {
                console.error(err);
                setError("Kon data niet laden. Staat de backend aan?");
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // --- Helpers ---
    const togglePlayer = (id: number) => setSelectedPlayerIds(prev => prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]);
    const toggleBoard = (id: number) => setSelectedBoardIds(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);

    const toggleManualSelection = (id: number) => {
        setManualSelection(prev => {
            if (prev.includes(id)) return prev.filter(p => p !== id);
            if (prev.length >= 2) return prev; // Max 2 selecteren
            return [...prev, id];
        });
    };

    // --- STAP 1: Toernooi Aanmaken ---
    const handleCreateTournament = async (e: React.FormEvent) => {
        e.preventDefault();
        setError(null);

        if (selectedBoardIds.length === 0) {
            setError("Selecteer minimaal 1 dartbord.");
            return;
        }

        // Validatie: bij koppels minimaal 4 spelers (2 teams)
        const minPlayers = participationMode === 'doubles' ? 4 : 2;
        if (selectedPlayerIds.length < minPlayers) {
            setError(`Selecteer minimaal ${minPlayers} spelers.`);
            return;
        }

        try {
            const finalName = name.trim() === "" ? defaultName : name;
            
            // Als we koppels doen, zetten we het toernooi eerst in 'draft' en genereren we nog GEEN matches
            // (Dit vereist wel dat je backend 'teams' ondersteunt bij generatie, voor nu maken we het object aan)
            const payload = {
                name: finalName,
                date,
                format,
                allow_byes: allowByes,
                number_of_poules: poules,
                qualifiers_per_poule: qualifiersPerPoule,
                starting_legs_group: groupLegs,
                starting_legs_ko: koLegs,
                sets_per_match: sets,
                player_ids: selectedPlayerIds,
                board_ids: selectedBoardIds,
                // eventueel: mode: participationMode (als je backend dit ondersteunt)
            };

            const res = await api.post('/tournaments/', payload);
            
            if (participationMode === 'doubles') {
                // Ga naar stap 2: Team Builder
                setCreatedTournamentId(res.data.id);
                setStep(2);
                window.scrollTo(0,0);
            } else {
                // Klaar!
                navigate('/dashboard');
            }

        } catch (err: any) {
            console.error(err);
            setError(err.response?.data?.detail || "Er is iets misgegaan bij het aanmaken.");
            window.scrollTo(0,0);
        }
    };

    // --- STAP 2: Teams Beheren ---
    
    // Spelers die geselecteerd zijn, maar nog NIET in een team zitten
    const unassignedPlayers = allPlayers.filter(p => 
        selectedPlayerIds.includes(p.id) && 
        !teams.some(t => t.players.some(tp => tp.id === p.id))
    );

    const handleAutoGenerate = async () => {
        if (!createdTournamentId) return;
        try {
            // Stuur alle nog niet ingedeelde spelers naar de auto-endpoint
            const idsToAssign = unassignedPlayers.map(p => p.id);
            if (idsToAssign.length < 2) return;

            const res = await api.post('/teams/auto', {
                tournament_id: createdTournamentId,
                player_ids: idsToAssign
            });
            
            setTeams(prev => [...prev, ...res.data]);
        } catch (err) {
            alert("Fout bij genereren teams.");
        }
    };

    const handleManualCreate = async () => {
        if (!createdTournamentId) return;
        if (manualSelection.length !== 2) {
            alert("Selecteer precies 2 spelers voor een team.");
            return;
        }

        try {
            const res = await api.post('/teams/manual', {
                tournament_id: createdTournamentId,
                player_ids: manualSelection,
                name: manualTeamName
            });
            setTeams(prev => [...prev, res.data]);
            
            // Reset form
            setManualSelection([]);
            setManualTeamName("");
        } catch (err) {
            alert("Fout bij aanmaken team.");
        }
    };

    const handleFinalize = async () => {
        // Hier zou je normaliter een endpoint aanroepen om matches te genereren op basis van teams
        // Voor nu sturen we de gebruiker naar het dashboard
        if (unassignedPlayers.length > 0) {
            if(!confirm("Er zijn nog spelers niet ingedeeld in een team. Wil je toch doorgaan?")) return;
        }
        navigate(`/dashboard/tournament/${createdTournamentId}`);
    };

    // ---------------- UI RENDER ----------------

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto pb-20">
                
                {/* HEADER */}
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    {step === 1 ? <Trophy className="text-yellow-500" /> : <Users className="text-blue-500" />} 
                    {step === 1 ? "Nieuw Toernooi" : "Team Indeling"}
                </h2>

                {error && (
                    <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-2 border border-red-200 shadow-sm">
                        <AlertCircle size={20} /> <span className="font-medium">{error}</span>
                    </div>
                )}

                {/* --- STAP 1: SETTINGS & PLAYERS --- */}
                {step === 1 && (
                    <form onSubmit={handleCreateTournament} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
                        
                        {/* SETTINGS (LINKS) */}
                        <div className="lg:col-span-4 space-y-6">
                            
                            {/* Algemeen */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2">1. Algemeen</h3>
                                <div className="space-y-4">
                                    <div>
                                        <label className={LABEL_STYLE}>Naam</label>
                                        <input type="text" className={INPUT_STYLE} value={name} onChange={e => setName(e.target.value)} placeholder={defaultName} />
                                    </div>
                                    <div>
                                        <label className={LABEL_STYLE}>Datum</label>
                                        <input type="date" required className={INPUT_STYLE} value={date} onChange={e => setDate(e.target.value)} />
                                    </div>
                                    
                                    {/* NIEUW: MODUS SELECTIE */}
                                    <div>
                                        <label className={LABEL_STYLE}>Modus</label>
                                        <div className="flex gap-2">
                                            <button type="button" 
                                                onClick={() => setParticipationMode('singles')}
                                                className={`flex-1 py-2 px-3 rounded border text-sm font-bold transition-colors ${participationMode === 'singles' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-300'}`}
                                            >
                                                1 vs 1
                                            </button>
                                            <button type="button" 
                                                onClick={() => setParticipationMode('doubles')}
                                                className={`flex-1 py-2 px-3 rounded border text-sm font-bold transition-colors ${participationMode === 'doubles' ? 'bg-blue-600 text-white border-blue-600' : 'bg-gray-50 text-gray-600 border-gray-300'}`}
                                            >
                                                Koppels
                                            </button>
                                        </div>
                                    </div>
                                </div>
                            </div>

                            {/* Format Settings */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
                                    <LayoutGrid size={18} className="text-blue-500" /> Format
                                </h3>
                                <div className="space-y-4">
                                    <select className={INPUT_STYLE} value={format} onChange={e => setFormat(e.target.value)}>
                                        <option value="hybrid">Hybride (Poules + KO)</option>
                                        <option value="knockout">Direct Knockout</option>
                                        <option value="round_robin">Alleen Poules</option>
                                    </select>

                                    <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                                        <input type="checkbox" id="allowByes" className="mt-1" checked={allowByes} onChange={e => setAllowByes(e.target.checked)} />
                                        <div>
                                            <label htmlFor="allowByes" className="text-sm font-bold text-gray-700">Sta Byes toe</label>
                                            <p className="text-xs text-gray-500">Automatische vrijloting bij oneven aantal.</p>
                                        </div>
                                    </div>

                                    {format === 'hybrid' && (
                                        <div className="grid grid-cols-2 gap-3">
                                            <div>
                                                <label className={LABEL_STYLE}>Poules</label>
                                                <input type="number" min="1" className={INPUT_STYLE} value={poules} onChange={e => setPoules(parseInt(e.target.value))} />
                                            </div>
                                            <div>
                                                <label className={LABEL_STYLE}>Qualifiers</label>
                                                <input type="number" min="1" className={INPUT_STYLE} value={qualifiersPerPoule} onChange={e => setQualifiersPerPoule(parseInt(e.target.value))} />
                                            </div>
                                        </div>
                                    )}
                                </div>
                            </div>
                            
                            {/* Wedstrijd Lengte & Borden (Ingekort voor overzicht) */}
                            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
                                    <Target size={18} className="text-red-500" /> Settings
                                </h3>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div><label className={LABEL_STYLE}>Poule (Bo)</label><input type="number" className={INPUT_STYLE} value={groupLegs} onChange={e => setGroupLegs(Number(e.target.value))}/></div>
                                    <div><label className={LABEL_STYLE}>KO (Bo)</label><input type="number" className={INPUT_STYLE} value={koLegs} onChange={e => setKoLegs(Number(e.target.value))}/></div>
                                </div>
                                
                                <label className={LABEL_STYLE}>Borden</label>
                                <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar border rounded p-2">
                                    {allBoards.map(board => (
                                        <label key={board.id} className={`flex items-center p-1 rounded cursor-pointer text-sm ${selectedBoardIds.includes(board.id) ? 'bg-blue-50 text-blue-700' : ''}`}>
                                            <input type="checkbox" className="mr-2" checked={selectedBoardIds.includes(board.id)} onChange={() => toggleBoard(board.id)} />
                                            Bord {board.number}
                                        </label>
                                    ))}
                                </div>
                            </div>
                        </div>

                        {/* SPELERS SELECTIE (RECHTS) */}
                        <div className="lg:col-span-8 flex flex-col h-full">
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col">
                                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                                    <h3 className="font-bold text-gray-700 flex items-center gap-2">
                                        <Users size={18} className="text-green-600"/> 
                                        {participationMode === 'doubles' ? '2. Selecteer Alle Deelnemers' : '2. Selecteer Spelers'}
                                    </h3>
                                    <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-bold">
                                        {selectedPlayerIds.length} geselecteerd
                                    </span>
                                </div>
                                
                                <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto pr-2 max-h-[600px] custom-scrollbar">
                                    {allPlayers.map(player => (
                                        <label key={player.id} className={`flex items-center p-2 rounded border cursor-pointer select-none text-sm transition-all ${selectedPlayerIds.includes(player.id) ? 'bg-green-50 border-green-500 shadow-sm' : 'hover:bg-gray-50 border-gray-200'}`}>
                                            <input type="checkbox" className="w-4 h-4 text-green-600 rounded accent-green-600" checked={selectedPlayerIds.includes(player.id)} onChange={() => togglePlayer(player.id)} />
                                            <div className="ml-2 font-medium text-gray-800 truncate">{player.name}</div>
                                        </label>
                                    ))}
                                </div>

                                <div className="mt-6 pt-4 border-t border-gray-100">
                                    <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg flex justify-center items-center gap-2">
                                        {participationMode === 'doubles' ? (
                                            <>Verder naar Team Indeling <Scissors className="ml-2" size={18}/></>
                                        ) : (
                                            <><Trophy size={20} /> Toernooi Starten</>
                                        )}
                                    </button>
                                </div>
                            </div>
                        </div>
                    </form>
                )}

                {/* --- STAP 2: TEAM BUILDER (ALLEEN BIJ KOPPELS) --- */}
                {step === 2 && (
                    <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                        
                        {/* LINKER KOLOM: BESCHIKBARE SPELERS & CONTROLS */}
                        <div className="space-y-6">
                            
                            {/* Auto Generator */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-2 flex items-center gap-2">
                                    <Shuffle className="text-purple-500" /> Automatisch Indelen
                                </h3>
                                <p className="text-sm text-gray-500 mb-4">
                                    Hussel alle {unassignedPlayers.length} overgebleven spelers in willekeurige teams.
                                </p>
                                <button 
                                    onClick={handleAutoGenerate}
                                    disabled={unassignedPlayers.length < 2}
                                    className="w-full bg-purple-100 text-purple-700 font-bold py-2 rounded hover:bg-purple-200 transition disabled:opacity-50"
                                >
                                    Random Teams Genereren
                                </button>
                            </div>

                            {/* Manual Creator */}
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                                    <UserPlus className="text-blue-500" /> Handmatig Team
                                </h3>
                                
                                <div className="mb-4">
                                    <label className={LABEL_STYLE}>1. Selecteer 2 spelers uit de lijst hieronder</label>
                                    <div className="text-sm font-medium bg-gray-50 p-2 rounded border border-gray-200 min-h-[40px] flex items-center gap-2">
                                        {manualSelection.length === 0 && <span className="text-gray-400 italic">Geen selectie...</span>}
                                        {manualSelection.map(id => {
                                            const p = allPlayers.find(pl => pl.id === id);
                                            return (
                                                <span key={id} className="bg-blue-100 text-blue-700 px-2 py-1 rounded text-xs">
                                                    {p?.name}
                                                </span>
                                            );
                                        })}
                                    </div>
                                </div>

                                <div className="mb-4">
                                    <label className={LABEL_STYLE}>2. Team Naam (Optioneel)</label>
                                    <input 
                                        type="text" 
                                        className={INPUT_STYLE} 
                                        placeholder="Bijv. 'The Power Duo'" 
                                        value={manualTeamName}
                                        onChange={e => setManualTeamName(e.target.value)}
                                    />
                                </div>

                                <button 
                                    onClick={handleManualCreate}
                                    disabled={manualSelection.length !== 2}
                                    className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition disabled:opacity-50"
                                >
                                    Maak Team
                                </button>
                            </div>

                            {/* Beschikbare Spelers Lijst */}
                            <div className="bg-white p-4 rounded-lg shadow-sm border border-gray-200">
                                <h4 className="font-bold text-gray-500 text-xs uppercase mb-2">Nog in te delen ({unassignedPlayers.length})</h4>
                                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 custom-scrollbar">
                                    {unassignedPlayers.map(p => (
                                        <div 
                                            key={p.id} 
                                            onClick={() => toggleManualSelection(p.id)}
                                            className={`p-2 rounded border text-sm cursor-pointer transition-colors ${
                                                manualSelection.includes(p.id) 
                                                ? 'bg-blue-50 border-blue-500 text-blue-700 font-bold' 
                                                : 'hover:bg-gray-50 border-gray-200'
                                            }`}
                                        >
                                            {p.name}
                                        </div>
                                    ))}
                                </div>
                            </div>

                        </div>

                        {/* RECHTER KOLOM: GEMAAKTE TEAMS */}
                        <div className="flex flex-col h-full">
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col">
                                <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                                    <h3 className="font-bold text-gray-700">Gemaakte Teams</h3>
                                    <span className="bg-green-100 text-green-700 text-xs px-3 py-1 rounded-full font-bold">
                                        {teams.length} Teams
                                    </span>
                                </div>

                                <div className="flex-1 overflow-y-auto space-y-3 pr-2 custom-scrollbar">
                                    {teams.length === 0 ? (
                                        <div className="text-center text-gray-400 py-10 italic">
                                            Nog geen teams gemaakt.<br/>Gebruik de opties links.
                                        </div>
                                    ) : (
                                        teams.map(team => (
                                            <div key={team.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200">
                                                <div>
                                                    <div className="font-bold text-gray-800">{team.name}</div>
                                                    <div className="text-xs text-gray-500 flex gap-1 mt-1">
                                                        {team.players.map(p => (
                                                            <span key={p.id} className="bg-white border px-1 rounded">
                                                                {p.name}
                                                            </span>
                                                        ))}
                                                    </div>
                                                </div>
                                                {/* Verwijderen functionaliteit zou hier kunnen met een delete API call */}
                                                <div className="text-green-500"><Target size={16}/></div>
                                            </div>
                                        ))
                                    )}
                                </div>

                                <div className="mt-6 pt-4 border-t border-gray-100">
                                    <button 
                                        onClick={handleFinalize}
                                        className="w-full bg-green-600 text-white font-bold py-3 rounded-lg hover:bg-green-700 transition shadow-lg flex justify-center items-center gap-2"
                                    >
                                        <Save size={20} /> Opslaan & Starten
                                    </button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};

export default CreateTournament;