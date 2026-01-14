import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Trophy, Users, CheckCircle } from 'lucide-react';

interface Player {
  id: number;
  name: string;
}

const CreateTournament = () => {
  const navigate = useNavigate();
  
  // Form State
  const [name, setName] = useState('');
  const [format, setFormat] = useState('round_robin');
  const [legs, setLegs] = useState(5);
  const [sets, setSets] = useState(1);
  const [selectedPlayers, setSelectedPlayers] = useState<number[]>([]);
  
  // Data State
  const [availablePlayers, setAvailablePlayers] = useState<Player[]>([]);
  const [loading, setLoading] = useState(true);

  // Load players on mount
  useEffect(() => {
    const fetchPlayers = async () => {
      try {
        const res = await api.get('/players/');
        setAvailablePlayers(res.data);
      } catch (err) {
        console.error("Failed to load players");
      } finally {
        setLoading(false);
      }
    };
    fetchPlayers();
  }, []);

  const togglePlayer = (id: number) => {
    setSelectedPlayers(prev => 
      prev.includes(id) 
        ? prev.filter(p => p !== id) 
        : [...prev, id]
    );
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (selectedPlayers.length < 2) {
      alert("Please select at least 2 players!");
      return;
    }

    try {
      const payload = {
        name,
        format,
        legs_per_match: legs,
        sets_per_match: sets,
        player_ids: selectedPlayers
      };
      
      // The backend returns the created tournament object
      const response = await api.post('/tournaments/', payload);
      
      // Redirect to the "Public View" of the tournament (for now)
      // We will build a dedicated Admin Tournament Dashboard later
      const publicLink = response.data.public_uuid;
      navigate(`/t/${publicLink}`);
      
    } catch (error) {
      console.error(error);
      alert("Failed to create tournament.");
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-4xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-800 mb-2 flex items-center gap-3">
          <Trophy className="text-yellow-500" />
          Create Tournament
        </h2>
        <p className="text-gray-500 mb-8">Setup your bracket and rules.</p>

        <form onSubmit={handleSubmit} className="grid grid-cols-1 md:grid-cols-3 gap-8">
          
          {/* Left Column: Settings */}
          <div className="md:col-span-1 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm">
              <h3 className="font-bold text-gray-700 mb-4">Settings</h3>
              
              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-1">Tournament Name</label>
                <input
                  type="text"
                  required
                  className="w-full border rounded-md p-2"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="e.g. Friday Night Darts"
                />
              </div>

              <div className="mb-4">
                <label className="block text-sm font-medium text-gray-600 mb-1">Format</label>
                <select 
                  className="w-full border rounded-md p-2"
                  value={format}
                  onChange={(e) => setFormat(e.target.value)}
                >
                  <option value="round_robin">Round Robin (League)</option>
                  <option value="knockout">Knockout (Bracket)</option>
                </select>
              </div>

              <div className="grid grid-cols-2 gap-2">
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Legs</label>
                  <input type="number" min="1" className="w-full border rounded-md p-2" value={legs} onChange={e => setLegs(Number(e.target.value))} />
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-600 mb-1">Sets</label>
                  <input type="number" min="1" className="w-full border rounded-md p-2" value={sets} onChange={e => setSets(Number(e.target.value))} />
                </div>
              </div>
            </div>
            
            <button 
              type="submit" 
              className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg"
            >
              Generate Bracket
            </button>
          </div>

          {/* Right Column: Player Selection */}
          <div className="md:col-span-2 bg-white p-6 rounded-lg shadow-sm">
            <div className="flex justify-between items-center mb-4">
              <h3 className="font-bold text-gray-700 flex items-center gap-2">
                <Users size={20} />
                Select Players
              </h3>
              <span className="text-sm text-blue-600 font-medium">
                {selectedPlayers.length} selected
              </span>
            </div>

            {loading ? (
              <p>Loading players...</p>
            ) : (
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 max-h-96 overflow-y-auto">
                {availablePlayers.map(player => {
                  const isSelected = selectedPlayers.includes(player.id);
                  return (
                    <div 
                      key={player.id}
                      onClick={() => togglePlayer(player.id)}
                      className={`cursor-pointer border rounded-lg p-3 flex items-center justify-between transition-all ${
                        isSelected 
                          ? 'border-blue-500 bg-blue-50 text-blue-700' 
                          : 'border-gray-200 hover:border-blue-300'
                      }`}
                    >
                      <span className="font-medium">{player.name}</span>
                      {isSelected && <CheckCircle size={18} className="text-blue-500" />}
                    </div>
                  );
                })}
              </div>
            )}
            
            {availablePlayers.length === 0 && !loading && (
              <p className="text-red-500 text-sm mt-4">
                You have no players! Go to "Manage Players" first.
              </p>
            )}
          </div>

        </form>
      </div>
    </AdminLayout>
  );
};

export default CreateTournament;