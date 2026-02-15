// FILE: frontend/src/pages/Home.tsx
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom'; // Link weer toegevoegd
import { Trophy, Target, Users, BarChart3, Calendar, Monitor, ChevronRight, User } from 'lucide-react';
import api from '../services/api';
import { Tournament } from '../types';

const Home = () => {
  const [tournaments, setTournaments] = useState<Tournament[]>([]);
  const [loading, setLoading] = useState(true);
  const navigate = useNavigate();

  useEffect(() => {
    const fetchPublicTournaments = async () => {
      try {
        const res = await api.get('/tournaments/public/list');
        setTournaments(res.data);
      } catch (error) {
        console.error("Could not load public tournaments", error);
      } finally {
        setLoading(false);
      }
    };
    
    fetchPublicTournaments();
  }, []);

const handleTournamentClick = (uuid: string) => {
      // Normale klik -> Publieke detailpagina (TournamentView)
      navigate(`/t/${uuid}`);
  };

  const handleTvClick = (e: React.MouseEvent, uuid: string) => {
      e.stopPropagation(); 
      navigate(`/tv/${uuid}`); 
  };

const handleMeClick = (e: React.MouseEvent, uuid: string) => {
    e.stopPropagation(); 
    navigate(`/t/${uuid}/me`); 
};

  return (
    <div className="min-h-screen bg-white flex flex-col">
      {/* --- NAVIGATION --- */}
      <nav className="border-b border-gray-100 bg-white sticky top-0 z-50">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex justify-between items-center">
          
          {/* LOGO */}
          <div className="flex items-center gap-2">
            <Trophy className="text-blue-600 h-8 w-8" />
            <span className="font-bold text-xl text-gray-900 tracking-tight">Dart Manager</span>
          </div>

          {/* KNOPPEN (TERUGGEZET) */}
          <div className="flex items-center gap-2 md:gap-4">
            <Link to="/login" className="text-gray-600 hover:text-blue-600 font-medium transition text-sm md:text-base">
                Sign In
            </Link>
            <Link 
                to="/register" 
                className="bg-blue-600 text-white px-3 py-2 md:px-5 md:py-2 rounded-lg font-bold hover:bg-blue-700 transition shadow-sm text-sm md:text-base"
            >
                Get Started
            </Link>
           </div>
        </div>
      </nav>

      {/* --- HERO SECTION --- */}
      <div className="bg-gradient-to-b from-blue-50 to-white pt-16 pb-24">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 text-center">
          <h1 className="text-5xl md:text-6xl font-extrabold text-slate-900 mb-6 tracking-tight">
            Volg live de <br />
            <span className="text-blue-600">Dart Toernooien</span>
          </h1>
          <p className="text-xl text-gray-500 mb-10 max-w-2xl mx-auto leading-relaxed">
            Bekijk hieronder de actuele standen en live scores van de toernooien.
          </p>

          {/* --- LATEST TOURNAMENTS LIST --- */}
          <div className="max-w-3xl mx-auto text-left mt-12">
            <h3 className="text-gray-400 font-bold uppercase text-xs tracking-wider mb-4 text-center">
              Recente Toernooien
            </h3>
            
            {loading ? (
                <div className="text-center text-gray-400 py-4">Laden...</div>
            ) : tournaments.length === 0 ? (
                <div className="text-center text-gray-400 py-4 border-2 border-dashed border-gray-200 rounded-xl">
                    Geen openbare toernooien gevonden.
                </div>
            ) : (
                <div className="space-y-3">
                    {tournaments.map((t) => (
                        <div 
                            key={t.id}
                            onClick={() => handleTournamentClick(t.public_uuid!)}
                            className="bg-white p-4 rounded-xl shadow-sm border border-gray-200 hover:shadow-md hover:border-blue-300 transition-all cursor-pointer group flex items-center justify-between gap-4"
                        >
                            {/* Left Info */}
                            <div className="flex-1 min-w-0">
                                <h4 className="font-bold text-gray-900 text-lg truncate group-hover:text-blue-600 transition-colors">
                                    {t.name}
                                </h4>
                                <div className="flex items-center gap-4 text-sm text-gray-500 mt-1">
                                    <span className="flex items-center gap-1">
                                        <Calendar size={14} /> {new Date(t.date).toLocaleDateString('nl-NL')}
                                    </span>
                                    <span className="flex items-center gap-1">
                                        <Users size={14} /> {t.player_count} Spelers
                                    </span>
                                    <span className={`px-2 py-0.5 rounded text-[10px] uppercase font-bold ${
                                        t.status === 'active' ? 'bg-green-100 text-green-700' : 'bg-gray-100 text-gray-500'
                                    }`}>
                                        {t.status}
                                    </span>
                                </div>
                            </div>

                            {/* Right Actions */}
<div className="flex items-center gap-2 shrink-0">
    {/* NIEUW: Speler Portaal Knop */}
<button 
    onClick={(e) => handleMeClick(e, t.public_uuid!)} // <--- Let op de '!'
    className="flex items-center justify-center p-3 bg-blue-100 text-blue-700 rounded-lg hover:bg-blue-600 hover:text-white transition shadow-sm"
    title="Mijn Schema & Taken"
>
    <User size={20} /> 
</button>

    {/* BESTAAND: TV Mode Knop */}
    <button 
        onClick={(e) => handleTvClick(e, t.public_uuid!)}
        className="flex items-center justify-center p-3 bg-slate-800 text-white rounded-lg hover:bg-slate-700 transition shadow-sm"
        title="Open TV Mode"
    >
        <Monitor size={20} /> 
    </button>
    
    <div className="p-2 text-gray-300 group-hover:text-blue-500 transition-colors">
        <ChevronRight size={20} />
    </div>
</div>
                        </div>
                    ))}
                </div>
            )}
          </div>

        </div>
      </div>

      {/* --- FEATURES GRID --- */}
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 -mt-10 mb-24">
        <div className="grid md:grid-cols-3 gap-8">
          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 hover:border-blue-200 transition">
            <div className="bg-blue-100 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
              <Target className="text-blue-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Live Scoring</h3>
            <p className="text-gray-500 leading-relaxed">
              Volg de wedstrijden live via de tablets op de baan. Scores worden direct bijgewerkt.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 hover:border-blue-200 transition">
            <div className="bg-green-100 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
              <BarChart3 className="text-green-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Toernooi Schema</h3>
            <p className="text-gray-500 leading-relaxed">
              Automatische verwerking van poules en knock-out fases. Altijd de actuele stand in beeld.
            </p>
          </div>

          <div className="bg-white p-8 rounded-2xl shadow-xl border border-gray-100 hover:border-blue-200 transition">
            <div className="bg-purple-100 w-12 h-12 rounded-xl flex items-center justify-center mb-6">
              <Users className="text-purple-600" size={24} />
            </div>
            <h3 className="text-xl font-bold text-gray-900 mb-3">Spelers & Stats</h3>
            <p className="text-gray-500 leading-relaxed">
              Bekijk wie er speelt en hoe ze presteren tijdens het toernooi.
            </p>
          </div>
        </div>
      </div>

      {/* --- FOOTER --- */}
      <footer className="mt-auto bg-slate-900 text-slate-400 py-12">
        <div className="max-w-7xl mx-auto px-4 text-center">
          <Trophy className="mx-auto h-8 w-8 text-gray-600 mb-4" />
          <p>&copy; {new Date().getFullYear()} Dart Tournament Manager.</p>
        </div>
      </footer>
    </div>
  );
};

export default Home;