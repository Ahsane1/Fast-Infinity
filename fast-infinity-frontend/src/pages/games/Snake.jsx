import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import axiosClient from '../../api/axiosClient';

// ─── Constants ───────────────────────────────────────────────────────────────
const GRID      = 20;
const CELL      = 22;
const CANVAS_PX = GRID * CELL; // 440px

const DIFFICULTIES = [
    { label: 'Easy',   speed: 180, multiplier: 1, activeCls: 'bg-green-700  border-green-500  text-white' },
    { label: 'Normal', speed: 120, multiplier: 2, activeCls: 'bg-blue-600   border-blue-400   text-white' },
    { label: 'Hard',   speed: 65,  multiplier: 4, activeCls: 'bg-orange-700 border-orange-500 text-white' },
];

const KEY_DIR = {
    ArrowUp:    { x: 0, y: -1 }, w: { x: 0, y: -1 },
    ArrowDown:  { x: 0, y:  1 }, s: { x: 0, y:  1 },
    ArrowLeft:  { x: -1, y: 0 }, a: { x: -1, y: 0 },
    ArrowRight: { x:  1, y: 0 }, d: { x:  1, y: 0 },
};

const INIT_SNAKE = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];

function randomFood(snake) {
    let p;
    do { p = { x: Math.floor(Math.random() * GRID), y: Math.floor(Math.random() * GRID) }; }
    while (snake.some(s => s.x === p.x && s.y === p.y));
    return p;
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function Snake() {
    const navigate   = useNavigate();
    const { addBalance } = useStore();
    const canvasRef  = useRef(null);

    // UI state
    const [phase,     setPhase]     = useState('IDLE');
    // IDLE | PLAYING | GAME_OVER | SUBMITTING | SUBMITTED
    const [diffIdx,   setDiffIdx]   = useState(1);
    const [score,     setScore]     = useState(0);
    const [highScore, setHighScore] = useState(() =>
        parseInt(localStorage.getItem('fi_snake_hs') || '0', 10));
    const [cashEarned,  setCashEarned]  = useState(null);
    const [submitError, setSubmitError] = useState(null);

    // Game refs (mutable, no re-render)
    const snakeRef   = useRef([...INIT_SNAKE]);
    const foodRef    = useRef(randomFood(INIT_SNAKE));
    const curDirRef  = useRef({ x: 1, y: 0 });
    const nextDirRef = useRef({ x: 1, y: 0 });
    const scoreRef   = useRef(0);
    const phaseRef   = useRef('IDLE');
    const tickRef    = useRef(null);
    const diffIdxRef = useRef(1);

    // ── Draw ─────────────────────────────────────────────────────────────────
    const draw = useCallback(() => {
        const cv  = canvasRef.current; if (!cv) return;
        const ctx = cv.getContext('2d');

        // Background
        ctx.fillStyle = '#0f172a';
        ctx.fillRect(0, 0, CANVAS_PX, CANVAS_PX);

        // Subtle grid dots
        ctx.fillStyle = 'rgba(255,255,255,0.035)';
        for (let x = 0; x < GRID; x++)
            for (let y = 0; y < GRID; y++)
                ctx.fillRect(x * CELL + CELL / 2 - 1, y * CELL + CELL / 2 - 1, 2, 2);

        // Food
        const f = foodRef.current;
        ctx.fillStyle = '#f87171';
        ctx.beginPath();
        ctx.arc(f.x * CELL + CELL / 2, f.y * CELL + CELL / 2, CELL / 2 - 3, 0, Math.PI * 2);
        ctx.fill();
        // Food shine
        ctx.fillStyle = 'rgba(255,255,255,0.35)';
        ctx.beginPath();
        ctx.arc(f.x * CELL + CELL / 2 - 2, f.y * CELL + CELL / 2 - 2, 3, 0, Math.PI * 2);
        ctx.fill();

        // Snake body
        const snake = snakeRef.current;
        snake.forEach((seg, i) => {
            const t = i === 0 ? 1 : Math.max(0.25, 1 - (i / snake.length) * 0.75);
            ctx.fillStyle = i === 0 ? '#3b82f6' : `rgba(59,130,246,${t.toFixed(2)})`;
            const x = seg.x * CELL + 2;
            const y = seg.y * CELL + 2;
            const sz = CELL - 4;
            const r = i === 0 ? 6 : 4;
            ctx.beginPath();
            if (ctx.roundRect) {
                ctx.roundRect(x, y, sz, sz, r);
            } else {
                ctx.rect(x, y, sz, sz);
            }
            ctx.fill();

            // Head eyes
            if (i === 0) {
                const dir = curDirRef.current;
                const cx = seg.x * CELL + CELL / 2;
                const cy = seg.y * CELL + CELL / 2;
                const fwd = 5;
                const side = 3;
                ctx.fillStyle = '#fff';
                ctx.beginPath();
                ctx.arc(cx + dir.x * fwd - dir.y * side, cy + dir.y * fwd + dir.x * side, 2.2, 0, Math.PI * 2);
                ctx.arc(cx + dir.x * fwd + dir.y * side, cy + dir.y * fwd - dir.x * side, 2.2, 0, Math.PI * 2);
                ctx.fill();
                ctx.fillStyle = '#1e293b';
                ctx.beginPath();
                ctx.arc(cx + dir.x * fwd - dir.y * side, cy + dir.y * fwd + dir.x * side, 1, 0, Math.PI * 2);
                ctx.arc(cx + dir.x * fwd + dir.y * side, cy + dir.y * fwd - dir.x * side, 1, 0, Math.PI * 2);
                ctx.fill();
            }
        });
    }, []);

    // ── End Game ─────────────────────────────────────────────────────────────
    const endGame = useCallback(() => {
        clearInterval(tickRef.current);
        phaseRef.current = 'GAME_OVER';
        setPhase('GAME_OVER');
        const final = scoreRef.current;
        if (final > parseInt(localStorage.getItem('fi_snake_hs') || '0', 10)) {
            localStorage.setItem('fi_snake_hs', String(final));
            setHighScore(final);
        }
        draw();
    }, [draw]);

    // ── Game Loop ─────────────────────────────────────────────────────────────
    const gameLoop = useCallback(() => {
        const dir   = nextDirRef.current;
        curDirRef.current = dir;
        const snake = snakeRef.current;
        const head  = { x: snake[0].x + dir.x, y: snake[0].y + dir.y };

        // Collisions
        if (head.x < 0 || head.x >= GRID || head.y < 0 || head.y >= GRID) { endGame(); return; }
        if (snake.some(s => s.x === head.x && s.y === head.y))              { endGame(); return; }

        const next = [head, ...snake];
        const ate  = head.x === foodRef.current.x && head.y === foodRef.current.y;
        if (ate) {
            const ns = scoreRef.current + 1;
            scoreRef.current = ns;
            setScore(ns);
            foodRef.current = randomFood(next);
        } else {
            next.pop();
        }
        snakeRef.current = next;
        draw();
    }, [endGame, draw]);

    // ── Start Game ───────────────────────────────────────────────────────────
    const startGame = useCallback(() => {
        clearInterval(tickRef.current);
        snakeRef.current   = [{ x: 10, y: 10 }, { x: 9, y: 10 }, { x: 8, y: 10 }];
        curDirRef.current  = { x: 1, y: 0 };
        nextDirRef.current = { x: 1, y: 0 };
        scoreRef.current   = 0;
        foodRef.current    = randomFood(snakeRef.current);
        setScore(0);
        setCashEarned(null);
        setSubmitError(null);
        phaseRef.current = 'PLAYING';
        setPhase('PLAYING');
        tickRef.current = setInterval(gameLoop, DIFFICULTIES[diffIdxRef.current].speed);
        draw();
    }, [gameLoop, draw]);

    // ── Keyboard ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e) => {
            const dir = KEY_DIR[e.key];
            if (!dir) return;
            e.preventDefault();
            const cur = curDirRef.current;
            if (dir.x === -cur.x && dir.y === -cur.y) return; // no 180°
            nextDirRef.current = dir;
            if (phaseRef.current === 'IDLE' || phaseRef.current === 'GAME_OVER') startGame();
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [startGame]);

    // ── Initial draw ─────────────────────────────────────────────────────────
    useEffect(() => {
        draw();
        return () => clearInterval(tickRef.current);
    }, [draw]);

    // ── Submit Score ─────────────────────────────────────────────────────────
    const handleCashOut = async () => {
        const diff     = DIFFICULTIES[diffIdxRef.current];
        const rawScore = scoreRef.current * diff.multiplier * 100;
        if (rawScore === 0) return;

        setPhase('SUBMITTING');
        setSubmitError(null);

        try {
            const matchId  = `SNAKE-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            const response = await axiosClient.post('/games/session', {
                game_code: 'SNAKE',
                match_id:  matchId,
                raw_score: rawScore,
            });
            setCashEarned(response.data.cash_earned);
            addBalance(parseFloat(response.data.cash_earned));
            setPhase('SUBMITTED');
        } catch (err) {
            if (err.response?.status === 403) {
                setSubmitError('Score flagged as suspicious. No payout.');
            } else {
                setSubmitError(err.response?.data?.error || 'Failed to submit score.');
            }
            setPhase('GAME_OVER');
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const diff         = DIFFICULTIES[diffIdx];
    const potentialRaw = score * diff.multiplier * 100;
    const isOver       = phase === 'GAME_OVER' || phase === 'SUBMITTING' || phase === 'SUBMITTED';

    const changeDiff = (i) => {
        if (phase === 'PLAYING') return;
        setDiffIdx(i);
        diffIdxRef.current = i;
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-full flex-col space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <button
                        onClick={() => { clearInterval(tickRef.current); navigate('/esports'); }}
                        className="mb-2 text-sm text-gray-400 hover:text-white transition"
                    >
                        ← Back to E-Sports
                    </button>
                    <h1 className="text-3xl font-bold text-white">Snake</h1>
                    <p className="mt-1 text-sm text-gray-400">
                        Eat food, grow longer, don't crash. Score converts to campus cash.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Best</p>
                    <p className="text-2xl font-bold text-yellow-400">{highScore}</p>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* ── Canvas ── */}
                <div className="flex-shrink-0">
                    <div
                        className="relative rounded-xl overflow-hidden border border-gray-700"
                        style={{ width: CANVAS_PX, height: CANVAS_PX }}
                    >
                        <canvas ref={canvasRef} width={CANVAS_PX} height={CANVAS_PX} />

                        {/* IDLE overlay */}
                        {phase === 'IDLE' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm gap-4">
                                <span className="text-6xl select-none">🐍</span>
                                <p className="text-white font-bold text-xl">Ready?</p>
                                <p className="text-gray-400 text-sm">Press an arrow key or click below</p>
                                <button
                                    onClick={startGame}
                                    className="mt-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                                >
                                    Start Game
                                </button>
                            </div>
                        )}

                        {/* GAME OVER / SUBMIT overlay */}
                        {isOver && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/85 backdrop-blur-sm gap-3 px-6">
                                <p className="text-white font-bold text-2xl">Game Over</p>
                                <div className="text-center">
                                    <p className="text-gray-400 text-sm">Score</p>
                                    <p className="text-blue-400 font-bold text-5xl">{score}</p>
                                </div>
                                <p className="text-gray-500 text-xs">
                                    Raw: {potentialRaw.toLocaleString()} pts
                                </p>

                                {/* Cash-out result */}
                                {phase === 'SUBMITTED' && cashEarned !== null && (
                                    <div className="w-full bg-green-900/50 border border-green-600 rounded-lg px-4 py-3 text-center">
                                        <p className="text-green-300 font-bold text-lg">
                                            +Rs. {cashEarned} earned!
                                        </p>
                                        <p className="text-green-400 text-xs mt-0.5">Added to your wallet</p>
                                    </div>
                                )}

                                {submitError && (
                                    <div className="w-full bg-red-900/40 border border-red-700 rounded-lg px-4 py-3 text-center">
                                        <p className="text-red-300 text-sm">{submitError}</p>
                                    </div>
                                )}

                                <div className="flex gap-3 mt-1">
                                    {phase === 'GAME_OVER' && score > 0 && (
                                        <button
                                            onClick={handleCashOut}
                                            className="px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white font-bold rounded-lg transition"
                                        >
                                            💰 Cash Out
                                        </button>
                                    )}
                                    {phase !== 'SUBMITTING' && (
                                        <button
                                            onClick={startGame}
                                            className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                                        >
                                            {phase === 'SUBMITTED' ? 'Play Again' : 'Retry'}
                                        </button>
                                    )}
                                    {phase === 'SUBMITTING' && (
                                        <p className="text-gray-400 text-sm animate-pulse">Submitting…</p>
                                    )}
                                </div>
                            </div>
                        )}
                    </div>

                    {/* Mobile D-pad (hidden on lg+) */}
                    <div className="mt-4 flex flex-col items-center gap-2 lg:hidden">
                        <button
                            onPointerDown={() => { nextDirRef.current = { x: 0, y: -1 }; if (phaseRef.current !== 'PLAYING') startGame(); }}
                            className="w-14 h-14 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-2xl flex items-center justify-center"
                        >▲</button>
                        <div className="flex gap-2">
                            <button
                                onPointerDown={() => { nextDirRef.current = { x: -1, y: 0 }; if (phaseRef.current !== 'PLAYING') startGame(); }}
                                className="w-14 h-14 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-2xl flex items-center justify-center"
                            >◀</button>
                            <button
                                onPointerDown={() => { nextDirRef.current = { x: 0, y: 1 }; if (phaseRef.current !== 'PLAYING') startGame(); }}
                                className="w-14 h-14 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-2xl flex items-center justify-center"
                            >▼</button>
                            <button
                                onPointerDown={() => { nextDirRef.current = { x: 1, y: 0 }; if (phaseRef.current !== 'PLAYING') startGame(); }}
                                className="w-14 h-14 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-2xl flex items-center justify-center"
                            >▶</button>
                        </div>
                    </div>
                </div>

                {/* ── Side Panel ── */}
                <div className="flex flex-col gap-4 flex-1 min-w-0">

                    {/* Live Score */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                        <p className="text-sm text-gray-400">Current Score</p>
                        <p className="text-5xl font-bold text-white mt-1 tabular-nums">{score}</p>
                        <p className="text-sm text-gray-500 mt-2">
                            ≈ <span className="text-green-400">Rs. {(potentialRaw / 100).toFixed(2)}</span> if you cash out now
                        </p>
                    </div>

                    {/* Difficulty */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                        <p className="text-sm text-gray-400 mb-3">Difficulty</p>
                        <div className="flex gap-2">
                            {DIFFICULTIES.map((d, i) => (
                                <button
                                    key={d.label}
                                    onClick={() => changeDiff(i)}
                                    disabled={phase === 'PLAYING'}
                                    className={`flex-1 py-2.5 rounded-lg border text-sm font-bold transition ${
                                        diffIdx === i
                                            ? d.activeCls
                                            : 'border-gray-600 text-gray-400 hover:border-gray-400 hover:text-white disabled:opacity-40 disabled:cursor-not-allowed'
                                    }`}
                                >
                                    {d.label}
                                </button>
                            ))}
                        </div>
                        <p className="text-xs text-gray-500 mt-2">
                            Cash multiplier: <span className="text-white">×{diff.multiplier}</span>
                        </p>
                    </div>

                    {/* Controls */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                        <p className="text-sm text-gray-400 mb-3">Controls</p>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                            {[
                                ['↑ / W', 'Move up'],
                                ['↓ / S', 'Move down'],
                                ['← / A', 'Move left'],
                                ['→ / D', 'Move right'],
                            ].map(([key, label]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-gray-700 text-gray-200 px-2 py-0.5 rounded">
                                        {key}
                                    </span>
                                    <span className="text-gray-400">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* How scoring works */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 text-sm space-y-1.5">
                        <p className="font-bold text-gray-300">How scoring works</p>
                        <p className="text-gray-400">Each food eaten = +1 point</p>
                        <p className="text-gray-400">Raw score = points × difficulty × 100</p>
                        <p className="text-gray-400">Backend converts raw score → Rs.</p>
                        <div className="pt-2 border-t border-gray-700 text-xs text-gray-500 space-y-0.5">
                            <p>Easy: ×1 · Normal: ×2 · Hard: ×4</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
