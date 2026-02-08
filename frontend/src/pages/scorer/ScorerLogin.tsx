// FILE: frontend/src/pages/scorer/ScorerLogin.tsx
import { useEffect, useState, useCallback } from 'react'; // Voeg useCallback toe
import { useNavigate, useSearchParams } from 'react-router-dom';
import api from '../../services/api';
import { Tablet, ArrowRight, Loader2 } from 'lucide-react';

const ScorerLogin = () => {
    const navigate = useNavigate();
    const [searchParams] = useSearchParams();
    const [code, setCode] = useState('');
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState('');

    // We maken van handleLogin een herbruikbare functie
    const handleLogin = useCallback(async (manualCode?: string) => {
        const codeToUse = manualCode || code;
        if (!codeToUse || codeToUse.length < 4) return;

        setLoading(true);
        setError('');

        try {
            const res = await api.post('/scorer/auth', { code: codeToUse });
            const { tournament_id, board_number } = res.data;

            localStorage.setItem('scorer_session', JSON.stringify({ tournament_id, board_number }));
            navigate('/scorer/standby');

        } catch (err: any) {
            setError('Ongeldige code. Probeer het opnieuw.');
        } finally {
            setLoading(false);
        }
    }, [code, navigate]);

    // Luister naar de URL parameter ?code=...
    useEffect(() => {
        const codeFromUrl = searchParams.get('code');
        if (codeFromUrl && codeFromUrl.length === 4) {
            setCode(codeFromUrl);
            // Voer direct de login uit met de code uit de URL
            handleLogin(codeFromUrl);
        }
    }, [searchParams, handleLogin]);

    const handleSubmit = (e: React.FormEvent) => {
        e.preventDefault();
        handleLogin();
    };

    return (
        <div className="min-h-screen bg-slate-900 flex items-center justify-center p-4">
            <div className="max-w-md w-full bg-white rounded-2xl shadow-2xl overflow-hidden">
                <div className="bg-blue-600 p-6 text-center">
                    <Tablet className="mx-auto text-white mb-2" size={48} />
                    <h1 className="text-2xl font-bold text-white">Tablet Koppelen</h1>
                    <p className="text-blue-100 text-sm">Dart Toernooi Manager</p>
                </div>
                
                <div className="p-8">
                    <form onSubmit={handleSubmit} className="space-y-6">
                        <div>
                            <label className="block text-center text-gray-500 font-bold mb-2 uppercase text-xs tracking-wide">
                                Voer de 4-cijferige bordcode in
                            </label>
                            <input 
                                type="text" 
                                inputMode="numeric" 
                                maxLength={4}
                                value={code}
                                onChange={e => setCode(e.target.value)}
                                className="w-full text-center text-5xl font-mono font-bold tracking-[0.5em] border-b-4 border-gray-200 focus:border-blue-600 outline-none py-4 text-slate-800 placeholder-gray-200"
                                placeholder="0000"
                                autoFocus
                            />
                        </div>

                        {error && (
                            <div className="bg-red-50 text-red-600 p-3 rounded text-center text-sm font-bold">
                                {error}
                            </div>
                        )}

                        <button 
                            type="submit" 
                            disabled={code.length < 4 || loading}
                            className="w-full bg-slate-900 text-white py-4 rounded-xl font-bold text-lg hover:bg-slate-800 transition disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
                        >
                            {loading ? <Loader2 className="animate-spin" /> : <>Koppel Bord <ArrowRight /></>}
                        </button>
                    </form>
                </div>
            </div>
        </div>
    );
};

export default ScorerLogin;