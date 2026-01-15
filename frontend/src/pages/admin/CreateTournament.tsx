import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Player, Dartboard } from '../../types';
import { Trophy, AlertCircle, LayoutGrid, Users, Target } from 'lucide-react';

const CreateTournament = () => {
  const navigate = useNavigate();
  
  // --- Data State ---
  const [allPlayers, setAllPlayers] = useState<Player[]>([]);
  const [allBoards, setAllBoards] = useState<Dartboard[]>([]);
  const [loading, setLoading] = useState(true);
  
  // --- Selection State ---
  const [selectedPlayerIds, setSelectedPlayerIds] = useState<number[]>([]);
  const [selectedBoardIds, setSelectedBoardIds] = useState<number[]>([]);
  
  // --- Form State ---
  const [name, setName] = useState('');
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  const [poules, setPoules] = useState(1);
  const [format, setFormat] = useState('round_robin');
  const [legs, setLegs] = useState(5);
  const [sets, setSets] = useState(1);
  const [error, setError] = useState<string | null>(null);

  // --- Load Data on Mount ---
  useEffect(() => {
    const fetchData = async () => {
      try {
        const [pRes, bRes] = await Promise.all([
          api.get('/players/'),
          api.get('/dartboards/')
        ]);
        setAllPlayers(pRes.data);
        setAllBoards(bRes.data);
      } catch (err) {
        console.error("Failed to load data", err);
        setError("Failed to load players or boards. Is the backend running?");
      } finally {
        setLoading(false);
      }
    };
    fetchData();
  }, []);

  // --- Helpers ---
  const togglePlayer = (id: number) => {
    setSelectedPlayerIds(prev => 
      prev.includes(id) ? prev.filter(p => p !== id) : [...prev, id]
    );
  };

  const toggleBoard = (id: number) => {
    setSelectedBoardIds(prev => 
      prev.includes(id) ? prev.filter(b => b !== id) : [...prev, id]
    );
  };

  // --- Submission Handler ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // 1. Validate Boards
    if (selectedBoardIds.length === 0) {
      setError("You must select at least 1 dartboard.");
      window.scrollTo(0,0);
      return;
    }

    // 2. Validate Players (Rule: 2 players per board minimum)
    const requiredPlayers = selectedBoardIds.length * 2;
    if (selectedPlayerIds.length < requiredPlayers) {
      setError(`Not enough players! You selected ${selectedBoardIds.length} board(s), so you need at least ${requiredPlayers} players.`);
      window.scrollTo(0,0);
      return;
    }

    try {
      const payload = {
        name,
        date,
        number_of_poules: poules,
        format,
        legs_per_match: legs,
        sets_per_match: sets,
        player_ids: selectedPlayerIds,
        board_ids: selectedBoardIds
      };

      await api.post('/tournaments/', payload);
      navigate('/dashboard'); // Go back to dashboard on success
    } catch (err) {
      console.error(err);
      setError("Failed to create tournament. Please check the console for details.");
      window.scrollTo(0,0);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Trophy className="text-yellow-500" /> Create Tournament
        </h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-2 border border-red-200 animate-pulse">
            <AlertCircle size={20} />
            <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* --- COLUMN 1: Settings (Width: 4/12) --- */}
          <div className="lg:col-span-4 space-y-6">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">1. Settings</h3>
              
              <div className="space-y-4">
                <div>
                  <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Name</label>
                  <input type="text" required className="w-full border rounded p-2 text-sm" 
                    value={name} onChange={e => setName(e.target.value)} placeholder="e.g. Winter Cup 2026" />
                </div>
                
                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Date</label>
                    <input type="date" required className="w-full border rounded p-2 text-sm" 
                      value={date} onChange={e => setDate(e.target.value)} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1 flex items-center gap-1">
                      <LayoutGrid size={12} /> Poules
                    </label>
                    <input type="number" min="1" max="16" required className="w-full border rounded p-2 text-sm" 
                      value={poules} onChange={e => setPoules(parseInt(e.target.value))} />
                  </div>
                </div>

                <div>
                   <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Format</label>
                   <select className="w-full border rounded p-2 text-sm" value={format} onChange={e => setFormat(e.target.value)}>
                     <option value="round_robin">Round Robin (League)</option>
                     <option value="knockout">Knockout (Bracket)</option>
                   </select>
                </div>

                <div className="grid grid-cols-2 gap-3">
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Legs</label>
                    <input type="number" min="1" className="w-full border rounded p-2 text-sm" 
                      value={legs} onChange={e => setLegs(Number(e.target.value))} />
                  </div>
                  <div>
                    <label className="block text-xs font-bold text-gray-500 uppercase mb-1">Sets</label>
                    <input type="number" min="1" className="w-full border rounded p-2 text-sm" 
                      value={sets} onChange={e => setSets(Number(e.target.value))} />
                  </div>
                </div>
              </div>
            </div>

            {/* --- Board Selection --- */}
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Target size={18} className="text-blue-600"/> 2. Boards
                </h3>
                <span className={`text-xs px-2 py-1 rounded-full font-bold ${selectedBoardIds.length > 0 ? 'bg-blue-100 text-blue-700' : 'bg-gray-100 text-gray-500'}`}>
                  {selectedBoardIds.length} Selected
                </span>
              </div>
              
              <div className="space-y-2 max-h-48 overflow-y-auto pr-1">
                {loading ? <p className="text-sm text-gray-400">Loading...</p> : allBoards.map(board => (
                  <label key={board.id} className={`flex items-center p-2 rounded border cursor-pointer transition-colors text-sm ${selectedBoardIds.includes(board.id) ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'}`}>
                    <input type="checkbox" className="w-4 h-4 text-blue-600 rounded mr-3"
                      checked={selectedBoardIds.includes(board.id)}
                      onChange={() => toggleBoard(board.id)}
                    />
                    <span className="font-medium text-gray-700">Board {board.number}: {board.name}</span>
                  </label>
                ))}
                {allBoards.length === 0 && !loading && (
                   <p className="text-xs text-red-500">No boards found. Add them in "Manage Boards".</p>
                )}
              </div>
            </div>
          </div>

          {/* --- COLUMN 2: Player Selection (Width: 8/12) --- */}
          <div className="lg:col-span-8 flex flex-col h-full">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Users size={18} className="text-green-600"/> 3. Select Players
                </h3>
                
                {/* Dynamic Counter & Status */}
                <div className={`text-xs px-3 py-1.5 rounded-full font-bold flex items-center gap-2 transition-colors
                  ${selectedPlayerIds.length >= selectedBoardIds.length * 2 && selectedBoardIds.length > 0
                    ? 'bg-green-100 text-green-700 border border-green-200' 
                    : 'bg-red-50 text-red-600 border border-red-200'
                  }`}>
                  <span>Selected: {selectedPlayerIds.length}</span>
                  <span className="w-px h-3 bg-current opacity-30 mx-1"></span>
                  <span>Needed: {selectedBoardIds.length > 0 ? selectedBoardIds.length * 2 : '0'}</span>
                </div>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto pr-2 max-h-[600px]">
                {loading ? <p className="text-sm text-gray-400 col-span-3 text-center py-10">Loading players...</p> : allPlayers.map(player => (
                  <label key={player.id} className={`flex items-center p-2 rounded border cursor-pointer select-none text-sm transition-all ${
                      selectedPlayerIds.includes(player.id) 
                      ? 'bg-green-50 border-green-500 shadow-sm' 
                      : 'hover:bg-gray-50 border-gray-200'
                    }`}>
                    <input type="checkbox" className="w-4 h-4 text-green-600 rounded accent-green-600"
                      checked={selectedPlayerIds.includes(player.id)}
                      onChange={() => togglePlayer(player.id)}
                    />
                    <div className="ml-2 overflow-hidden">
                      <div className="font-medium text-gray-800 truncate">{player.name}</div>
                    </div>
                  </label>
                ))}
              </div>

              {/* Submit Button Area */}
              <div className="mt-6 pt-4 border-t">
                 <button 
                  type="submit" 
                  disabled={loading}
                  className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg disabled:opacity-50 disabled:cursor-not-allowed flex justify-center items-center gap-2"
                >
                  <Trophy size={20} />
                  Create Tournament
                </button>
              </div>
            </div>
          </div>

        </form>
      </div>
    </AdminLayout>
  );
};

export default CreateTournament;