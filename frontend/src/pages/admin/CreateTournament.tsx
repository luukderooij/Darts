import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Player, Dartboard } from '../../types';
import { Trophy, AlertCircle, LayoutGrid, Users, Target, ArrowRight } from 'lucide-react';

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
  // Standaard naam logica:
  const defaultName = `Toernooi ${new Date().toLocaleDateString('nl-NL')}`;
  const [name, setName] = useState(defaultName);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Format settings
  const [format, setFormat] = useState('hybrid'); // Standaard Hybrid
  const [poules, setPoules] = useState(1);
  const [qualifiersPerPoule, setQualifiersPerPoule] = useState(2); // Nieuw
  
  // Match length settings (Best of X)
  const [groupLegs, setGroupLegs] = useState(3); // Best of 3
  const [koLegs, setKoLegs] = useState(5);       // Knockout vaak langer (bijv. 5)
  const [sets, setSets] = useState(1);
  
  const [error, setError] = useState<string | null>(null);

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

  // --- Submission ---
  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setError(null);

    // Validatie
    if (selectedBoardIds.length === 0) {
      setError("Selecteer minimaal 1 dartbord.");
      window.scrollTo(0,0);
      return;
    }

    // Minimaal aantal spelers check (globaal)
    const totalQualifiers = poules * qualifiersPerPoule;
    if (selectedPlayerIds.length < totalQualifiers) {
       // Waarschuwing als er minder spelers zijn dan plekken in de KO
       // (Technisch mag het, maar geeft rare byes in de poule fase)
    }

    try {
        // Naam fallback als de gebruiker het leeg heeft gemaakt
        const finalName = name.trim() === "" ? defaultName : name;

        const payload = {
            name: finalName,
            date,
            format,
            number_of_poules: poules,
            qualifiers_per_poule: qualifiersPerPoule,
            starting_legs_group: groupLegs, // Mapping naar backend veld
            starting_legs_ko: koLegs,       // Mapping naar backend veld
            sets_per_match: sets,
            player_ids: selectedPlayerIds,
            board_ids: selectedBoardIds
        };

        await api.post('/tournaments/', payload);
        navigate('/dashboard'); 
    } catch (err) {
      console.error(err);
      setError("Er is iets misgegaan bij het aanmaken.");
      window.scrollTo(0,0);
    }
  };

  return (
    <AdminLayout>
      <div className="max-w-6xl mx-auto pb-20">
        <h2 className="text-3xl font-bold text-gray-800 mb-6 flex items-center gap-2">
          <Trophy className="text-yellow-500" /> Nieuw Toernooi
        </h2>

        {error && (
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-2 border border-red-200">
            <AlertCircle size={20} /> <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* --- SETTINGS KOLOM --- */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* Basis Info */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-4 border-b pb-2">1. Algemeen</h3>
              <div className="space-y-4">
                <div>
                  <label className="label">Toernooinaam</label>
                  <input type="text" className="input-field" value={name} onChange={e => setName(e.target.value)} placeholder={defaultName} />
                </div>
                <div>
                   <label className="label">Datum</label>
                   <input type="date" required className="input-field" value={date} onChange={e => setDate(e.target.value)} />
                </div>
              </div>
            </div>

            {/* Spelformat */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-4 border-b pb-2 flex items-center gap-2">
                <LayoutGrid size={18} /> Format
              </h3>
              <div className="space-y-4">
                <div>
                   <label className="label">Toernooitype</label>
                   <select className="input-field" value={format} onChange={e => setFormat(e.target.value)}>
                     <option value="hybrid">Hybride (Poules + KO)</option>
                     <option value="knockout">Direct Knockout</option>
                     <option value="round_robin">Alleen Poules</option>
                   </select>
                </div>

                {format === 'hybrid' && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className="label">Aantal Poules</label>
                                <input type="number" min="1" max="16" className="input-field" 
                                value={poules} onChange={e => setPoules(parseInt(e.target.value))} />
                            </div>
                            <div>
                                <label className="label">Doorgaan per poule</label>
                                <input type="number" min="1" max="8" className="input-field" 
                                value={qualifiersPerPoule} onChange={e => setQualifiersPerPoule(parseInt(e.target.value))} />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1">
                            {poules * qualifiersPerPoule} spelers gaan door naar de Knockout fase.
                        </p>
                    </>
                )}
              </div>
            </div>

            {/* Wedstrijd Lengte */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
              <h3 className="font-bold text-gray-700 mb-4 border-b pb-2 flex items-center gap-2">
                <Target size={18} /> Wedstrijd Lengte
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className="label">Poules (Best of)</label>
                        <input type="number" min="1" className="input-field" 
                        value={groupLegs} onChange={e => setGroupLegs(Number(e.target.value))} />
                    </div>
                    <div>
                        <label className="label">Knockout (Best of)</label>
                        <input type="number" min="1" className="input-field" 
                        value={koLegs} onChange={e => setKoLegs(Number(e.target.value))} />
                    </div>
                </div>
                <p className="text-xs text-gray-400 italic">
                    Je kunt de lengte van de finale later handmatig aanpassen in het schema.
                </p>
              </div>
            </div>

            {/* Borden Selectie (Verkort weergegeven voor overzicht) */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-100">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-gray-700">2. Borden</h3>
                    <span className="badge-blue">{selectedBoardIds.length}</span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1">
                    {allBoards.map(board => (
                        <label key={board.id} className={`flex items-center p-2 rounded border cursor-pointer text-sm ${selectedBoardIds.includes(board.id) ? 'bg-blue-50 border-blue-500' : 'hover:bg-gray-50'}`}>
                            <input type="checkbox" className="mr-2" checked={selectedBoardIds.includes(board.id)} onChange={() => toggleBoard(board.id)} />
                            Bord {board.number}
                        </label>
                    ))}
                </div>
            </div>

          </div>

          {/* --- SPELERS KOLOM --- */}
          <div className="lg:col-span-8 flex flex-col h-full">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-100 flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4 border-b pb-2">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Users size={18} className="text-green-600"/> 3. Selecteer Spelers
                </h3>
                <span className={`text-xs px-3 py-1.5 rounded-full font-bold bg-green-100 text-green-700`}>
                  Geselecteerd: {selectedPlayerIds.length}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto pr-2 max-h-[600px]">
                {allPlayers.map(player => (
                  <label key={player.id} className={`flex items-center p-2 rounded border cursor-pointer select-none text-sm transition-all ${
                      selectedPlayerIds.includes(player.id) ? 'bg-green-50 border-green-500 shadow-sm' : 'hover:bg-gray-50 border-gray-200'
                    }`}>
                    <input type="checkbox" className="w-4 h-4 text-green-600 rounded accent-green-600"
                      checked={selectedPlayerIds.includes(player.id)}
                      onChange={() => togglePlayer(player.id)}
                    />
                    <div className="ml-2 font-medium text-gray-800 truncate">{player.name}</div>
                  </label>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t">
                 <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg flex justify-center items-center gap-2">
                  <Trophy size={20} /> Toernooi Aanmaken
                </button>
              </div>
            </div>
          </div>

        </form>
      </div>
    </AdminLayout>
  );
};

// Kleine CSS helper classes voor herbruikbaarheid
// (In een echt project zou je dit in index.css zetten of Tailwind @apply gebruiken)
const css = `
  .label { display: block; font-size: 0.75rem; font-weight: 700; color: #6b7280; text-transform: uppercase; margin-bottom: 0.25rem; }
  .input-field { width: 100%; border: 1px solid #e5e7eb; border-radius: 0.25rem; padding: 0.5rem; font-size: 0.875rem; }
  .badge-blue { font-size: 0.75rem; padding: 0.25rem 0.5rem; border-radius: 9999px; font-weight: 700; background-color: #dbeafe; color: #1d4ed8; }
`;

export default CreateTournament;