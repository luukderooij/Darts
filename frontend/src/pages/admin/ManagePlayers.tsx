import { useEffect, useState } from 'react';
import api from '../../services/api';
import { Trash2, UserPlus } from 'lucide-react';
import AdminLayout from '../../components/layout/AdminLayout';

interface Player {
  id: number;
  name: string;
}

const ManagePlayers = () => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [newName, setNewName] = useState('');
  const [loading, setLoading] = useState(true);

  // Fetch players on load
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
    if (!newName.trim()) return;

    try {
      await api.post('/players/', { name: newName });
      setNewName('');
      loadPlayers(); // Refresh list
    } catch (error) {
      alert("Error adding player");
    }
  };

  const handleDelete = async (id: number) => {
    if (!confirm("Are you sure?")) return;
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

        {/* Add Player Form */}
        <div className="bg-white p-6 rounded-lg shadow-sm mb-8">
          <form onSubmit={handleAddPlayer} className="flex gap-4">
            <input
              type="text"
              placeholder="Enter player name (e.g. Michael van Gerwen)"
              className="flex-1 px-4 py-2 border rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
            />
            <button
              type="submit"
              className="bg-blue-600 text-white px-6 py-2 rounded-lg hover:bg-blue-700 flex items-center gap-2 font-medium"
            >
              <UserPlus size={20} />
              Add Player
            </button>
          </form>
        </div>

        {/* Players List */}
        <div className="bg-white rounded-lg shadow-sm overflow-hidden">
          <div className="p-4 border-b bg-gray-50 font-medium text-gray-500">
            Total Players: {players.length}
          </div>
          
          {loading ? (
             <div className="p-8 text-center text-gray-500">Loading...</div>
          ) : players.length === 0 ? (
            <div className="p-8 text-center text-gray-500">No players added yet.</div>
          ) : (
            <ul className="divide-y divide-gray-100">
              {players.map((player) => (
                <li key={player.id} className="p-4 flex items-center justify-between hover:bg-gray-50 transition">
                  <span className="text-lg text-gray-800">{player.name}</span>
                  <button
                    onClick={() => handleDelete(player.id)}
                    className="text-red-400 hover:text-red-600 p-2 rounded-full hover:bg-red-50 transition"
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