import { useState, useEffect } from 'react';
import { useParams, Link } from 'react-router-dom';
import api from '../../services/api'; // Let op je pad naar api service
import { Calendar, Edit3, Beer, User, Users, ChevronLeft, Trophy } from 'lucide-react';

// Types voor de data die we van jouw nieuwe endpoint krijgen
interface ScheduleMatch {
  id: number;
  round_number: number;
  poule_number: number | null;
  board_name: string | number;
  opponent_name: string;
  match_name: string;
  is_completed: boolean;
  score_p1: number;
  score_p2: number;
}

interface ScheduleData {
  playing: ScheduleMatch[];
  refereeing: ScheduleMatch[];
  beer_fetching: ScheduleMatch[];
}

export default function PlayerPortal() {
  const { uuid } = useParams();
  
  // State
  const [participants, setParticipants] = useState<{id: number, name: string}[]>([]);
  const [tournamentName, setTournamentName] = useState("");
  const [isTeamMode, setIsTeamMode] = useState(false);
  const [selectedId, setSelectedId] = useState<string>("");
  const [schedule, setSchedule] = useState<ScheduleData | null>(null);
  const [loading, setLoading] = useState(false);

  // 1. Haal de lijst met deelnemers op (Teams of Spelers)
  useEffect(() => {
    console.log("Ik ga nu fetchen naar:", `/tournaments/public/${uuid}/participants`);
    api.get(`/tournaments/public/${uuid}/participants`)
      .then(res => {
        setParticipants(res.data.data);
        setTournamentName(res.data.tournament_name);
        setIsTeamMode(res.data.type === 'teams');
      })
      .catch(err => console.error("Fout bij laden deelnemers:", err));
  }, [uuid]);

  // 2. Haal het schema op zodra er iemand gekozen is
  useEffect(() => {
    if (!selectedId) {
        setSchedule(null);
        return;
    }
    setLoading(true);
    // Let op: dit endpoint heb je net gemaakt in de backend
    api.get(`/tournaments/public/${uuid}/participant/${selectedId}/schedule`)
      .then(res => {
        setSchedule(res.data);
      })
      .catch(err => console.error("Fout bij laden schema:", err))
      .finally(() => setLoading(false));
  }, [selectedId, uuid]);

  return (
    <div className="min-h-screen bg-slate-100 pb-12 font-sans">
      {/* --- HEADER --- */}
      <div className="bg-slate-900 text-white p-4 sticky top-0 z-20 shadow-lg">
        <div className="max-w-xl mx-auto flex items-center justify-between">
           <Link to={`/t/${uuid}`} className="p-2 -ml-2 text-slate-400 hover:text-white transition">
              <ChevronLeft size={24} />
           </Link>
           <h1 className="font-bold text-lg truncate flex-1 text-center px-2">{tournamentName}</h1>
           <Trophy size={20} className="text-yellow-500" />
        </div>
      </div>

      <div className="max-w-xl mx-auto p-4 space-y-6 mt-2">
        
        {/* --- SELECTIE BOX --- */}
        <div className="bg-white p-6 rounded-2xl shadow-sm border border-slate-200">
          <label className="flex items-center gap-2 text-xs font-bold text-slate-500 uppercase tracking-wider mb-3">
             {isTeamMode ? <Users size={16} /> : <User size={16} />}
             Wie ben jij?
          </label>
          <select 
              className="w-full p-4 text-lg font-medium bg-slate-50 border border-slate-300 rounded-xl focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none appearance-none transition-all"
              value={selectedId}
              onChange={(e) => setSelectedId(e.target.value)}
          >
              <option value="">-- Selecteer je naam --</option>
              {participants.map(p => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
          </select>
        </div>

        {/* --- HET SCHEMA --- */}
        {loading && <div className="text-center text-slate-400 py-8">Schema laden...</div>}

        {schedule && !loading && (
            <div className="space-y-4 animate-in slide-in-from-bottom-4 fade-in duration-500">
                
                {/* 1. SPELEN */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-blue-500">
                    <div className="bg-blue-50 p-4 border-b border-blue-100 flex items-center gap-2">
                        <Calendar className="text-blue-600" size={20} />
                        <h2 className="font-bold text-blue-900">Wedstrijden</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                        {schedule.playing.length === 0 ? (
                            <p className="p-4 text-slate-400 italic text-sm">Geen wedstrijden gepland.</p>
                        ) : (
                            schedule.playing.map(m => (
                                <div key={m.id} className={`p-4 flex items-center justify-between ${m.is_completed ? 'opacity-50 bg-slate-50' : ''}`}>
                                    <div>
                                        <div className="text-xs text-slate-500 uppercase font-bold tracking-wider mb-1">
                                            {m.poule_number ? `Poule ${m.poule_number}` : `Ronde ${m.round_number}`}
                                        </div>
                                        <div className="font-bold text-slate-800 text-lg">
                                            vs. {m.opponent_name}
                                        </div>
                                    </div>
                                    <div className="text-right">
                                        {m.is_completed ? (
                                            <span className="font-mono font-bold text-slate-600 text-lg">{m.score_p1} - {m.score_p2}</span>
                                        ) : (
                                            <span className="inline-block bg-blue-600 text-white px-3 py-1 rounded-lg font-bold text-sm shadow-sm">
                                                Bord {m.board_name}
                                            </span>
                                        )}
                                    </div>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 2. SCHRIJVEN */}
                <div className="bg-white rounded-2xl shadow-sm overflow-hidden border-l-4 border-orange-500">
                    <div className="bg-orange-50 p-4 border-b border-orange-100 flex items-center gap-2">
                        <Edit3 className="text-orange-600" size={20} />
                        <h2 className="font-bold text-orange-900">Schrijven</h2>
                    </div>
                    <div className="divide-y divide-slate-100">
                         {schedule.refereeing.length === 0 ? (
                            <p className="p-4 text-slate-400 italic text-sm">Je hoeft (nog) niet te schrijven.</p>
                        ) : (
                            schedule.refereeing.map(m => (
                                <div key={m.id} className="p-4 flex items-center justify-between">
                                     <div>
                                        <div className="font-medium text-slate-900">{m.match_name}</div>
                                        <div className="text-xs text-slate-400">Ronde {m.round_number}</div>
                                     </div>
                                     <span className="bg-orange-100 text-orange-700 px-3 py-1 rounded-lg font-bold text-sm">
                                        Bord {m.board_name}
                                    </span>
                                </div>
                            ))
                        )}
                    </div>
                </div>

                {/* 3. BIER HALEN */}
                {schedule.beer_fetching.length > 0 && (
                    <div className="bg-yellow-50 rounded-2xl shadow-sm overflow-hidden border-2 border-yellow-400">
                        <div className="bg-yellow-400 p-4 flex items-center gap-2 text-yellow-900">
                            <Beer size={20} />
                            <h2 className="font-bold">Bier Haal Dienst!</h2>
                        </div>
                        <div className="p-4">
                            <p className="text-sm text-yellow-800 mb-2 font-medium">Jij haalt drankjes tijdens:</p>
                            <ul className="space-y-2">
                                {schedule.beer_fetching.map(m => (
                                    <li key={m.id} className="bg-white/50 p-2 rounded border border-yellow-200 text-sm text-slate-700 flex justify-between">
                                        <span>Ronde {m.round_number}</span>
                                        <span className="font-bold">Bord {m.board_name}</span>
                                    </li>
                                ))}
                            </ul>
                        </div>
                    </div>
                )}
            </div>
        )}
      </div>
    </div>
  );
}