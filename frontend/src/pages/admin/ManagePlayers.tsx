import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Trash2, UserPlus } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';
import { Player } from '../../types';
import ImportExportActions from '../../components/admin/ImportExportActions';

const ManagePlayers = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);
  
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

  const handleAddPlayer = async (e: React.FormEvent) => {
    e.preventDefault();
    
    // DATA CLEANING:
    // We must convert empty strings "" to null, otherwise the backend
    // will think we are sending an invalid email address.
    const payload = {
      first_name: formData.first_name,
      last_name: formData.last_name.trim() === '' ? null : formData.last_name,
      nickname: formData.nickname.trim() === '' ? null : formData.nickname,
      email: formData.email.trim() === '' ? null : formData.email
    };

    try {
      await api.post('/players/', payload);
      
      // Clear the form
      setFormData({
        first_name: '',
        last_name: '',
        nickname: '',
        email: ''
      });
      
      // Refresh the list
      loadPlayers(); 
    } catch (error: any) {
      console.error("Error adding player:", error.response?.data);
      alert("Error adding player. Please check that the email is valid (or leave it empty).");
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

        {/* --- Add Player Form --- */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <h3 className="text-lg font-semibold mb-4 text-gray-700">Add New Player</h3>
          
          <ImportExportActions targetPath="players" onSuccess={loadPlayers} />
          
          <form onSubmit={handleAddPlayer} className="space-y-4">
            
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
              className="w-full bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center justify-center gap-2 font-medium mt-4 transition-colors"
            >
              <UserPlus size={20} />
              Add Player
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
                <li key={player.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <div>
                    {/* The 'name' property comes formatted from the backend (e.g. Luke "The Nuke" Littler) */}
                    <div className="text-lg text-gray-800 font-medium">{player.name}</div>
                    
                    <div className="text-xs text-gray-400">
                       {player.email ? player.email : "No email linked"}
                    </div>
                  </div>
                  
                  <button
                    onClick={() => handleDelete(player.id)}
                    className="text-gray-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
                    title="Delete Player"
                  >
                    <Trash2 size={20} />
                  </button>
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