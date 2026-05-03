import { useState } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../store/useStore';
import axiosClient from '../api/axiosClient';

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
        id:          '2048',
        name:        '2048',
        emoji:       '🟦',
        description: 'Slide and merge tiles to reach 2048. A perfect score-to-cash ratio.',
        status:      'available',
        path:        '/esports/2048',
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
        id:          'reaction',
        name:        'Reaction Tap',
        emoji:       '⚡',
        description: 'Tap the target the instant it appears. Faster reactions = higher score.',
        status:      'available',
        path:        '/esports/reaction',
        tag:         'Live',
        tagCls:      'bg-green-900 text-green-300 border border-green-700',
    },
    { 
        id: 'flappy',   
        name: 'Flappy Bird',  
        emoji: '🐦', 
        description: 'Dodge the pipes, keep flying, earn cash. Each pipe cleared = 100 raw points.',     
        status: 'available', 
        path: '/esports/flappy',   
        tag: 'Live', 
        tagCls: 'bg-green-900 text-green-300 border border-green-700' 
    },
    { 
        id: 'math',
        name: 'Math Blaster',
        emoji: '🔢',
        description: 'Answer arithmetic fast before time runs out. Difficulty ramps every level.',       
        status: 'available', 
        path: '/esports/math',     
        tag: 'Live', 
        tagCls: 'bg-green-900 text-green-300 border border-green-700' 
    },
];

const formatRs = (amount) => {
    return Number(amount || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

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
                        Rs. {formatRs(dashboard?.total_game_earnings || '0.00')}
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-sm text-gray-400">Sessions Played</p>
                    <p className="text-2xl font-bold text-white">
                        {formatRs(dashboard?.total_game_sessions || 0)}
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
