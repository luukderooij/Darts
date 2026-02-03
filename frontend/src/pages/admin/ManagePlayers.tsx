import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Trash2, UserPlus, Edit, X } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Player } from '../../types';
import ImportExportActions from '../../components/admin/ImportExportActions';

const ManagePlayers = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  const [editingId, setEditingId] = useState<number | null>(null); // Houdt bij wie we bewerken
  
  // State for the 4 input fields
  const [formData, setFormData] = useState({
    first_name: '',
    last_name: '',
    nickname: '',
    email: ''
  });

  // Load players when page opens
  useEffect(() => {
    loadPlayers();
  }, []);

  const loadPlayers = async () => {
    try {
      const response = await api.get('/players/');
      setPlayers(response.data);
    } catch (error) {
      console.error("Failed to load players");
    } finally {
      setLoading(false);
    }
  };

  const handleEditClick = (player: Player) => {
    setEditingId(player.id);
    setFormData({
        first_name: player.first_name,
        // Zorg dat null waarden lege strings worden voor de inputs
        last_name: player.last_name || '',
        nickname: player.nickname || '',
        email: player.email || ''
    });
  };

  // Reset het formulier en stopt de edit-modus
  const handleCancelEdit = () => {
    setEditingId(null);
    setFormData({
        first_name: '',
        last_name: '',
        nickname: '',
        email: ''
    });
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Data voorbereiden (lege strings naar null converteren)
    const payload = {
        first_name: formData.first_name,
        last_name: formData.last_name.trim() === '' ? null : formData.last_name,
        nickname: formData.nickname.trim() === '' ? null : formData.nickname,
        email: formData.email.trim() === '' ? null : formData.email
    };

    try {
        if (editingId) {
            // --- UPDATE LOGICA ---
            await api.patch(`/players/${editingId}`, payload);
            alert("Speler succesvol bijgewerkt!");
            setEditingId(null); // Edit modus afsluiten
        } else {
            // --- AANMAAK LOGICA ---
            await api.post('/players/', payload);
            // alert("Speler toegevoegd!"); // Optioneel
        }

        // Formulier resetten
        setFormData({
            first_name: '',
            last_name: '',
            nickname: '',
            email: ''
        });
        
        // Lijst verversen
        loadPlayers();

    } catch (error: any) {
        console.error("Error saving player:", error.response?.data);
        alert("Fout bij opslaan. Controleer de invoer.");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure you want to delete this player?")) return;
    try {
      await api.delete(`/players/${id}`);
      loadPlayers();
    } catch (error) {
      alert("Error deleting player");
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-800 mb-8">Manage Players</h2>

        {/* --- Add/Edit Player Form --- */}
        <div className={`p-6 rounded-lg shadow-sm mb-8 border-l-4 transition-colors ${editingId ? 'bg-orange-50 border-orange-500' : 'bg-white border-blue-500'}`}>
          
          {/* Dynamische Header */}
          <div className="flex justify-between items-center mb-4">
            <h3 className={`text-lg font-semibold ${editingId ? 'text-orange-700' : 'text-gray-700'}`}>
                {editingId ? "Edit Player" : "Add New Player"}
            </h3>
            {editingId && (
                <button 
                    onClick={handleCancelEdit}
                    className="text-xs flex items-center gap-1 text-gray-500 hover:text-red-500 bg-white px-2 py-1 rounded border shadow-sm"
                >
                    <X size={14} /> Cancel Edit
                </button>
            )}
          </div>
          
          {/* Import knop verbergen als we aan het editen zijn om verwarring te voorkomen */}
          {!editingId && <ImportExportActions targetPath="players" onSuccess={loadPlayers} />}
          
          <form onSubmit={handleSubmit} className="space-y-4 mt-4">
            
            {/* Row 1: First & Last Name */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">First Name*</label>
                <input 
                  type="text" 
                  required
                  className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.first_name}
                  onChange={(e) => setFormData({...formData, first_name: e.target.value})}
                  placeholder="Luke"
                />
              </div>
              
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Last Name</label>
                <input 
                  type="text" 
                  className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.last_name}
                  onChange={(e) => setFormData({...formData, last_name: e.target.value})}
                  placeholder="Littler"
                />
              </div>
            </div>

            {/* Row 2: Nickname & Email */}
            <div className="grid grid-cols-2 gap-4">
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Nickname</label>
                <input 
                  type="text" 
                  className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.nickname}
                  onChange={(e) => setFormData({...formData, nickname: e.target.value})}
                  placeholder='e.g. "The Nuke"'
                />
              </div>
              <div>
                <label className="block text-xs font-bold text-gray-700 mb-1">Email</label>
                <input 
                  type="email" 
                  className="w-full border rounded p-2 text-sm focus:ring-2 focus:ring-blue-500 outline-none"
                  value={formData.email}
                  onChange={(e) => setFormData({...formData, email: e.target.value})}
                  placeholder="luke@darts.com"
                />
              </div>
            </div>

            <button
              type="submit"
              className={`w-full text-white px-6 py-2 rounded-lg flex items-center justify-center gap-2 font-medium mt-4 transition-colors shadow-sm ${
                editingId ? 'bg-orange-500 hover:bg-orange-600' : 'bg-blue-600 hover:bg-blue-700'
              }`}
            >
              {editingId ? <Edit size={20} /> : <UserPlus size={20} />}
              {editingId ? "Update Player" : "Add Player"}
            </button>
          </form>
        </div>

        {/* --- Players List --- */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50 font-medium text-gray-500 flex justify-between items-center">
            <span>Total Players: {players.length}</span>
          </div>
          
          {loading ? (
             <div className="p-8 text-center text-gray-500">Loading players...</div>
          ) : players.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No players found. Add one above!</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {players.map((player) => (
                <li key={player.id} className={`p-4 flex items-center justify-between transition ${editingId === player.id ? 'bg-orange-50' : 'hover:bg-gray-50'}`}>
                  <div>
                    {/* The 'name' property comes formatted from the backend (e.g. Luke "The Nuke" Littler) */}
                    <div className="text-lg text-gray-800 font-medium">{player.name}</div>
                    
                    <div className="text-xs text-gray-400">
                       {player.email ? player.email : "No email linked"}
                    </div>
                  </div>
                  
                  <div className="flex items-center gap-2">
                    {/* EDIT BUTTON */}
                    <button
                        onClick={() => handleEditClick(player)}
                        className="text-gray-400 hover:text-blue-600 p-2 rounded-full hover:bg-blue-50 transition"
                        title="Edit Player"
                    >
                        <Edit size={20} />
                    </button>

                    {/* DELETE BUTTON */}
                    <button
                        onClick={() => handleDelete(player.id)}
                        className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                        title="Delete Player"
                    >
                        <Trash2 size={20} />
                    </button>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </div>
      </div>
    </AdminLayout>
  );
};

export default ManagePlayers;