import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';

const GAMES = [
    {
        id:          'snake',
        name:        'Snake',
        emoji:       '🐍',
        description: 'Eat food, grow longer, earn cash. Pick your difficulty for bigger multipliers.',
        status:      'available',
        path:        '/esports/snake',
        tag:         'Live',
        tagCls:      'bg-green-900 text-green-300 border border-green-700',
    },
    {
        id:          'tetris',
        name:        'Tetris Lite',
        emoji:       '🧱',
        description: 'Drop blocks, clear lines, stack cash. Lines cleared × 100 = raw score.',
        status:      'available',
        path:        '/esports/tetris',
        tag:         'Live',
        tagCls:      'bg-green-900 text-green-300 border border-green-700',
    },
    {
        id:          'memory',
        name:        'Memory Match',
        emoji:       '🧠',
        description: 'Flip cards and find pairs before time runs out. Fraud-resistant by design.',
        status:      'coming_soon',
    },
    {
        id:          'math',
        name:        'Math Blaster',
        emoji:       '🔢',
        description: 'Solve arithmetic problems against the clock. Fast fingers, faster cash.',
        status:      'coming_soon',
    },
];

export default function ESports() {
    const { dashboard } = useStore();
    const navigate = useNavigate();

    return (
        <div className="flex h-full flex-col space-y-6">

            {/* Header */}
            <div>
                <h1 className="text-3xl font-bold text-white">E-Sports Center</h1>
                <p className="mt-2 text-gray-400">
                    Play games, earn points, convert to campus cash.
                </p>
            </div>

            {/* Stats bar */}
            <div className="flex items-center justify-between rounded-xl border border-gray-700 bg-gray-800 p-6 shadow">
                <div>
                    <p className="text-sm text-gray-400">Total Game Earnings</p>
                    <p className="text-2xl font-bold text-blue-400">
                        Rs. {dashboard?.total_game_earnings || '0.00'}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-400">Sessions Played</p>
                    <p className="text-2xl font-bold text-white">
                        {dashboard?.total_game_sessions || 0}
                    </p>
                </div>
            </div>

            {/* Game grid */}
            <div className="grid grid-cols-1 gap-4 md:grid-cols-2 lg:grid-cols-4">
                {GAMES.map(game => (
                    <div
                        key={game.id}
                        onClick={() => game.status === 'available' && navigate(game.path)}
                        className={`group relative flex flex-col gap-4 rounded-xl border p-6 transition ${
                            game.status === 'available'
                                ? 'border-gray-700 bg-gray-800 hover:border-blue-500 cursor-pointer'
                                : 'border-gray-800 bg-gray-900 opacity-50 cursor-not-allowed'
                        }`}
                    >
                        {/* Tag */}
                        {game.tag && (
                            <span className={`absolute top-4 right-4 text-xs font-bold px-2 py-0.5 rounded ${game.tagCls}`}>
                                {game.tag}
                            </span>
                        )}
                        {!game.tag && game.status === 'coming_soon' && (
                            <span className="absolute top-4 right-4 text-xs text-gray-600 font-medium">
                                Soon
                            </span>
                        )}

                        <span className="text-4xl select-none">{game.emoji}</span>

                        <div className="flex-1">
                            <h3 className="text-lg font-bold text-white">{game.name}</h3>
                            <p className="mt-1 text-sm text-gray-400 leading-relaxed">
                                {game.description}
                            </p>
                        </div>

                        {game.status === 'available' && (
                            <span className="text-sm font-bold text-blue-400 group-hover:text-blue-300 transition mt-auto">
                                Play Now →
                            </span>
                        )}
                    </div>
                ))}
            </div>
        </div>
    );
}
