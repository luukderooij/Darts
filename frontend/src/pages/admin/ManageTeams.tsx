import { useEffect, useState } from 'react';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Player, Team } from '../../types';
import { Users, UserPlus, Trash2, Shield, AlertCircle, Edit, X, Search } from 'lucide-react';
import ImportExportActions from '../../components/admin/ImportExportActions';

const ManageTeams = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);
    const [importErrors, setImportErrors] = useState<string[]>([]);
    const [editingId, setEditingId] = useState<number | null>(null);
    const [searchQuery, setSearchQuery] = useState("");
    const [playerSearchQuery, setPlayerSearchQuery] = useState("");

    // Form State
    const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
    const [teamName, setTeamName] = useState("");

    useEffect(() => {
        loadData();
    }, []);

    const loadData = async () => {
        try {
            const [tRes, pRes] = await Promise.all([
                api.get('/teams/'),    // Haalt nu ALLE teams op
                api.get('/players/')
            ]);
            setTeams(tRes.data);
            setPlayers(pRes.data);
        } catch (err) {
            console.error(err);
        } finally {
            setLoading(false);
        }
    };

    const togglePlayer = (id: number) => {
        setSelectedPlayerIds(prev => {
            if (prev.includes(id)) return prev.filter(p => p !== id);
            if (prev.length >= 2) return prev; // Max 2
            return [...prev, id];
        });
    };

    const handleSubmit = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPlayerIds.length !== 2) return alert("Selecteer precies 2 spelers.");

        try {
            // We sturen GEEN tournament_id mee -> Global Team
            const payload = {
                player_ids: selectedPlayerIds,
                name: teamName.trim() === "" ? null : teamName
            };
            
            if (editingId) {
                await api.patch(`/teams/${editingId}`, payload);
            } else {
                await api.post('/teams/manual', payload);
            }
            
            // Reset & Reload
            setTeamName("");
            setSelectedPlayerIds([]);
            setEditingId(null);
            loadData();
        } catch (err: any) {
            console.error(err);
            alert("Kon team niet opslaan: " + (err.response?.data?.detail || err.message));
        }
    };

    const handleEdit = (team: Team) => {
        setEditingId(team.id);
        setTeamName(team.name);
        setSelectedPlayerIds(team.players.map(p => p.id));
    };

    const handleCancel = () => {
        setEditingId(null);
        setTeamName("");
        setSelectedPlayerIds([]);
    };

    const filteredTeams = teams.filter(team => 
        team.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        team.players.some(p => p.name.toLowerCase().includes(searchQuery.toLowerCase()))
    );

    const filteredPlayers = players.filter(p => 
        p.name.toLowerCase().includes(playerSearchQuery.toLowerCase())
    );

    // Optioneel: Delete functie (moet je backend endpoint voor hebben, anders weglaten)
    const handleDelete = async (id: number) => {
            if(!confirm("Weet je zeker dat je dit team wilt verwijderen?")) return;
            
            try {
                await api.delete(`/teams/${id}`);
                // Verwijder het team direct uit de lokale state (sneller dan herladen)
                setTeams(prev => prev.filter(t => t.id !== id));
            } catch (err) {
                console.error(err);
                alert("Kon team niet verwijderen. Mogelijk is dit team al gekoppeld aan wedstrijden.");
            }
        };

    return (
        <AdminLayout>
            <div className="max-w-6xl mx-auto pb-20">
                <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
                    <Shield className="text-blue-600" /> Manage Teams
                </h2>

                <div className="grid grid-cols-1 lg:grid-cols-2 gap-8">
                    
                    {/* LINKER KOLOM: TEAM MAKEN */}
                    <div className={`p-6 rounded-lg shadow-sm border h-fit transition-colors ${editingId ? 'bg-orange-50 border-orange-300' : 'bg-white border-gray-200'}`}>
                        <div className="flex justify-between items-center mb-4">
                            <h3 className={`font-bold flex items-center gap-2 ${editingId ? 'text-orange-800' : 'text-gray-700'}`}>
                                {editingId ? <Edit size={20}/> : <UserPlus size={20} className="text-green-600"/>} 
                                {editingId ? "Team Bewerken" : "Nieuw Team Maken"}
                            </h3>
                            {editingId && (
                                <button onClick={handleCancel} className="text-xs flex items-center gap-1 text-gray-500 hover:text-red-500 bg-white px-2 py-1 rounded border shadow-sm">
                                    <X size={14} /> Annuleren
                                </button>
                            )}
                        </div>

                        {!editingId && (
                            <ImportExportActions 
                                targetPath="teams" 
                                onSuccess={loadData} 
                                onResult={(res) => {
                                    if (res.errors && res.errors.length > 0) {
                                        setImportErrors(res.errors);
                                    } else {
                                        setImportErrors([]);
                                    }
                                }}
                            />
                        )}

                        {importErrors.length > 0 && (
                            <div className="mt-4 p-3 bg-amber-50 border border-amber-200 rounded-md">
                                <div className="flex items-center gap-2 text-amber-700 font-bold text-sm mb-2">
                                    <AlertCircle size={16} /> Overgeslagen regels:
                                </div>
                                <ul className="text-xs text-amber-600 list-disc list-inside space-y-1">
                                    {importErrors.map((err, i) => (
                                        <li key={i}>{err}</li>
                                    ))}
                                </ul>
                            </div>
                        )}

                        <form onSubmit={handleSubmit} className="mt-6">
                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Naam (Optioneel)</label>
                                <input 
                                    type="text" 
                                    className="w-full border border-gray-300 rounded-md p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                                    placeholder="Bijv. The Power Duo"
                                    value={teamName}
                                    onChange={e => setTeamName(e.target.value)}
                                />
                            </div>

                            <div className="mb-4">
                                <label className="block text-xs font-bold text-gray-500 uppercase mb-1">
                                    Selecteer 2 Spelers ({selectedPlayerIds.length}/2)
                                </label>
                                <div className="relative mb-2">
                                    <Search className="absolute left-2 top-1/2 transform -translate-y-1/2 text-gray-400" size={14} />
                                    <input 
                                        type="text" 
                                        placeholder="Zoek speler..." 
                                        className="w-full pl-8 pr-2 py-1 border border-gray-300 rounded text-sm focus:ring-1 focus:ring-blue-500 outline-none"
                                        value={playerSearchQuery}
                                        onChange={e => setPlayerSearchQuery(e.target.value)}
                                    />
                                </div>
                                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 border rounded p-2 bg-gray-50">
                                    {filteredPlayers.map(p => (
                                        <div 
                                            key={p.id} 
                                            onClick={() => togglePlayer(p.id)}
                                            className={`p-2 rounded border text-sm cursor-pointer select-none transition-colors ${
                                                selectedPlayerIds.includes(p.id) 
                                                ? 'bg-blue-100 border-blue-500 text-blue-700 font-bold' 
                                                : 'bg-white hover:bg-gray-100 border-gray-200'
                                            }`}
                                        >
                                            {p.name}
                                        </div>
                                    ))}
                                </div>
                            </div>

                            <button 
                                type="submit" 
                                disabled={selectedPlayerIds.length !== 2}
                                className={`w-full text-white font-bold py-2 rounded transition disabled:opacity-50 disabled:cursor-not-allowed ${editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'}`}
                            >
                                {editingId ? "Wijzigingen Opslaan" : "Team Opslaan"}
                            </button>
                        </form>
                    </div>

                    {/* RECHTER KOLOM: TEAM LIJST */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <Users size={20} className="text-purple-600"/> Bestaande Teams
                        </h3>
                        
                        <div className="relative mb-4">
                            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400" size={18} />
                            <input 
                                type="text" 
                                placeholder="Zoek team of speler..." 
                                className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-md text-sm focus:ring-2 focus:ring-purple-500 outline-none"
                                value={searchQuery}
                                onChange={e => setSearchQuery(e.target.value)}
                            />
                        </div>

                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                            {loading ? <p>Laden...</p> : filteredTeams.length === 0 ? (
                                <p className="text-gray-400 italic text-sm">{searchQuery ? "Geen teams gevonden." : "Nog geen teams aangemaakt."}</p>
                            ) : (
                                filteredTeams.map(team => (
                                    <div key={team.id} className={`flex items-center justify-between p-3 rounded border transition ${editingId === team.id ? 'bg-orange-100 border-orange-300' : 'bg-gray-50 border-gray-200 hover:shadow-sm'}`}>
                                        <div>
                                            <div className="font-bold text-gray-800">{team.name}</div>
                                            <div className="text-xs text-gray-500 flex gap-1 mt-1">
                                                {team.players.map(p => (
                                                    <span key={p.id} className="bg-white border px-1.5 py-0.5 rounded shadow-sm">
                                                        {p.name}
                                                    </span>
                                                ))}
                                            </div>
                                        </div>
                                        <div className="flex gap-1">
                                            <button className="p-2 text-gray-400 hover:text-blue-500 transition" onClick={() => handleEdit(team)} title="Bewerken">
                                                <Edit size={18} />
                                            </button>
                                            <button className="p-2 text-gray-400 hover:text-red-500 transition" onClick={() => handleDelete(team.id)} title="Verwijderen">
                                                <Trash2 size={18} />
                                            </button>
                                        </div>
                                    </div>
                                ))
                            )}
                        </div>
                    </div>

                </div>
            </div>
        </AdminLayout>
    );
};

export default ManageTeams;