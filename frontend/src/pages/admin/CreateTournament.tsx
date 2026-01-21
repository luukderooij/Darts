import { useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import api from '../../services/api';
import AdminLayout from '../../components/layout/AdminLayout';
import { Player, Dartboard } from '../../types';
import { Trophy, AlertCircle, LayoutGrid, Users, Target, Scissors } from 'lucide-react'; // Scissors toegevoegd voor icoon

// --- STYLING CONSTANTEN ---
const LABEL_STYLE = "block text-xs font-bold text-gray-500 uppercase mb-1";
const INPUT_STYLE = "w-full border border-gray-300 rounded-md p-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent transition-all shadow-sm";

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
  const defaultName = `Toernooi ${new Date().toLocaleDateString('nl-NL')}`;
  const [name, setName] = useState(defaultName);
  const [date, setDate] = useState(new Date().toISOString().split('T')[0]);
  
  // Format settings
  const [format, setFormat] = useState('hybrid');
  const [poules, setPoules] = useState(1);
  const [qualifiersPerPoule, setQualifiersPerPoule] = useState(2);
  const [allowByes, setAllowByes] = useState(true); // <--- NIEUWE STATE
  
  // Match length settings
  const [groupLegs, setGroupLegs] = useState(3);
  const [koLegs, setKoLegs] = useState(5);
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

    if (selectedBoardIds.length === 0) {
      setError("Selecteer minimaal 1 dartbord.");
      window.scrollTo(0,0);
      return;
    }

    const totalQualifiers = poules * qualifiersPerPoule;
    if (selectedPlayerIds.length < totalQualifiers) {
       setError(`Je wilt ${totalQualifiers} spelers laten doorgaan, maar je hebt er maar ${selectedPlayerIds.length} geselecteerd.`);
       window.scrollTo(0,0);
       return;
    }

    if (poules > 0) {
        const playersPerPoule = Math.ceil(selectedPlayerIds.length / poules);
        if (playersPerPoule > 7) {
            if (!confirm(`Let op: Je hebt gemiddeld ${playersPerPoule} spelers per poule. Dit zorgt voor erg veel wedstrijden. We raden maximaal 7 aan. Wil je doorgaan?`)) {
                return;
            }
        }
    }

    try {
        const finalName = name.trim() === "" ? defaultName : name;

        const payload = {
            name: finalName,
            date,
            format,
            allow_byes: allowByes, // <--- MEEGEVEN AAN BACKEND
            number_of_poules: poules,
            qualifiers_per_poule: qualifiersPerPoule,
            starting_legs_group: groupLegs,
            starting_legs_ko: koLegs,
            sets_per_match: sets,
            player_ids: selectedPlayerIds,
            board_ids: selectedBoardIds
        };

        await api.post('/tournaments/', payload);
        navigate('/dashboard'); 
    } catch (err: any) {
      console.error(err);
      if (err.response && err.response.data && err.response.data.detail) {
        setError(err.response.data.detail);
      } else {
        setError("Er is iets misgegaan bij het aanmaken.");
      }
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
          <div className="bg-red-50 text-red-600 p-4 rounded-lg mb-6 flex items-center gap-2 border border-red-200 shadow-sm">
            <AlertCircle size={20} /> <span className="font-medium">{error}</span>
          </div>
        )}

        <form onSubmit={handleSubmit} className="grid grid-cols-1 lg:grid-cols-12 gap-6">
          
          {/* --- SETTINGS KOLOM (LINKS) --- */}
          <div className="lg:col-span-4 space-y-6">
            
            {/* 1. Algemeen */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2">1. Algemeen</h3>
              <div className="space-y-4">
                <div>
                  <label className={LABEL_STYLE}>Toernooinaam</label>
                  <input 
                    type="text" 
                    className={INPUT_STYLE} 
                    value={name} 
                    onChange={e => setName(e.target.value)} 
                    placeholder={defaultName} 
                  />
                </div>
                <div>
                   <label className={LABEL_STYLE}>Datum</label>
                   <input 
                    type="date" 
                    required 
                    className={INPUT_STYLE} 
                    value={date} 
                    onChange={e => setDate(e.target.value)} 
                   />
                </div>
              </div>
            </div>

            {/* 2. Spelformat */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
                <LayoutGrid size={18} className="text-blue-500" /> Format
              </h3>
              <div className="space-y-4">
                <div>
                   <label className={LABEL_STYLE}>Toernooitype</label>
                   <select className={INPUT_STYLE} value={format} onChange={e => setFormat(e.target.value)}>
                      <option value="hybrid">Hybride (Poules + KO)</option>
                      <option value="knockout">Direct Knockout</option>
                      <option value="round_robin">Alleen Poules</option>
                   </select>
                </div>

                {/* NIEUW: BYES CHECKBOX */}
                <div className="flex items-start gap-2 p-2 bg-gray-50 rounded border border-gray-100">
                    <div className="mt-0.5">
                        <input 
                            type="checkbox" 
                            id="allowByes"
                            className="w-4 h-4 text-blue-600 rounded accent-blue-600"
                            checked={allowByes}
                            onChange={e => setAllowByes(e.target.checked)}
                        />
                    </div>
                    <div>
                        <label htmlFor="allowByes" className="text-sm font-bold text-gray-700 cursor-pointer select-none">
                            Sta Byes (Vrijlotingen) toe
                        </label>
                        <p className="text-xs text-gray-500 mt-0.5 leading-tight">
                            {allowByes 
                                ? "Oneven aantal qualifiers krijgen een vrije ronde."
                                : "Alleen de beste 2, 4, 8, 16... gaan door. De rest valt af."
                            }
                        </p>
                    </div>
                </div>

                {format === 'hybrid' && (
                    <>
                        <div className="grid grid-cols-2 gap-3">
                            <div>
                                <label className={LABEL_STYLE}>Aantal Poules</label>
                                <input 
                                  type="number" min="1" max="16" 
                                  className={INPUT_STYLE} 
                                  value={poules} onChange={e => setPoules(parseInt(e.target.value))} 
                                />
                            </div>
                            <div>
                                <label className={LABEL_STYLE}>Doorgaan per poule</label>
                                <input 
                                  type="number" min="1" 
                                  className={INPUT_STYLE} 
                                  value={qualifiersPerPoule} onChange={e => setQualifiersPerPoule(parseInt(e.target.value))} 
                                />
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 mt-1 bg-blue-50 p-2 rounded text-center">
                            Totaal <strong>{poules * qualifiersPerPoule}</strong> qualifiers.<br/>
                            {!allowByes && (poules * qualifiersPerPoule) & (poules * qualifiersPerPoule - 1) ? (
                                <span className="text-red-500 font-bold flex items-center justify-center gap-1 mt-1">
                                    <Scissors size={12} />
                                    Wordt afgesneden naar: {Math.pow(2, Math.floor(Math.log2(poules * qualifiersPerPoule)))}
                                </span>
                            ) : null}
                        </p>
                    </>
                )}
              </div>
            </div>

            {/* 3. Wedstrijd Lengte */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
              <h3 className="font-bold text-gray-700 mb-4 border-b border-gray-100 pb-2 flex items-center gap-2">
                <Target size={18} className="text-red-500" /> Wedstrijd Lengte
              </h3>
              <div className="space-y-4">
                <div className="grid grid-cols-2 gap-3">
                    <div>
                        <label className={LABEL_STYLE}>Poules (Best of)</label>
                        <input 
                          type="number" min="1" 
                          className={INPUT_STYLE} 
                          value={groupLegs} onChange={e => setGroupLegs(Number(e.target.value))} 
                        />
                    </div>
                    <div>
                        <label className={LABEL_STYLE}>Knockout (Best of)</label>
                        <input 
                          type="number" min="1" 
                          className={INPUT_STYLE} 
                          value={koLegs} onChange={e => setKoLegs(Number(e.target.value))} 
                        />
                    </div>
                </div>
                <p className="text-xs text-gray-400 italic">
                    Je kunt de lengte van de finale later handmatig aanpassen in het schema.
                </p>
              </div>
            </div>

            {/* 4. Borden Selectie */}
            <div className="bg-white p-5 rounded-lg shadow-sm border border-gray-200">
                <div className="flex justify-between items-center mb-2">
                    <h3 className="font-bold text-gray-700">2. Borden</h3>
                    <span className="bg-blue-100 text-blue-700 text-xs font-bold px-2 py-1 rounded-full">
                      {selectedBoardIds.length}
                    </span>
                </div>
                <div className="max-h-32 overflow-y-auto space-y-1 pr-1 custom-scrollbar">
                    {allBoards.map(board => (
                        <label key={board.id} className={`flex items-center p-2 rounded border cursor-pointer text-sm transition-colors ${
                          selectedBoardIds.includes(board.id) ? 'bg-blue-50 border-blue-500 text-blue-700 font-medium' : 'hover:bg-gray-50 border-gray-200'
                        }`}>
                            <input type="checkbox" className="mr-2 accent-blue-600" checked={selectedBoardIds.includes(board.id)} onChange={() => toggleBoard(board.id)} />
                            Bord {board.number} <span className='text-gray-400 ml-2 text-xs'>({board.name})</span>
                        </label>
                    ))}
                </div>
            </div>

          </div>

          {/* --- SPELERS KOLOM (RECHTS) --- */}
          <div className="lg:col-span-8 flex flex-col h-full">
            <div className="bg-white p-6 rounded-lg shadow-sm border border-gray-200 flex-1 flex flex-col">
              <div className="flex justify-between items-center mb-4 border-b border-gray-100 pb-2">
                <h3 className="font-bold text-gray-700 flex items-center gap-2">
                  <Users size={18} className="text-green-600"/> 3. Selecteer Spelers
                </h3>
                <span className={`text-xs px-3 py-1.5 rounded-full font-bold ${
                  selectedPlayerIds.length > 0 ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                }`}>
                  Geselecteerd: {selectedPlayerIds.length}
                </span>
              </div>
              
              <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-2 overflow-y-auto pr-2 max-h-[600px] custom-scrollbar">
                {allPlayers.map(player => (
                  <label key={player.id} className={`flex items-center p-2 rounded border cursor-pointer select-none text-sm transition-all ${
                      selectedPlayerIds.includes(player.id) ? 'bg-green-50 border-green-500 shadow-sm' : 'hover:bg-gray-50 border-gray-200'
                    }`}>
                    <input type="checkbox" className="w-4 h-4 text-green-600 rounded accent-green-600 focus:ring-green-500"
                      checked={selectedPlayerIds.includes(player.id)}
                      onChange={() => togglePlayer(player.id)}
                    />
                    <div className="ml-2 font-medium text-gray-800 truncate">{player.name}</div>
                  </label>
                ))}
              </div>

              <div className="mt-6 pt-4 border-t border-gray-100">
                 <button type="submit" disabled={loading} className="w-full bg-blue-600 text-white font-bold py-3 rounded-lg hover:bg-blue-700 transition shadow-lg flex justify-center items-center gap-2 disabled:opacity-50 disabled:cursor-not-allowed">
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

export default CreateTournament;