import { useState, useEffect, useCallback, useRef } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import axiosClient from '../../api/axiosClient';

// ─── Tile visuals ────────────────────────────────────────────────────────────
const TILE_STYLE = {
    0:    { bg: 'transparent',  fg: 'transparent', border: '1px solid #1e293b' },
    2:    { bg: '#1e293b',      fg: '#94a3b8' },
    4:    { bg: '#0f3460',      fg: '#93c5fd' },
    8:    { bg: '#7c2d12',      fg: '#fed7aa' },
    16:   { bg: '#9a3412',      fg: '#fdba74' },
    32:   { bg: '#c2410c',      fg: '#fff'    },
    64:   { bg: '#ea580c',      fg: '#fff'    },
    128:  { bg: '#854d0e',      fg: '#fef08a' },
    256:  { bg: '#ca8a04',      fg: '#fff'    },
    512:  { bg: '#b45309',      fg: '#fef3c7' },
    1024: { bg: '#92400e',      fg: '#fde68a' },
    2048: { bg: '#f59e0b',      fg: '#1c1917' },
};
const tileStyle  = v => TILE_STYLE[v] || TILE_STYLE[2048];
const tileFontPx = v => (v >= 1000 ? 18 : v >= 100 ? 22 : 26);

// ─── Game Logic ───────────────────────────────────────────────────────────────
function emptyGrid()   { return Array(4).fill(null).map(() => Array(4).fill(0)); }

function addTile(grid) {
    const blanks = [];
    for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++)
            if (grid[r][c] === 0) blanks.push([r, c]);
    if (!blanks.length) return grid;
    const [r, c] = blanks[Math.floor(Math.random() * blanks.length)];
    const g = grid.map(row => [...row]);
    g[r][c] = Math.random() < 0.9 ? 2 : 4;
    return g;
}

function initGrid() { return addTile(addTile(emptyGrid())); }

function slideRow(row) {
    const vals  = row.filter(v => v);
    let score   = 0;
    const out   = [];
    let i = 0;
    while (i < vals.length) {
        if (i + 1 < vals.length && vals[i] === vals[i + 1]) {
            const m = vals[i] * 2;
            out.push(m); score += m; i += 2;
        } else { out.push(vals[i]); i++; }
    }
    while (out.length < 4) out.push(0);
    return { row: out, score };
}

function rotate90(g)  { return g[0].map((_, c) => g.map(row => row[c]).reverse()); }
function rotate180(g) { return g.map(row => [...row].reverse()).reverse(); }
function rotateCCW(g) { return g[0].map((_, c) => g.map(row => row[row.length - 1 - c])); }

function applyMove(grid, dir) {
    let g = grid;
    if (dir === 'right') g = rotate180(g);
    if (dir === 'up')    g = rotateCCW(g);
    if (dir === 'down')  g = rotate90(g);

    let totalScore = 0;
    const moved = g.map(row => { const { row: r, score } = slideRow(row); totalScore += score; return r; });

    if (dir === 'right') return { grid: rotate180(moved), score: totalScore };
    if (dir === 'up')    return { grid: rotate90(moved),  score: totalScore };
    if (dir === 'down')  return { grid: rotateCCW(moved), score: totalScore };
    return { grid: moved, score: totalScore };
}

function same(a, b)    { return a.every((row, r) => row.every((v, c) => v === b[r][c])); }
function maxTile(g)    { return Math.max(...g.flat()); }

