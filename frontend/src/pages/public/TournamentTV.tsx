import { useEffect, useState, useMemo } from 'react';
import { useParams } from 'react-router-dom';
import api from '../../services/api';
import { Trophy, LayoutGrid, GitMerge, Medal, Target, PenTool, History, Clock, Info, Crown, Star, Beer } from 'lucide-react';
import { Tournament, Match } from '../../types'; 

interface StandingsItem {
    id: number;
    name: string;
    points: number;
    played: number;
    legs_won: number;
    legs_lost: number;
    leg_diff: number;
    needs_shootout: boolean;
}

const TournamentTV = () => {
    const { public_uuid } = useParams();
    const [tournament, setTournament] = useState<Tournament | null>(null);
    const [standings, setStandings] = useState<Record<number, StandingsItem[]>>({});
    const [activeView, setActiveView] = useState<number | 'ko'>(1);

    // --- 1. DATA LADEN ---
    useEffect(() => {
        const loadData = async () => {
            try {
                const res = await api.get(`/tournaments/public/${public_uuid}`);
                setTournament(res.data);
                if (res.data.id) {
                    const standRes = await api.get(`/tournaments/${res.data.id}/standings`);
                    setStandings(standRes.data);
                }
            } catch (err) {
                console.error("Error loading TV data", err);
            }
        };
        loadData();
        const interval = setInterval(loadData, 15000); 
        return () => clearInterval(interval);
    }, [public_uuid]);

    // --- 2. PODIUM LOGICA (NIEUW) ---
    // Checkt of de finale gespeeld is en berekent de winnaars
    const podiumData = useMemo(() => {
        if (!tournament) return null;
        
        const koMatches = tournament.matches.filter(m => m.poule_number === null);
        if (koMatches.length === 0) return null;

        // Vind de hoogste ronde (de finale)
        const maxRound = Math.max(...koMatches.map(m => m.round_number));
        const finale = koMatches.find(m => m.round_number === maxRound);

        // Als finale niet bestaat of nog niet klaar is -> Geen podium
        if (!finale || !finale.is_completed) return null;

        // 1e en 2e plaats bepalen
        let winnerName = "Onbekend";
        let runnerUpName = "Onbekend";

        if (finale.score_p1 > finale.score_p2) {
            winnerName = finale.player1_name || "Bye";
            runnerUpName = finale.player2_name || "Bye";
        } else {
            winnerName = finale.player2_name || "Bye";
            runnerUpName = finale.player1_name || "Bye";
        }

        // 3e plaats bepalen (Verliezers halve finales)
        const semiFinals = koMatches.filter(m => m.round_number === maxRound - 1);
        const thirdPlaces: string[] = [];
        
        semiFinals.forEach(m => {
            if (m.is_completed) {
                // De verliezer gaat naar de 3e plek
                if (m.score_p1 > m.score_p2) thirdPlaces.push(m.player2_name || "Bye");
                else thirdPlaces.push(m.player1_name || "Bye");
            }
        });

        return { winnerName, runnerUpName, thirdPlaces };
    }, [tournament]);


    // --- 3. CARROUSEL LOGICA ---
    useEffect(() => {
        if (!tournament) return;
        
        // ALS HET PODIUM ZICHTBAAR IS, STOPPEN WE DE ROTATIE
        if (podiumData) return;

        const poules = new Set<number>();
        tournament.matches.forEach(m => { if (m.poule_number) poules.add(m.poule_number); });
        
        const hasKO = tournament.matches.some(m => m.poule_number === null);
        const pouleMatches = tournament.matches.filter(m => m.poule_number !== null);
        const isPoulePhaseFinished = pouleMatches.length > 0 && pouleMatches.every(m => m.is_completed);

        if (hasKO && (isPoulePhaseFinished || pouleMatches.length === 0)) {
            setActiveView('ko');
            return; 
        }

        const availableViews: (number | 'ko')[] = Array.from(poules).sort((a, b) => a - b);
        if (hasKO) availableViews.push('ko');

        if (availableViews.length === 0) return;

        const rotateTimer = setInterval(() => {
            setActiveView(current => {
                const currentIndex = availableViews.indexOf(current);
                if (currentIndex === -1) return availableViews[0];
                const nextIndex = (currentIndex + 1) % availableViews.length;
                return availableViews[nextIndex];
            });
        }, 10000); 

        return () => clearInterval(rotateTimer);
    }, [tournament, podiumData]); // podiumData toegevoegd aan dependencies

    // --- 4. FILTER LOGICA ---
    const { recentMatches, upcomingMatches } = useMemo(() => {
        if (!tournament) return { recentMatches: [], upcomingMatches: [] };
        
        let matchesInView = [];
        if (activeView === 'ko') {
            matchesInView = tournament.matches.filter(m => m.poule_number === null);
        } else {
            matchesInView = tournament.matches.filter(m => m.poule_number === activeView);
        }

        const completed = matchesInView.filter(m => m.is_completed);
        const upcoming = matchesInView.filter(m => !m.is_completed);

        const recent = completed.sort((a, b) => b.id - a.id).slice(0, 2);
        const limitUpcoming = recent.length === 0 ? 5 : 3;
        const nextUp = upcoming.sort((a, b) => a.id - b.id).slice(0, limitUpcoming);

        return { recentMatches: recent, upcomingMatches: nextUp };
    }, [tournament, activeView]);

    const currentStandings = useMemo(() => {
        if (activeView === 'ko') return [];
        return standings[activeView as number] || [];
    }, [standings, activeView]);

    const bracketData = useMemo(() => {
        if (!tournament) return [];
        const koMatches = tournament.matches.filter(m => m.poule_number === null);
        
        const roundsMap = new Map<number, Match[]>();
        koMatches.forEach(m => {
            if (!roundsMap.has(m.round_number)) roundsMap.set(m.round_number, []);
            roundsMap.get(m.round_number)?.push(m);
        });

        const sortedRounds = Array.from(roundsMap.entries())
            .sort((a, b) => a[0] - b[0])
            .map(([roundNum, matches]) => {
                let name = `Ronde ${roundNum}`;
                if (matches.length === 1) name = "FINALE";
                else if (matches.length === 2) name = "HALVE FINALE";
                else if (matches.length === 4) name = "KWARTFINALE";
                else if (matches.length === 8) name = "LAATSTE 16";
                return { roundNum, name, matches: matches.sort((a,b) => a.id - b.id) };
            });

        return sortedRounds;
    }, [tournament]);

    // --- HELPERS ---
    const getBoardName = (boardId?: number | null, short = false) => {
        if (!boardId || !tournament?.boards) return '-';
        const board = tournament.boards.find(b => b.id === boardId);
        if (board) {
            if (short) return `Bord ${board.number}`;
            return board.name ? `Bord ${board.number}: ${board.name}` : `Bord ${board.number}`;
        }
        return '-';
    };

    // --- COMPONENTS ---
    const BracketMatchCard = ({ m }: { m: Match }) => (
        <div className={`flex flex-col rounded-lg border shadow-md overflow-hidden relative w-full mb-4 ${m.is_completed ? 'bg-slate-800 border-slate-700 opacity-90' : 'bg-slate-700 border-blue-500/50 shadow-blue-900/20'}`}>
            <div className="bg-black/20 px-2 py-1 flex justify-between items-center text-[10px] text-slate-400 font-bold uppercase tracking-wider h-6">
                <div className="flex items-center gap-1 text-blue-300 shrink-0">
                    <Target size={10} />
                    <span className="whitespace-nowrap">{getBoardName(m.board_id, true)}</span>
                </div>
                {m.referee_name ? (
                    <div className="flex items-center justify-end gap-1 text-orange-300 min-w-0 flex-1 ml-2">
                        <PenTool size={10} className="shrink-0" />
                        <span className="truncate" title={m.referee_name}>{m.referee_name}</span>
                    </div>
                ) : <span>-</span>}

                {/* Bierhalers regel in KO-fase */}
{!m.is_completed && (
                <div className="flex justify-end items-center gap-1 text-amber-600/80 border-t border-white/5 mt-1 pt-0.5 italic">
                    <span className="truncate max-w-[120px]">
                        {m.beer_fetcher_name || "Peppie"}
                    </span>
                    <Beer size={9} />
                </div>
            )}
            </div>
            <div className="p-2 space-y-1">
                <div className="flex justify-between items-center">
                    <span className={`text-sm truncate font-bold ${m.is_completed && m.score_p1 > m.score_p2 ? 'text-green-400' : 'text-white'}`}>
                        {m.player1_name || 'Bye'}
                    </span>
                    <span className="bg-black/30 px-2 rounded text-sm font-mono text-yellow-500 font-bold min-w-[24px] text-center">{m.score_p1}</span>
                </div>
                <div className="flex justify-between items-center">
                    <span className={`text-sm truncate font-bold ${m.is_completed && m.score_p2 > m.score_p1 ? 'text-green-400' : 'text-white'}`}>
                        {m.player2_name || 'Bye'}
                    </span>
                    <span className="bg-black/30 px-2 rounded text-sm font-mono text-yellow-500 font-bold min-w-[24px] text-center">{m.score_p2}</span>
                </div>
            </div>
        </div>
    );

    const MatchCard = ({ m, label }: { m: Match, label?: string }) => (
        <div className={`flex flex-col p-3 rounded-xl border shadow-lg transition-all mb-3 relative overflow-hidden ${m.is_completed ? 'bg-slate-900/40 border-slate-800 opacity-80' : 'bg-gradient-to-br from-slate-700 to-slate-800 border-slate-600 scale-[1.01]'}`}>
            {label && <div className="absolute top-0 right-0 bg-white/10 px-2 py-0.5 text-[10px] font-bold text-white/50 rounded-bl-lg">{label}</div>}
            <div className="flex justify-between items-center mb-2 pb-2 border-b border-white/10 text-sm font-bold uppercase tracking-wider text-slate-400 gap-3">
                <div className="flex items-center gap-2 text-blue-300 shrink-0">
                    <Target size={16} />
                    <span className="whitespace-nowrap">{getBoardName(m.board_id)}</span>
                </div>
                {m.referee_name && <div className="flex items-center justify-end gap-2 text-orange-300 min-w-0 overflow-hidden"><PenTool size={16} className="shrink-0" /><span className="truncate text-right" title={m.referee_name}>{m.referee_name}</span></div>}
                {/* De Bierhalers (Spelers die rust hebben/wachten) */}
                {!m.is_completed && (
                    <div className="flex items-center gap-2 text-amber-500/80 text-[11px] animate-pulse">
                        <span className="truncate">
                            Bier: {m.beer_fetcher_name || "Handige Peppie"}
                        </span>
                        <Beer size={12} className="shrink-0" />
                    </div>
                )}
            </div>
            <div className="flex items-center justify-between gap-2">
                <div className={`text-xl font-bold flex-1 text-right truncate ${m.score_p1 > m.score_p2 && m.is_completed ? 'text-green-400' : 'text-white'}`}>{m.player1_name || 'Bye'}</div>
                <div className={`px-3 py-1 rounded-lg font-mono text-2xl font-bold border min-w-[80px] text-center shadow-inner mx-1 shrink-0 ${m.is_completed ? 'bg-slate-900 text-yellow-500 border-slate-700' : 'bg-slate-600 text-slate-400 border-slate-500'}`}>{m.is_completed ? `${m.score_p1} - ${m.score_p2}` : 'VS'}</div>
                <div className={`text-xl font-bold flex-1 text-left truncate ${m.score_p2 > m.score_p1 && m.is_completed ? 'text-green-400' : 'text-white'}`}>{m.player2_name || 'Bye'}</div>
            </div>
        </div>
    );

    if (!tournament) return <div className="bg-slate-900 h-screen text-white flex items-center justify-center">Laden...</div>;

    // --- 5. PODIUM VIEW (OVERLAY) ---
    // Als podiumData bestaat (finale is klaar), toon dan DIT scherm ipv het normale scherm
    if (podiumData) {
        return (
            <div className="min-h-screen bg-slate-900 text-white overflow-hidden font-sans flex flex-col relative">
                {/* Confetti / Achtergrond Effect (Simpel CSS) */}
                <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_top,_var(--tw-gradient-stops))] from-blue-900/40 via-slate-900 to-black z-0"></div>
                
                {/* Header */}
                <header className="bg-slate-800/80 p-6 border-b border-slate-700 flex justify-center items-center shadow-lg relative z-10 backdrop-blur-sm">
                    <h1 className="text-4xl font-black uppercase tracking-widest text-transparent bg-clip-text bg-gradient-to-r from-yellow-400 via-white to-yellow-400 drop-shadow-sm">
                        {tournament.name} - UITSLAG
                    </h1>
                </header>

                <main className="flex-1 flex flex-col items-center justify-center p-8 relative z-10">
                    
                    <div className="flex flex-col md:flex-row items-end gap-8 mb-12">
                        
                        {/* 2E PLEK (SILVER) */}
                        <div className="flex flex-col items-center order-2 md:order-1">
                            <div className="text-slate-300 font-bold uppercase tracking-widest mb-2 text-xl">2e Plaats</div>
                            <div className="bg-gradient-to-b from-slate-300 to-slate-500 w-48 h-64 rounded-t-lg shadow-[0_0_30px_rgba(203,213,225,0.3)] flex flex-col items-center justify-start pt-8 border-t-4 border-slate-100">
                                <Medal size={48} className="text-slate-800 mb-4" />
                                <div className="font-black text-2xl text-slate-900 text-center px-2">{podiumData.runnerUpName}</div>
                            </div>
                        </div>

                        {/* 1E PLEK (GOLD) */}
                        <div className="flex flex-col items-center order-1 md:order-2 mb-8 md:mb-0 z-20">
                            <div className="flex items-center gap-2 text-yellow-400 font-bold uppercase tracking-widest mb-4 text-3xl animate-pulse">
                                <Crown size={32} /> Kampioen
                            </div>
                            <div className="bg-gradient-to-b from-yellow-300 via-yellow-500 to-yellow-700 w-64 h-80 rounded-t-lg shadow-[0_0_50px_rgba(234,179,8,0.6)] flex flex-col items-center justify-start pt-10 border-t-4 border-yellow-100 transform scale-105">
                                <Trophy size={64} className="text-yellow-900 mb-6 drop-shadow-md" />
                                <div className="font-black text-3xl text-yellow-950 text-center px-4 leading-tight">{podiumData.winnerName}</div>
                                <div className="mt-4 flex gap-1">
                                    {[...Array(3)].map((_, i) => <Star key={i} size={16} className="text-yellow-100 fill-yellow-100" />)}
                                </div>
                            </div>
                        </div>

                        {/* 3E PLEK (BRONZE) */}
                        <div className="flex flex-col items-center order-3">
                            <div className="text-orange-400 font-bold uppercase tracking-widest mb-2 text-xl">3e Plaats</div>
                            <div className="bg-gradient-to-b from-orange-300 to-orange-600 w-48 h-56 rounded-t-lg shadow-[0_0_30px_rgba(249,115,22,0.3)] flex flex-col items-center justify-start pt-8 border-t-4 border-orange-200">
                                <Medal size={40} className="text-orange-900 mb-4" />
                                <div className="flex flex-col gap-2 w-full px-2">
                                    {podiumData.thirdPlaces.length > 0 ? (
                                        podiumData.thirdPlaces.map((name, i) => (
                                            <div key={i} className="font-bold text-xl text-orange-950 text-center border-b border-orange-900/10 pb-1 last:border-0">
                                                {name}
                                            </div>
                                        ))
                                    ) : (
                                        <div className="font-bold text-xl text-orange-950 text-center">-</div>
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>

                </main>
            </div>
        );
    }

    // --- 6. STANDAARD VIEW (ALS FINALE NOG NIET KLAAR IS) ---
    return (
        <div className="min-h-screen bg-slate-900 text-white overflow-hidden font-sans flex flex-col">
            
            <header className="bg-slate-800 p-4 border-b border-slate-700 flex justify-between items-center shadow-lg h-20 shrink-0">
                <div className="flex items-center gap-4 min-w-0">
                    <Trophy className="text-yellow-500 w-10 h-10 shrink-0" />
                    <h1 className="text-3xl font-black uppercase tracking-wider truncate">{tournament.name}</h1>
                </div>
                <div className="bg-blue-600 px-6 py-2 rounded-lg font-bold text-xl shadow-lg border border-blue-400 whitespace-nowrap">
                    {activeView === 'ko' ? 'KNOCKOUT' : `POULE ${activeView}`}
                </div>
            </header>

            <main className="p-6 flex-1 overflow-hidden">
                {activeView !== 'ko' && (
                    <div className="grid grid-cols-12 gap-8 h-full">
                        <div className="col-span-6 bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl flex flex-col">
                            <div className="bg-blue-900/50 p-4 border-b border-slate-600 font-bold text-xl flex items-center gap-3 text-blue-200 shrink-0">
                                <LayoutGrid /> TUSSENSTAND
                            </div>
                            <div className="p-2 flex-1 overflow-auto">
                                <table className="w-full text-left text-lg">
                                    <thead className="text-slate-500 border-b border-slate-600 text-sm uppercase bg-slate-800/50 sticky top-0">
                                        <tr>
                                            <th className="p-3 w-10">#</th>
                                            <th className="p-3">Naam</th>
                                            <th className="p-3 text-center w-12" title="Gespeeld">G</th>
                                            <th className="p-3 text-center w-12 text-green-400" title="Gewonnen">W</th>
                                            <th className="p-3 text-center w-12 text-red-400" title="Verloren">V</th>
                                            <th className="p-3 text-center w-16">+/-</th>
                                            <th className="p-3 text-center w-16 font-bold text-white">Pnt</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-slate-700">
                                        {currentStandings.map((row, idx) => (
                                            <tr key={row.id} className={idx < (tournament.qualifiers_per_poule || 2) ? 'bg-green-900/10' : ''}>
                                                <td className="p-3 font-mono font-bold text-xl text-slate-500">{idx + 1}</td>
                                                <td className="p-3 font-bold text-lg min-w-[150px]">
                                                    <div className="flex items-center gap-2">
                                                        <span className="truncate">{row.name}</span>
                                                        {idx < (tournament.qualifiers_per_poule || 2) && <Medal size={16} className="text-green-500 shrink-0" />}
                                                    </div>
                                                </td>
                                                <td className="p-3 text-center text-slate-400">{row.played}</td>
                                                <td className="p-3 text-center text-green-400/80">{row.legs_won}</td>
                                                <td className="p-3 text-center text-red-400/80">{row.legs_lost}</td>
                                                <td className="p-3 text-center text-slate-400 font-mono text-sm">{row.leg_diff > 0 ? `+${row.leg_diff}` : row.leg_diff}</td>
                                                <td className="p-3 text-center font-bold text-xl text-yellow-400">{row.points}</td>
                                            </tr>
                                        ))}
                                    </tbody>
                                </table>
                            </div>
                            <div className="bg-slate-900/30 p-2 border-t border-slate-700 flex items-center justify-center gap-2 text-xs text-slate-500 shrink-0">
                                <Info size={14} className="text-blue-400" />
                                <span className="font-medium tracking-wide">
                                    Order of Merit: Punten (2pt) &gt; Leg Saldo (+/-) &gt; Onderling Resultaat &gt; 9 dart shoot-out
                                </span>
                            </div>
                        </div>

                        <div className="col-span-6 flex flex-col gap-6 h-full overflow-hidden">
                            {recentMatches.length > 0 && (
                                <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl shrink-0">
                                    <div className="bg-slate-700/50 p-3 border-b border-slate-600 font-bold text-lg text-slate-300 flex items-center gap-3">
                                        <History size={20} className="text-slate-400"/> NET GESPEELD
                                    </div>
                                    <div className="p-4 bg-slate-800/50">
                                        {recentMatches.map(m => <MatchCard key={m.id} m={m} label="FINISHED" />)}
                                    </div>
                                </div>
                            )}
                            <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl flex-1 flex flex-col">
                                <div className="bg-slate-700/50 p-3 border-b border-slate-600 font-bold text-lg text-slate-300 flex items-center gap-3 shrink-0">
                                    <Clock size={20} className="text-blue-400"/> VOLGENDE WEDSTRIJDEN
                                </div>
                                <div className="p-4 overflow-y-auto custom-scrollbar flex-1">
                                    {upcomingMatches.length === 0 ? (
                                        <div className="text-slate-500 text-center py-4 italic">Geen geplande wedstrijden</div>
                                    ) : (
                                        upcomingMatches.map(m => <MatchCard key={m.id} m={m} />)
                                    )}
                                </div>
                            </div>
                        </div>
                    </div>
                )}

                {activeView === 'ko' && (
                    <div className="bg-slate-800 rounded-2xl border border-slate-700 overflow-hidden shadow-2xl h-full flex flex-col">
                         <div className="bg-orange-900/30 p-4 border-b border-orange-900/50 font-bold text-2xl text-orange-500 flex items-center gap-3 shrink-0">
                            <GitMerge /> KNOCKOUT SCHEMA
                        </div>
                        <div className="flex-1 overflow-x-auto p-6 flex gap-4">
                            {bracketData.map((round) => (
                                <div key={round.roundNum} className="flex-1 min-w-[260px] max-w-[320px] flex flex-col">
                                    <div className="text-center mb-4 pb-2 border-b border-white/10">
                                        <h3 className="text-blue-400 font-bold text-lg uppercase tracking-wider">{round.name}</h3>
                                    </div>
                                    <div className="flex-1 flex flex-col justify-around py-4">
                                        {round.matches.map(m => <BracketMatchCard key={m.id} m={m} />)}
                                    </div>
                                </div>
                            ))}
                        </div>
                    </div>
                )}
            </main>
        </div>
    );
};

export default TournamentTV;