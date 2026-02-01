import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Player, Dartboard } from '../../types';
import { 
    Trophy, Users, Target, Scissors, Shuffle, UserPlus, 
    Save, Shield, Plus, X, ArrowRight, ArrowLeft, Dna, AlertTriangle 
} from 'lucide-react';

// --- TYPES ---
interface GlobalTeam {
    id: number;
    name: string;
    players: Player[];
}

interface CartItem {
    id: string; 
    type: 'existing_team' | 'new_team' | 'single_player';
    name: string;
    players: Player[];      
    teamId?: number;        
}

// --- STYLING ---
const LABEL_STYLE = "block text-xs font-bold text-gray-500 uppercase mb-1";
const INPUT_STYLE = "w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 transition-all shadow-sm";
const TAB_active = "border-b-2 border-blue-600 text-blue-600 bg-blue-50";
const TAB_inactive = "text-gray-500 hover:text-gray-700 hover:bg-gray-50";

const CreateTournament = () => {
    const navigate = useNavigate();

    // --- STATE ---
    const [step, setStep] = useState<1 | 2 | 3>(1); 
    const [loading, setLoading] = useState(true);

    // Data
    const [allPlayers, setAllPlayers] = useState<Player[]>([]);
    const [allBoards, setAllBoards] = useState<Dartboard[]>([]);
    const [globalTeams, setGlobalTeams] = useState<GlobalTeam[]>([]);

    // Step 1: Mode
    const [participationMode, setParticipationMode] = useState<'singles' | 'doubles'>('doubles'); 

    // Step 2: Participants (Cart)
    const [cart, setCart] = useState<CartItem[]>([]);
    const [activeTab, setActiveTab] = useState<'teams' | 'players'>('teams'); 
    const [manualSelection, setManualSelection] = useState<number[]>([]); 
    const [manualTeamName, setManualTeamName] = useState("");

    // Step 3: Settings
    const defaultName = `Toernooi ${new Date().toLocaleDateString('nl-NL')}`;
    const [name, setName] = useState(defaultName);
    const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
    const [format, setFormat] = useState('hybrid');
    const [poules, setPoules] = useState(1);
    const [qualifiersPerPoule, setQualifiersPerPoule] = useState(2);
    const [allowByes, setAllowByes] = useState(false); // Standaard UIT
    const [groupLegs, setGroupLegs] = useState(3);
    const [koLegs, setKoLegs] = useState(3);
    const [sets, setSets] = useState(1);
    const [selectedBoardIds, setSelectedBoardIds] = useState<number[]>([]);

    // --- LOAD DATA ---
    useEffect(() => {
        const fetchData = async () => {
            try {
                const [pRes, bRes, tRes] = await Promise.all([
                    api.get('/players/'),
                    api.get('/dartboards/'),
                    api.get('/teams/') 
                ]);
                setAllPlayers(pRes.data);
                setAllBoards(bRes.data);
                setGlobalTeams(tRes.data);
                
                if (bRes.data.length > 0) {
                    setSelectedBoardIds([bRes.data[0].id]); 
                }
            } catch (err) {
                console.error(err);
            } finally {
                setLoading(false);
            }
        };
        fetchData();
    }, []);

    // --- LOGIC: AUTO-CALCULATE SETTINGS (De "Regels") ---
    useEffect(() => {
        if (step !== 3) return;

        const count = cart.length;
        if (count < 2) return;

        // REGEL 1: Max 7 spelers in 1 poule
        // 7 spelers = 1 poule. 8 spelers = 2 poules. 15 spelers = 3 poules.
        let suggestedPoules = Math.ceil(count / 7);
        if (suggestedPoules < 1) suggestedPoules = 1;

        // REGEL 2 & 3: Knockout & Byes
        let suggestedQualifiers = 1;

        if (allowByes) {
            // REGEL: "Iedereen door naar knockout"
            // We zetten qualifiers zo hoog dat iedereen in de grootste poule doorgaat.
            // Gemiddeld aantal spelers per poule (naar boven afgerond)
            suggestedQualifiers = Math.ceil(count / suggestedPoules);
        } else {
            // REGEL: "Byes uit -> Hoogst mogelijke macht van 2"
            // Zoek grootste macht van 2 <= totaal aantal deelnemers
            let targetKO = 1;
            while (targetKO * 2 <= count) {
                targetKO *= 2;
            }
            
            // Verdeel deze plekken over de poules
            // Bijv: 8 plekken / 2 poules = 4 per poule.
            // Bijv: 4 plekken / 1 poule = 4 per poule.
            suggestedQualifiers = Math.floor(targetKO / suggestedPoules);
        }

        if (suggestedQualifiers < 1) suggestedQualifiers = 1;

        // Apply settings (alleen bij initial load van stap 3 of toggle van allowByes)
        setPoules(suggestedPoules);
        setQualifiersPerPoule(suggestedQualifiers);

    }, [step, allowByes, cart.length]); // Herberekenen als Step, Byes of Aantal deelnemers wijzigt


    // --- ACTIONS: CART ---
    const isPlayerInCart = (playerId: number) => {
        return cart.some(item => item.players.some(p => p.id === playerId));
    };

    const addGlobalTeamToCart = (team: GlobalTeam) => {
        const conflict = team.players.find(p => isPlayerInCart(p.id));
        if (conflict) return alert(`${conflict.name} zit al in het toernooi!`);
        setCart(prev => [...prev, {
            id: `existing-${team.id}`, type: 'existing_team', name: team.name, players: team.players, teamId: team.id
        }]);
    };

    const createAdHocTeam = () => {
        if (manualSelection.length !== 2) return;
        const p1 = allPlayers.find(p => p.id === manualSelection[0]);
        const p2 = allPlayers.find(p => p.id === manualSelection[1]);
        if (!p1 || !p2) return;
        const teamName = manualTeamName.trim() || `${p1.first_name} & ${p2.first_name}`;
        setCart(prev => [...prev, {
            id: `new-${Date.now()}`, type: 'new_team', name: teamName, players: [p1, p2]
        }]);
        setManualSelection([]);
        setManualTeamName("");
    };

    const toggleSinglePlayerInCart = (player: Player) => {
        if (isPlayerInCart(player.id)) {
            setCart(prev => prev.filter(item => item.players[0].id !== player.id));
        } else {
            setCart(prev => [...prev, {
                id: `single-${player.id}`, type: 'single_player', name: player.name, players: [player]
            }]);
        }
    };

    const removeFromCart = (itemId: string) => setCart(prev => prev.filter(x => x.id !== itemId));

    const toggleManualSelection = (id: number) => {
        if (isPlayerInCart(id)) return; 
        setManualSelection(prev => {
            if (prev.includes(id)) return prev.filter(p => p !== id);
            if (prev.length >= 2) return prev; 
            return [...prev, id];
        });
    };

    const toggleBoard = (id: number) => setSelectedBoardIds(prev => prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]);

    // --- RANDOM GENERATOR ---
    const generateRandomTeams = () => {
        const usedIds = new Set<number>();
        cart.forEach(item => item.players.forEach(p => usedIds.add(p.id)));
        let available = allPlayers.filter(p => !usedIds.has(p.id));
        
        if (available.length < 2) return alert("Te weinig beschikbare spelers over.");

        available = available.sort(() => Math.random() - 0.5);

        const newItems: CartItem[] = [];
        for (let i = 0; i < available.length - 1; i += 2) {
             const p1 = available[i];
             const p2 = available[i+1];
             newItems.push({
                 id: `random-${Date.now()}-${i}`,
                 type: 'new_team',
                 name: `${p1.first_name} & ${p2.first_name}`,
                 players: [p1, p2]
             });
        }
        setCart(prev => [...prev, ...newItems]);
        if (available.length % 2 !== 0) alert(`Teams gegenereerd! 1 speler (${available[available.length-1].name}) is overgebleven.`);
    };


    // --- SUBMIT ---
    const handleStartTournament = async () => {
        if (selectedBoardIds.length < poules) {
            if (!confirm(`LET OP: Je hebt ${poules} poules maar slechts ${selectedBoardIds.length} borden. Elke poule zou idealiter zijn eigen bord moeten hebben. Wil je toch doorgaan?`)) {
                return;
            }
        }

        setLoading(true);
        try {
            const allPlayerIds = new Set<number>();
            cart.forEach(item => item.players.forEach(p => allPlayerIds.add(p.id)));

            const payload = {
                name: name.trim() === "" ? defaultName : name,
                date, format, mode: participationMode, allow_byes: allowByes,
                number_of_poules: poules, qualifiers_per_poule: qualifiersPerPoule,
                starting_legs_group: groupLegs, starting_legs_ko: koLegs, sets_per_match: sets,
                board_ids: selectedBoardIds,
                player_ids: Array.from(allPlayerIds)
            };
            
            const res = await api.post('/tournaments/', payload);
            const tournamentId = res.data.id;

            if (participationMode === 'doubles') {
                const existingIds = cart.filter(c => c.type === 'existing_team').map(c => c.teamId as number);
                if (existingIds.length > 0) {
                    await api.post('/teams/link', { tournament_id: tournamentId, team_ids: existingIds });
                }
                const newTeams = cart.filter(c => c.type === 'new_team');
                for (const newItem of newTeams) {
                    await api.post('/teams/manual', {
                        tournament_id: tournamentId,
                        player_ids: newItem.players.map(p => p.id),
                        name: newItem.name
                    });
                }
                await api.post(`/tournaments/${tournamentId}/finalize`);
            } 
            navigate(`/dashboard/tournament/${tournamentId}`);

        } catch (err: any) {
            console.error(err);
            alert("Error: " + (err.response?.data?.detail || err.message));
        } finally {
            setLoading(false);
        }
    };

    // Helper voor statistieken
    const getCalculatedStats = () => {
        const total = cart.length;
        const avgPerPoule = poules > 0 ? (total / poules).toFixed(1) : 0;
        const totalQualifiers = poules * qualifiersPerPoule;
        
        let bracketSize = 1;
        while (bracketSize < totalQualifiers) bracketSize *= 2;

        return { total, avgPerPoule, totalQualifiers, bracketSize };
    };
    const stats = getCalculatedStats();

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto pb-20">
                
                {/* --- HEADER --- */}
                <div className="mb-8">
                    <h2 className="text-3xl font-bold text-gray-800 flex items-center gap-2">
                        {step === 1 && <Dna className="text-purple-500" />}
                        {step === 2 && <Users className="text-blue-500" />}
                        {step === 3 && <Target className="text-red-500" />}
                        {step === 1 ? "Stap 1: Kies Modus" : step === 2 ? "Stap 2: Deelnemers" : "Stap 3: Instellingen"}
                    </h2>
                    <div className="w-full bg-gray-200 h-2 rounded-full mt-4 flex">
                        <div className={`h-full rounded-full transition-all duration-300 ${step >= 1 ? 'bg-purple-500 w-1/3' : ''}`}></div>
                        <div className={`h-full rounded-full transition-all duration-300 ${step >= 2 ? 'bg-blue-500 w-1/3' : ''}`}></div>
                        <div className={`h-full rounded-full transition-all duration-300 ${step >= 3 ? 'bg-red-500 w-1/3' : ''}`}></div>
                    </div>
                </div>

                {/* --- STEP 1: MODE --- */}
                {step === 1 && (
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-6 animate-fade-in">
                        <div onClick={() => { setParticipationMode('singles'); setStep(2); setCart([]); }} className="bg-white p-10 rounded-xl shadow-sm border-2 border-transparent hover:border-blue-500 cursor-pointer transition flex flex-col items-center text-center group">
                            <div className="bg-blue-100 p-4 rounded-full mb-4 group-hover:scale-110 transition"><Users size={48} className="text-blue-600"/></div>
                            <h3 className="text-2xl font-bold text-gray-800">1 vs 1 (Singles)</h3>
                            <p className="text-gray-500 mt-2">Iedereen speelt voor zichzelf.</p>
                        </div>
                        <div onClick={() => { setParticipationMode('doubles'); setStep(2); setCart([]); }} className="bg-white p-10 rounded-xl shadow-sm border-2 border-transparent hover:border-purple-500 cursor-pointer transition flex flex-col items-center text-center group">
                            <div className="bg-purple-100 p-4 rounded-full mb-4 group-hover:scale-110 transition"><Scissors size={48} className="text-purple-600"/></div>
                            <h3 className="text-2xl font-bold text-gray-800">Koppels (2 vs 2)</h3>
                            <p className="text-gray-500 mt-2">Kies vaste teams of maak random duo's.</p>
                        </div>
                    </div>
                )}

                {/* --- STEP 2: DEELNEMERS --- */}
                {step === 2 && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                        <div className="lg:col-span-7 flex flex-col h-[600px]">
                            <div className="bg-white rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col overflow-hidden">
                                {participationMode === 'doubles' ? (
                                    <div className="flex border-b bg-gray-50">
                                        <button onClick={() => setActiveTab('teams')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab==='teams' ? TAB_active : TAB_inactive}`}><Shield size={16}/> Bestaande Teams</button>
                                        <button onClick={() => setActiveTab('players')} className={`flex-1 py-3 text-sm font-bold flex items-center justify-center gap-2 ${activeTab==='players' ? TAB_active : TAB_inactive}`}><UserPlus size={16}/> Nieuw / Random</button>
                                    </div>
                                ) : (
                                    <div className="p-3 bg-gray-50 border-b font-bold text-gray-700 flex items-center gap-2"><Users size={16}/> Klik op spelers om toe te voegen</div>
                                )}

                                <div className="flex-1 overflow-y-auto p-4 custom-scrollbar bg-white">
                                    {/* ... INHOUD VAN TABS (Doubles/Singles) ... */}
                                    {participationMode === 'doubles' && activeTab === 'teams' && (
                                        <div className="space-y-2">
                                            {globalTeams.map(team => {
                                                const disabled = team.players.some(p => isPlayerInCart(p.id));
                                                const alreadyIn = cart.some(c => c.teamId === team.id);
                                                return (
                                                    <div key={team.id} className={`flex justify-between items-center p-3 rounded border ${disabled ? 'opacity-50 bg-gray-50' : 'hover:border-blue-400 bg-white'}`}>
                                                        <div><div className="font-bold text-gray-800">{team.name}</div><div className="text-xs text-gray-500">{team.players.map(p => p.name).join(' & ')}</div></div>
                                                        <button onClick={() => addGlobalTeamToCart(team)} disabled={disabled} className={`p-2 rounded-full ${alreadyIn ? 'text-green-600' : 'bg-blue-100 text-blue-600'}`}>{alreadyIn ? <Save size={20}/> : <Plus size={20}/>}</button>
                                                    </div>
                                                )
                                            })}
                                        </div>
                                    )}

                                    {participationMode === 'doubles' && activeTab === 'players' && (
                                        <div className="space-y-6">
                                            <div className="bg-purple-50 p-4 rounded border border-purple-100">
                                                <h4 className="font-bold text-purple-800 text-sm mb-2 flex items-center gap-2"><Shuffle size={16}/> Random Vullling</h4>
                                                <button onClick={generateRandomTeams} className="w-full bg-white border border-purple-300 text-purple-700 font-bold py-2 rounded hover:bg-purple-100 text-sm">Genereer Random Teams</button>
                                            </div>
                                            <div>
                                                <h4 className="font-bold text-gray-700 text-sm mb-2">Handmatig Samenstellen</h4>
                                                <div className="flex gap-2 mb-2">
                                                    <input type="text" className={INPUT_STYLE} placeholder="Team naam" value={manualTeamName} onChange={e => setManualTeamName(e.target.value)} />
                                                    <button onClick={createAdHocTeam} disabled={manualSelection.length !== 2} className="bg-green-600 text-white px-4 rounded font-bold disabled:opacity-50"><Plus size={20}/></button>
                                                </div>
                                                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto">
                                                    {allPlayers.map(p => {
                                                        const taken = isPlayerInCart(p.id);
                                                        const selected = manualSelection.includes(p.id);
                                                        return <div key={p.id} onClick={() => toggleManualSelection(p.id)} className={`p-2 rounded border text-sm cursor-pointer truncate ${taken ? 'opacity-40' : selected ? 'bg-blue-100 border-blue-500 font-bold' : 'hover:bg-gray-50'}`}>{p.name}</div>
                                                    })}
                                                </div>
                                            </div>
                                        </div>
                                    )}

                                    {participationMode === 'singles' && (
                                        <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                                            {allPlayers.map(p => {
                                                const inCart = isPlayerInCart(p.id);
                                                return <div key={p.id} onClick={() => toggleSinglePlayerInCart(p)} className={`p-2 rounded border text-sm cursor-pointer flex justify-between ${inCart ? 'bg-green-50 border-green-500 font-bold' : 'hover:bg-gray-50'}`}><span className="truncate">{p.name}</span>{inCart && <div className="w-2 h-2 rounded-full bg-green-500 mt-1.5"></div>}</div>
                                            })}
                                        </div>
                                    )}
                                </div>
                            </div>
                        </div>

                        {/* WINKELMANDJE RECHTS */}
                        <div className="lg:col-span-5 flex flex-col h-[600px]">
                            <div className="bg-white rounded-lg shadow-xl border border-blue-100 flex-1 flex flex-col overflow-hidden">
                                <div className="bg-slate-800 text-white p-4 flex justify-between items-center">
                                    <h3 className="font-bold flex items-center gap-2"><Trophy size={18} className="text-yellow-400"/> Deelnemers</h3>
                                    <span className="bg-blue-600 px-3 py-1 rounded-full text-xs font-bold">{cart.length}</span>
                                </div>
                                <div className="flex-1 overflow-y-auto p-4 space-y-2 bg-gray-50">
                                    {cart.length === 0 && <div className="text-center text-gray-400 mt-20">Nog niemand geselecteerd.</div>}
                                    {cart.map(item => (
                                        <div key={item.id} className="bg-white p-2 rounded border flex justify-between items-center text-sm">
                                            <div><div className="font-bold text-gray-800">{item.name}{item.type === 'new_team' && <span className="text-[10px] bg-purple-100 text-purple-600 px-1 ml-2 rounded">NIEUW</span>}</div></div>
                                            <button onClick={() => removeFromCart(item.id)} className="text-gray-300 hover:text-red-500"><X size={18}/></button>
                                        </div>
                                    ))}
                                </div>
                                <div className="p-4 bg-white border-t border-gray-200 flex gap-2">
                                    <button onClick={() => setStep(1)} className="px-4 py-3 rounded-lg border text-gray-600 font-bold hover:bg-gray-50"><ArrowLeft size={20}/></button>
                                    <button onClick={() => setStep(3)} disabled={cart.length < 2} className="flex-1 bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 flex justify-center items-center gap-2 disabled:opacity-50">Naar Instellingen <ArrowRight size={20}/></button>
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {/* --- STEP 3: SETTINGS --- */}
                {step === 3 && (
                    <div className="grid grid-cols-1 lg:grid-cols-12 gap-6 animate-fade-in">
                        <div className="lg:col-span-8 space-y-6">
                            
                            {/* STATS CARD */}
                            <div className="bg-blue-50 border border-blue-100 p-4 rounded-lg flex flex-wrap gap-6 items-center">
                                <div><span className="block text-xs font-bold text-blue-400 uppercase">Deelnemers</span><span className="text-xl font-bold text-blue-900">{stats.total}</span></div>
                                <div><span className="block text-xs font-bold text-blue-400 uppercase">Spelers per Poule</span><span className="text-xl font-bold text-blue-900">~{stats.avgPerPoule}</span></div>
                                <div><span className="block text-xs font-bold text-blue-400 uppercase">Naar Knockout</span><span className="text-xl font-bold text-blue-900">{stats.totalQualifiers}</span></div>
                                <div className="ml-auto bg-white px-3 py-1 rounded shadow-sm"><span className="block text-xs font-bold text-gray-400 uppercase">Bracket Maat</span><span className="text-lg font-bold text-gray-700">Laatste {stats.bracketSize}</span></div>
                            </div>

                            {/* WARNING BORDEN */}
                            {selectedBoardIds.length < poules && (
                                <div className="bg-yellow-50 border border-yellow-200 text-yellow-800 p-4 rounded-lg flex items-start gap-3">
                                    <AlertTriangle className="shrink-0 mt-0.5" />
                                    <div>
                                        <p className="font-bold text-sm">Let op: Te weinig borden</p>
                                        <p className="text-xs mt-1">Je hebt {poules} poules, maar slechts {selectedBoardIds.length} borden geselecteerd. Het advies is minimaal 1 bord per poule.</p>
                                    </div>
                                </div>
                            )}

                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Algemeen</h3>
                                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                                    <div><label className={LABEL_STYLE}>Naam</label><input type="text" className={INPUT_STYLE} value={name} onChange={e => setName(e.target.value)} placeholder={defaultName} /></div>
                                    <div><label className={LABEL_STYLE}>Datum</label><input type="date" className={INPUT_STYLE} value={date} onChange={e => setDate(e.target.value)} /></div>
                                </div>
                            </div>

                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Format</h3>
                                <div className="space-y-4">
                                    <select className={INPUT_STYLE} value={format} onChange={e => setFormat(e.target.value)}>
                                        <option value="hybrid">Hybride (Poules + Knockout)</option>
                                        <option value="knockout">Direct Knockout</option>
                                        <option value="round_robin">Alleen Poules</option>
                                    </select>
                                    
                                    {format === 'hybrid' && (
                                        <div className="grid grid-cols-2 gap-4 bg-gray-50 p-4 rounded border">
                                            <div><label className={LABEL_STYLE}>Aantal Poules</label><input type="number" min="1" max={cart.length} className={INPUT_STYLE} value={poules} onChange={e => setPoules(parseInt(e.target.value))} /></div>
                                            <div><label className={LABEL_STYLE}>Qualifiers per Poule</label><input type="number" min="1" className={INPUT_STYLE} value={qualifiersPerPoule} onChange={e => setQualifiersPerPoule(parseInt(e.target.value))} /></div>
                                        </div>
                                    )}
                                    <div className="flex items-center gap-2 p-2 rounded hover:bg-gray-50 transition cursor-pointer" onClick={() => setAllowByes(!allowByes)}>
                                        <input type="checkbox" checked={allowByes} onChange={e => setAllowByes(e.target.checked)} className="w-4 h-4 cursor-pointer" />
                                        <span className="text-sm select-none">Sta <b>Byes</b> toe (Vrijloting) - <i>Iedereen gaat door naar KO</i></span>
                                    </div>
                                </div>
                            </div>
                        </div>

                        <div className="lg:col-span-4 space-y-6">
                            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                                <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">Wedstrijd Instellingen</h3>
                                <div className="grid grid-cols-2 gap-3 mb-4">
                                    <div><label className={LABEL_STYLE}>Poule (Best of)</label><input type="number" className={INPUT_STYLE} value={groupLegs} onChange={e => setGroupLegs(Number(e.target.value))}/></div>
                                    <div><label className={LABEL_STYLE}>KO (Best of)</label><input type="number" className={INPUT_STYLE} value={koLegs} onChange={e => setKoLegs(Number(e.target.value))}/></div>
                                </div>
                                <label className={LABEL_STYLE}>Borden ({selectedBoardIds.length})</label>
                                <div className="max-h-40 overflow-y-auto border rounded p-2 bg-gray-50">
                                    {allBoards.map(board => (
                                        <label key={board.id} className="flex items-center p-2 hover:bg-white rounded cursor-pointer">
                                            <input type="checkbox" className="mr-3" checked={selectedBoardIds.includes(board.id)} onChange={() => toggleBoard(board.id)} />
                                            <span className="text-sm">Bord {board.number}</span>
                                        </label>
                                    ))}
                                </div>
                            </div>
                            
                            <div className="flex gap-2">
                                <button onClick={() => setStep(2)} className="px-4 py-3 rounded-lg border text-gray-600 font-bold hover:bg-gray-50"><ArrowLeft size={20}/></button>
                                <button onClick={handleStartTournament} disabled={loading} className="flex-1 bg-green-600 text-white font-bold py-4 rounded-lg hover:bg-green-700 transition shadow-lg flex justify-center items-center gap-2 disabled:opacity-50">
                                    {loading ? "Bezig..." : "Start Toernooi"} <Trophy size={20}/>
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
        </AdminLayout>
    );
};
export default CreateTournament;