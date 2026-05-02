import { useState } from 'react';
import useStore from '../store/useStore';
import axiosClient from '../api/axiosClient';

export default function ESports() {
    const { user, dashboard, addBalance } = useStore();
    const [loading, setLoading] = useState(false);
    const [resultMsg, setResultMsg] = useState(null);
    const [isFraud, setIsFraud] = useState(false);

    const games = [
        { id: 1, name: 'Valorant', code: 'VALORANT', img: '🔫' },
        { id: 2, name: 'Counter-Strike 2', code: 'CS2', img: '💣' },
        { id: 3, name: 'FIFA 24', code: 'FIFA', img: '⚽' }
    ];

    const [selectedGame, setSelectedGame] = useState(games[0].code);

    const simulateMatch = async (cheatMode = false) => {
        setLoading(true);
        setResultMsg(null);
        setIsFraud(false);

        const matchId = `MATCH-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;

        const rawScore = cheatMode
            ? Math.floor(Math.random() * 20000) + 80000
            : Math.floor(Math.random() * 4000) + 1000;

        try {
            const response = await axiosClient.post('/games/session', {
                game_code: selectedGame,
                match_id: matchId,
                raw_score: rawScore
            });

            setResultMsg(`Victory! You scored ${rawScore} and earned Rs. ${response.data.cash_earned}`);

            addBalance(parseFloat(response.data.cash_earned));
        }
        catch (err) {

            if (err.response?.status === 403) {
                setIsFraud(true);
                setResultMsg(`FRAUD DETECTED: Score of ${rawScore} was flagged as highly suspicious. Payout rejected by the database.`);
            }
            else {
                setResultMsg(err.response?.data?.error || 'Failed to record session.');
            }
        }
        finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-full flex-col space-y-6">
            
            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">E-Sports Center</h1>
                <p className="mt-2 text-gray-400">Play matches to earn virtual cash for the campus.</p>
            </div>

            {/* Stats Overview */}
            <div className="flex items-center justify-between rounded-xl border border-gray-700 bg-gray-800 p-6 shadow">
                <div>
                    <p className="text-sm text-gray-400">Your Gamer Tag</p>
                    <p className="text-xl font-bold text-white">{user?.name}</p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-400">Total Career Earnings</p>
                    <p className="text-2xl font-bold text-blue-400">Rs. {dashboard?.total_game_earnings || '0.00'}</p>
                </div>
            </div>

            {/* Alert Box */}
            {resultMsg && (
                <div className={`rounded-xl p-4 border ${isFraud ? 'bg-red-900/50 border-red--500 text-red-200' : 'bg-green-900/50 border-green-500 text-green-200'}`}>
                    <p className="font-bold">{isFraud ? '⚠️ SYSTEM ALERT' : '✅ MATCH PROCESSED'}</p>
                    <p>{resultMsg}</p>
                </div>
            )}

            {/* Game Selector & Action Area */}
            <div className="grid grid-cols-1 gap-6 md:grid-cols-2">
                {/* Left: Select Game */}
                <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                    <h2 className="mb-4 text-xl font-bold text-white">Select a Title</h2>
                    <div className="space-y-3">
                        {games.map(game => (
                            <button
                                key={game.id}
                                onClick={() => setSelectedGame(game.code)}
                                className={`flex w-full items-center justify-between rounded-lg border p-4 transition ${
                                    selectedGame === game.code
                                        ? 'border-blue-500 bg-blue-600/20 text-white'
                                        : 'border-gray-700 bg-gray-900 text-gray-400 hover:bg-gray-700 hover:text-white'
                                }`}
                            >
                                <span className="text-lg font-bold">{game.img} {game.name}</span>
                            </button>
                        ))}
                    </div>
                </div>

                {/* Right Simulation Controls */}
                <div className="flex flex-col justify-center rounded-xl border border-gray-700 bg-gray-800 p-6">
                    <h2 className="mb-4 text-xl font-bold text-white text-center">Match Simulator</h2>
                    <p className="mb-8 text-center text-sm text-gray-400">
                        Hardware acceleration is active. Match results will be calculated securely on the PostgreSQL backend.
                    </p>

                    <div className="space-y-4">
                        <button
                            onClick={() => simulateMatch(false)}
                            disabled={loading}
                            className="w-full rounded-lg bg-blue-600 py-4 font-bold text-white transition hover:bg-blue-500 disabled:opacity-50"
                        >
                            {loading ? 'Simulating...' : 'Play Fair Match (Normal Score)'}
                        </button>

                        <button
                            onClick={() => simulateMatch(true)}
                            disabled={loading}
                            className="w-full rounded-lg bg-red-900/50 border border-red-700 py-4 font-bold text-red-400 transition hover:bg-red-800 hover:text-white disabled:opacity-50"
                        >
                            Inject Cheats (Massive Score)
                        </button>
                    </div>
                </div>
            </div>
        </div>
    );
}
