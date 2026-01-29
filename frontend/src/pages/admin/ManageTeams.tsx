import { useEffect, useState } from 'react';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Player, Team } from '../../types';
import { Users, UserPlus, Trash2, Shield } from 'lucide-react';

const ManageTeams = () => {
    const [teams, setTeams] = useState<Team[]>([]);
    const [players, setPlayers] = useState<Player[]>([]);
    const [loading, setLoading] = useState(true);

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

    const handleCreate = async (e: React.FormEvent) => {
        e.preventDefault();
        if (selectedPlayerIds.length !== 2) return alert("Selecteer precies 2 spelers.");

        try {
            // We sturen GEEN tournament_id mee -> Global Team
            const payload = {
                player_ids: selectedPlayerIds,
                name: teamName.trim() === "" ? null : teamName
            };
            
            await api.post('/teams/manual', payload);
            
            // Reset & Reload
            setTeamName("");
            setSelectedPlayerIds([]);
            loadData();
        } catch (err) {
            alert("Kon team niet maken.");
        }
    };

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
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 h-fit">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <UserPlus size={20} className="text-green-600"/> Nieuw Team Maken
                        </h3>
                        
                        <form onSubmit={handleCreate}>
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
                                <div className="grid grid-cols-2 gap-2 max-h-60 overflow-y-auto pr-1 border rounded p-2 bg-gray-50">
                                    {players.map(p => (
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
                                className="w-full bg-blue-600 text-white font-bold py-2 rounded hover:bg-blue-700 transition disabled:opacity-50 disabled:cursor-not-allowed"
                            >
                                Team Opslaan
                            </button>
                        </form>
                    </div>

                    {/* RECHTER KOLOM: TEAM LIJST */}
                    <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200">
                        <h3 className="font-bold text-gray-700 mb-4 flex items-center gap-2">
                            <Users size={20} className="text-purple-600"/> Bestaande Teams
                        </h3>
                        
                        <div className="space-y-3 max-h-[600px] overflow-y-auto pr-2">
                            {loading ? <p>Laden...</p> : teams.length === 0 ? (
                                <p className="text-gray-400 italic text-sm">Nog geen teams aangemaakt.</p>
                            ) : (
                                teams.map(team => (
                                    <div key={team.id} className="flex items-center justify-between p-3 bg-gray-50 rounded border border-gray-200 hover:shadow-sm transition">
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
                                        {/* Placeholder voor delete knop */}
                                        <button className="text-gray-300 hover:text-red-500 transition" onClick={() => handleDelete(team.id)}>
                                            <Trash2 size={18} />
                                        </button>
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