function canMove(g) {
    if (g.flat().includes(0)) return true;
    for (let r = 0; r < 4; r++)
        for (let c = 0; c < 4; c++) {
            if (c < 3 && g[r][c] === g[r][c + 1]) return true;
            if (r < 3 && g[r][c] === g[r + 1][c]) return true;
        }
    return false;
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function Game2048() {
    const navigate       = useNavigate();
    const { addBalance } = useStore();

    const [grid,       setGrid]       = useState(initGrid);
    const [score,      setScore]      = useState(0);
    const [best,       setBest]       = useState(() => parseInt(localStorage.getItem('fi_2048_best') || '0', 10));
    const [phase,      setPhase]      = useState('PLAYING'); // PLAYING | WON | OVER | SUBMITTING | SUBMITTED
    const [wonCont,    setWonCont]    = useState(false);     // "keep going" after 2048
    const [cashEarned, setCashEarned] = useState(null);
    const [submitErr,  setSubmitErr]  = useState(null);

    const gridRef  = useRef(grid);
    const scoreRef = useRef(0);
    const phaseRef = useRef('PLAYING');

    const saveBest = (s) => {
        if (s > parseInt(localStorage.getItem('fi_2048_best') || '0', 10)) {
            localStorage.setItem('fi_2048_best', String(s));
            setBest(s);
        }
    };

    // ── Swipe tracking
    const touchStart = useRef(null);

    const doMove = useCallback((dir) => {
        if (phaseRef.current !== 'PLAYING') return;
        const { grid: next, score: gained } = applyMove(gridRef.current, dir);
        if (same(gridRef.current, next)) return;
        const withTile = addTile(next);
        const ns = scoreRef.current + gained;
        gridRef.current = withTile;
        scoreRef.current = ns;
        setGrid(withTile);
        setScore(ns);
        saveBest(ns);
        if (!wonCont && maxTile(withTile) >= 2048) { phaseRef.current = 'WON'; setPhase('WON'); }
        else if (!canMove(withTile))                { phaseRef.current = 'OVER'; setPhase('OVER'); }
    }, [wonCont]);

    // ── Keyboard
    useEffect(() => {
        const map = { ArrowLeft: 'left', ArrowRight: 'right', ArrowUp: 'up', ArrowDown: 'down' };
        const h = (e) => { const d = map[e.key]; if (d) { e.preventDefault(); doMove(d); } };
        window.addEventListener('keydown', h);
        return () => window.removeEventListener('keydown', h);
    }, [doMove]);

    // ── New Game
    const newGame = () => {
        const g = initGrid();
        gridRef.current = g; scoreRef.current = 0; phaseRef.current = 'PLAYING';
        setGrid(g); setScore(0); setPhase('PLAYING');
        setCashEarned(null); setSubmitErr(null); setWonCont(false);
    };

    // ── Keep Going
    const keepGoing = () => { setWonCont(true); phaseRef.current = 'PLAYING'; setPhase('PLAYING'); };

    // ── Cash Out
    const cashOut = async () => {
        if (!scoreRef.current) return;
        setPhase('SUBMITTING');
        setSubmitErr(null);
        try {
            const res = await axiosClient.post('/games/session', {
                game_code: '2048',
                match_id:  `2048-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                raw_score:  scoreRef.current,
            });
            setCashEarned(res.data.cash_earned);
            addBalance(parseFloat(res.data.cash_earned));
            setPhase('SUBMITTED');
        } catch (err) {
            setSubmitErr(err.response?.status === 403
                ? 'Score flagged as suspicious. No payout.'
                : err.response?.data?.error || 'Failed to submit score.');
            setPhase('OVER');
        }
    };

    // ── Touch swipe
    const onTouchStart = (e) => { const t = e.touches[0]; touchStart.current = { x: t.clientX, y: t.clientY }; };
    const onTouchEnd   = (e) => {
        if (!touchStart.current) return;
        const t  = e.changedTouches[0];
        const dx = t.clientX - touchStart.current.x;
        const dy = t.clientY - touchStart.current.y;
        touchStart.current = null;
        if (Math.abs(dx) < 20 && Math.abs(dy) < 20) return;
        if (Math.abs(dx) > Math.abs(dy)) doMove(dx > 0 ? 'right' : 'left');
        else                             doMove(dy > 0 ? 'down'  : 'up');
    };

    const showOverlay = (phase === 'WON' && !wonCont) || phase === 'OVER' || phase === 'SUBMITTING' || phase === 'SUBMITTED';

    return (
        <div className="flex h-full flex-col space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <button onClick={() => navigate('/esports')} className="mb-2 text-sm text-gray-400 hover:text-white transition">
                        ← Back to E-Sports
                    </button>
                    <h1 className="text-3xl font-bold text-white">2048</h1>
                    <p className="mt-1 text-sm text-gray-400">Merge tiles to reach 2048. Your score converts to campus cash.</p>
                </div>
                <button
                    onClick={newGame}
                    className="px-4 py-2 rounded-lg border border-gray-600 text-gray-300 hover:text-white hover:border-gray-400 text-sm font-bold transition"
                >
                    New Game
                </button>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">

                {/* ── Board ── */}
                <div className="flex-shrink-0">
                    <div
                        className="relative rounded-xl"
                        style={{ width: 364, padding: 10, background: '#0f172a', border: '1px solid #1e293b' }}
                        onTouchStart={onTouchStart}
                        onTouchEnd={onTouchEnd}
                    >
                        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 8 }}>
                            {grid.flat().map((val, i) => {
                                const s = tileStyle(val);
                                return (
                                    <div key={i} style={{
                                        width: 76, height: 76,
                                        background: s.bg,
                                        border: val === 0 ? s.border : 'none',
                                        borderRadius: 8,
                                        display: 'flex', alignItems: 'center', justifyContent: 'center',
                                        fontSize: tileFontPx(val),
                                        fontWeight: 700,
                                        color: s.fg,
                                        transition: 'background .08s',
                                    }}>
                                        {val || ''}
                                    </div>
                                );
                            })}
                        </div>

                        {/* Overlay */}
                        {showOverlay && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center gap-4 rounded-xl"
                                style={{ background: 'rgba(15,23,42,.88)', backdropFilter: 'blur(2px)' }}>

                                {phase === 'WON' && (
                                    <>
                                        <p className="text-4xl select-none">🏆</p>
                                        <p className="text-yellow-400 font-bold text-3xl">You reached 2048!</p>
                                        <div className="flex gap-3">
                                            <button onClick={cashOut} className="px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white font-bold rounded-lg transition">
                                                💰 Cash Out
                                            </button>
                                            <button onClick={keepGoing} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition">
                                                Keep Going
                                            </button>
                                        </div>
                                    </>
                                )}

                                {(phase === 'OVER' || phase === 'SUBMITTING' || phase === 'SUBMITTED') && (
                                    <>
                                        <p className="text-white font-bold text-2xl">Game Over</p>
                                        <div className="text-center">
                                            <p className="text-gray-400 text-sm">Score</p>
                                            <p className="text-blue-400 font-bold text-5xl tabular-nums">{score.toLocaleString()}</p>
                                        </div>

                                        {phase === 'SUBMITTED' && cashEarned != null && (
                                            <div className="bg-green-900/50 border border-green-600 rounded-lg px-5 py-3 text-center">
                                                <p className="text-green-300 font-bold text-lg">+Rs. {cashEarned} earned!</p>
                                                <p className="text-green-400 text-xs mt-0.5">Added to your wallet</p>
                                            </div>
                                        )}
                                        {submitErr && (
                                            <div className="bg-red-900/40 border border-red-700 rounded-lg px-4 py-3">
                                                <p className="text-red-300 text-sm">{submitErr}</p>
                                            </div>
                                        )}

                                        <div className="flex gap-3">
                                            {phase === 'OVER' && score > 0 && (
                                                <button onClick={cashOut} className="px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white font-bold rounded-lg transition">
                                                    💰 Cash Out
                                                </button>
                                            )}
                                            {phase === 'SUBMITTING' && <p className="text-gray-400 text-sm animate-pulse">Submitting…</p>}
                                            {phase !== 'SUBMITTING' && (
                                                <button onClick={newGame} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition">
                                                    {phase === 'SUBMITTED' ? 'Play Again' : 'New Game'}
                                                </button>
                                            )}
                                        </div>
                                    </>
                                )}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Side Panel ── */}
                <div className="flex flex-col gap-4 flex-1 min-w-0">

                    {/* Score cards */}
                    <div className="grid grid-cols-2 gap-4">
                        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                            <p className="text-sm text-gray-400">Score</p>
                            <p className="text-3xl font-bold text-white mt-1 tabular-nums">{score.toLocaleString()}</p>
                        </div>
                        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                            <p className="text-sm text-gray-400">Best</p>
                            <p className="text-3xl font-bold text-yellow-400 mt-1 tabular-nums">{best.toLocaleString()}</p>
                        </div>
                    </div>

                    {/* Highest tile */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                        <p className="text-sm text-gray-400 mb-2">Highest Tile</p>
                        <div style={{
                            display: 'inline-flex', alignItems: 'center', justifyContent: 'center',
                            width: 64, height: 64, borderRadius: 8,
                            background: tileStyle(maxTile(grid)).bg,
                            color: tileStyle(maxTile(grid)).fg,
                            fontSize: tileFontPx(maxTile(grid)),
                            fontWeight: 700,
                        }}>
                            {maxTile(grid)}
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                        <p className="text-sm text-gray-400 mb-3">Controls</p>
                        <div className="flex flex-col items-center gap-1.5">
                            <div className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center text-gray-200 font-bold text-sm">↑</div>
                            <div className="flex gap-1.5">
                                {['←','↓','→'].map(k => (
                                    <div key={k} className="w-10 h-10 bg-gray-700 rounded flex items-center justify-center text-gray-200 font-bold text-sm">{k}</div>
                                ))}
                            </div>
                        </div>
                        <p className="text-xs text-gray-500 text-center mt-3">Arrow keys · Swipe on mobile</p>
                    </div>

                    {/* Scoring info */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 text-sm space-y-1.5">
                        <p className="font-bold text-gray-300">How scoring works</p>
                        <p className="text-gray-400">Merging two tiles earns their sum</p>
                        <p className="text-gray-400">e.g. 256 + 256 → +512 points</p>
                        <p className="text-gray-400">Score is sent directly as raw_score</p>
                        <div className="pt-2 border-t border-gray-700 text-xs text-gray-500">
                            Fraud-resistant — scores grow logarithmically
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
