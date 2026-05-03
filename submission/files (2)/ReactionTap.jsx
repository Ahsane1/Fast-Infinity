import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import axiosClient from '../../api/axiosClient';

// ─── Constants ───────────────────────────────────────────────────────────────
const ROUND_COUNT   = 10;   // targets per session
const TARGET_MS     = 1800; // how long a target stays visible (ms)
const COUNTDOWN_SEC = 3;

// raw_score = sum of reaction_score per hit
// reaction_score per hit = floor(1000 / reaction_time_seconds)  capped at 500
const MAX_SCORE_PER_HIT = 500;
const RAW_SCORE_CAP     = ROUND_COUNT * MAX_SCORE_PER_HIT; // 5000

// Grid for target placement (avoid edges)
const GRID_COLS = 4;
const GRID_ROWS = 4;

function randomCell(exclude) {
    const cells = [];
    for (let r = 0; r < GRID_ROWS; r++)
        for (let c = 0; c < GRID_COLS; c++)
            if (!exclude || !(exclude.r === r && exclude.c === c))
                cells.push({ r, c });
    return cells[Math.floor(Math.random() * cells.length)];
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function ReactionTap() {
    const navigate      = useNavigate();
    const { addBalance } = useStore();

    // ── UI state ──────────────────────────────────────────────────────────────
    const [phase,       setPhase]       = useState('IDLE');
    // IDLE | COUNTDOWN | PLAYING | RESULT | SUBMITTING | SUBMITTED
    const [countdown,   setCountdown]   = useState(COUNTDOWN_SEC);
    const [round,       setRound]       = useState(0);           // 0-based index
    const [target,      setTarget]      = useState(null);        // { r, c, id }
    const [feedback,    setFeedback]    = useState(null);        // { hit, ms } | 'miss'
    const [results,     setResults]     = useState([]);          // per-round { hit, ms, score }
    const [totalScore,  setTotalScore]  = useState(0);
    const [highScore,   setHighScore]   = useState(() =>
        parseInt(localStorage.getItem('fi_reaction_hs') || '0', 10));
    const [cashEarned,  setCashEarned]  = useState(null);
    const [submitError, setSubmitError] = useState(null);
    const [targetAnim,  setTargetAnim]  = useState(false); // pulse trigger

    // ── Refs ──────────────────────────────────────────────────────────────────
    const phaseRef      = useRef('IDLE');
    const roundRef      = useRef(0);
    const targetRef     = useRef(null);
    const spawnTimeRef  = useRef(null);
    const resultsRef    = useRef([]);
    const totalScoreRef = useRef(0);
    const expireRef     = useRef(null);
    const cdRef         = useRef(null);
    const lastCellRef   = useRef(null);

    // ── Spawn next target ─────────────────────────────────────────────────────
    const spawnTarget = useCallback(() => {
        clearTimeout(expireRef.current);
        const cell = randomCell(lastCellRef.current);
        lastCellRef.current = cell;
        const id = Math.random();
        const t  = { ...cell, id };
        targetRef.current  = t;
        spawnTimeRef.current = performance.now();
        setTarget(t);
        setTargetAnim(false);
        // Tiny delay so CSS transition triggers fresh each spawn
        requestAnimationFrame(() => setTargetAnim(true));

        expireRef.current = setTimeout(() => {
            if (targetRef.current?.id !== id) return;
            // Miss
            targetRef.current = null;
            setTarget(null);
            setFeedback('miss');
            resultsRef.current.push({ hit: false, ms: null, score: 0 });
            setResults([...resultsRef.current]);
            setTimeout(() => setFeedback(null), 600);
            advanceRound();
        }, TARGET_MS);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const advanceRound = useCallback(() => {
        const next = roundRef.current + 1;
        roundRef.current = next;
        setRound(next);
        if (next >= ROUND_COUNT) {
            // End game
            clearTimeout(expireRef.current);
            phaseRef.current = 'RESULT';
            setPhase('RESULT');
            const final = totalScoreRef.current;
            const stored = parseInt(localStorage.getItem('fi_reaction_hs') || '0', 10);
            if (final > stored) {
                localStorage.setItem('fi_reaction_hs', String(final));
                setHighScore(final);
            }
        } else {
            // Short gap then next target
            setTimeout(spawnTarget, 400 + Math.random() * 600);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spawnTarget]);

    // ── Handle tap on target ──────────────────────────────────────────────────
    const handleTap = useCallback((e) => {
        e.stopPropagation();
        if (phaseRef.current !== 'PLAYING') return;
        if (!targetRef.current) return;

        clearTimeout(expireRef.current);
        const ms    = Math.round(performance.now() - spawnTimeRef.current);
        const score = Math.max(50, Math.floor(MAX_SCORE_PER_HIT / (ms / 1000)));
        const capped = Math.min(score, MAX_SCORE_PER_HIT);

        targetRef.current = null;
        setTarget(null);
        totalScoreRef.current += capped;
        setTotalScore(totalScoreRef.current);
        setFeedback({ hit: true, ms, score: capped });
        resultsRef.current.push({ hit: true, ms, score: capped });
        setResults([...resultsRef.current]);
        setTimeout(() => setFeedback(null), 700);
        advanceRound();
    }, [advanceRound]);

    // ── Tap on background = penalty miss ─────────────────────────────────────
    const handleBgTap = useCallback(() => {
        if (phaseRef.current !== 'PLAYING') return;
        if (targetRef.current) return; // target is showing, ignore bg tap
        // Mis-tap while no target: no penalty, just ignore
    }, []);

    // ── Start countdown → game ────────────────────────────────────────────────
    const startGame = useCallback(() => {
        clearTimeout(expireRef.current);
        clearInterval(cdRef.current);

        roundRef.current      = 0;
        resultsRef.current    = [];
        totalScoreRef.current = 0;
        lastCellRef.current   = null;

        setRound(0);
        setResults([]);
        setTotalScore(0);
        setTarget(null);
        setFeedback(null);
        setCashEarned(null);
        setSubmitError(null);
        setCountdown(COUNTDOWN_SEC);
        phaseRef.current = 'COUNTDOWN';
        setPhase('COUNTDOWN');

        let cd = COUNTDOWN_SEC;
        cdRef.current = setInterval(() => {
            cd--;
            setCountdown(cd);
            if (cd <= 0) {
                clearInterval(cdRef.current);
                phaseRef.current = 'PLAYING';
                setPhase('PLAYING');
                setTimeout(spawnTarget, 300);
            }
        }, 1000);
    }, [spawnTarget]);

    // ── Cleanup ───────────────────────────────────────────────────────────────
    useEffect(() => {
        return () => {
            clearTimeout(expireRef.current);
            clearInterval(cdRef.current);
        };
    }, []);

    // ── Submit score ──────────────────────────────────────────────────────────
    const handleCashOut = async () => {
        const rawScore = totalScoreRef.current;
        if (rawScore === 0) return;

        setPhase('SUBMITTING');
        setSubmitError(null);

        try {
            const matchId  = `REACTION-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            const response = await axiosClient.post('/games/session', {
                game_code: 'REACTION',
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
            setPhase('RESULT');
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const hits     = results.filter(r => r.hit);
    const accuracy = results.length ? Math.round((hits.length / results.length) * 100) : 0;
    const avgMs    = hits.length
        ? Math.round(hits.reduce((a, r) => a + r.ms, 0) / hits.length)
        : null;

    const ratingLabel = (score) => {
        if (score >= 4500) return { text: 'Superhuman',  cls: 'text-yellow-300' };
        if (score >= 3500) return { text: 'Elite',       cls: 'text-purple-300' };
        if (score >= 2500) return { text: 'Sharp',       cls: 'text-blue-300'   };
        if (score >= 1500) return { text: 'Average',     cls: 'text-gray-300'   };
        return                    { text: 'Keep Trying', cls: 'text-gray-500'   };
    };

    const isOver = phase === 'RESULT' || phase === 'SUBMITTING' || phase === 'SUBMITTED';

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-full flex-col space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <button
                        onClick={() => { clearTimeout(expireRef.current); clearInterval(cdRef.current); navigate('/esports'); }}
                        className="mb-2 text-sm text-gray-400 hover:text-white transition"
                    >
                        ← Back to E-Sports
                    </button>
                    <h1 className="text-3xl font-bold text-white">Reaction Tap</h1>
                    <p className="mt-1 text-sm text-gray-400">
                        Tap the target the instant it appears. Speed = score.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Best</p>
                    <p className="text-2xl font-bold text-yellow-400">{highScore.toLocaleString()}</p>
                </div>
            </div>

            {/* Main layout */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* ── Game arena ── */}
                <div className="flex-shrink-0">
                    <div
                        className="relative rounded-xl border border-gray-700 bg-gray-900 overflow-hidden select-none"
                        style={{ width: 320, height: 380 }}
                        onClick={handleBgTap}
                    >
                        {/* Progress bar */}
                        <div className="absolute top-0 left-0 right-0 h-1 bg-gray-800 z-10">
                            <div
                                className="h-full bg-blue-500 transition-all duration-300"
                                style={{ width: `${(Math.min(round, ROUND_COUNT) / ROUND_COUNT) * 100}%` }}
                            />
                        </div>

                        {/* Subtle grid dots */}
                        <div
                            className="absolute inset-0 opacity-10"
                            style={{
                                backgroundImage: 'radial-gradient(circle, #94a3b8 1px, transparent 1px)',
                                backgroundSize: `${320 / GRID_COLS}px ${380 / GRID_ROWS}px`,
                            }}
                        />

                        {/* Target */}
                        {target && phase === 'PLAYING' && (() => {
                            const cellW = 320 / GRID_COLS;
                            const cellH = 380 / GRID_ROWS;
                            const cx    = target.c * cellW + cellW / 2;
                            const cy    = target.r * cellH + cellH / 2;
                            return (
                                <button
                                    key={target.id}
                                    onClick={handleTap}
                                    className="absolute focus:outline-none"
                                    style={{
                                        left:      cx - 36,
                                        top:       cy - 36,
                                        width:     72,
                                        height:    72,
                                        zIndex:    20,
                                    }}
                                >
                                    {/* Ripple ring */}
                                    <span
                                        className="absolute inset-0 rounded-full border-2 border-blue-400"
                                        style={{
                                            animation: 'reactionRipple 1.8s linear forwards',
                                        }}
                                    />
                                    {/* Main circle */}
                                    <span
                                        className="absolute inset-2 rounded-full bg-blue-500 shadow-lg flex items-center justify-center"
                                        style={{
                                            boxShadow: '0 0 24px rgba(59,130,246,0.7)',
                                            animation: targetAnim ? 'reactionPop 0.15s ease-out forwards' : 'none',
                                        }}
                                    >
                                        <span className="text-white font-black text-lg leading-none">!</span>
                                    </span>
                                </button>
                            );
                        })()}

                        {/* Feedback flash */}
                        {feedback && feedback !== 'miss' && (
                            <div
                                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                                style={{ animation: 'reactionFade 0.7s ease-out forwards' }}
                            >
                                <div className="flex flex-col items-center gap-1">
                                    <span className="text-2xl font-black text-green-400">
                                        +{feedback.score}
                                    </span>
                                    <span className="text-xs text-gray-400 font-mono">
                                        {feedback.ms}ms
                                    </span>
                                </div>
                            </div>
                        )}
                        {feedback === 'miss' && (
                            <div
                                className="absolute inset-0 flex items-center justify-center pointer-events-none z-30"
                                style={{ animation: 'reactionFade 0.6s ease-out forwards' }}
                            >
                                <span className="text-2xl font-black text-red-400">MISS</span>
                            </div>
                        )}

                        {/* Round counter (top-right) */}
                        {phase === 'PLAYING' && (
                            <div className="absolute top-4 right-4 z-10 text-xs text-gray-500 font-mono tabular-nums">
                                {Math.min(round + 1, ROUND_COUNT)}/{ROUND_COUNT}
                            </div>
                        )}

                        {/* IDLE overlay */}
                        {phase === 'IDLE' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 gap-4 z-40">
                                <span className="text-5xl select-none">⚡</span>
                                <p className="text-white font-bold text-xl">Reaction Tap</p>
                                <p className="text-gray-400 text-sm text-center px-8">
                                    {ROUND_COUNT} targets appear one at a time.<br />
                                    Tap each one as fast as you can.
                                </p>
                                <button
                                    onClick={startGame}
                                    className="mt-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                                >
                                    Start Game
                                </button>
                            </div>
                        )}

                        {/* COUNTDOWN overlay */}
                        {phase === 'COUNTDOWN' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/90 gap-2 z-40">
                                <p className="text-gray-400 text-sm uppercase tracking-widest">Get ready…</p>
                                <p
                                    key={countdown}
                                    className="text-8xl font-black text-blue-400"
                                    style={{ animation: 'reactionPop 0.3s ease-out forwards' }}
                                >
                                    {countdown}
                                </p>
                            </div>
                        )}

                        {/* RESULT / SUBMIT overlay */}
                        {isOver && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/92 gap-3 px-6 z-40">
                                {(() => {
                                    const r = ratingLabel(totalScore);
                                    return (
                                        <>
                                            <p className={`text-2xl font-black ${r.cls}`}>{r.text}</p>
                                            <div className="text-center">
                                                <p className="text-gray-400 text-sm">Score</p>
                                                <p className="text-blue-400 font-bold text-5xl tabular-nums">
                                                    {totalScore.toLocaleString()}
                                                </p>
                                            </div>
                                            <div className="flex gap-6 text-center text-sm">
                                                <div>
                                                    <p className="text-gray-500">Accuracy</p>
                                                    <p className="text-white font-bold">{accuracy}%</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500">Avg Time</p>
                                                    <p className="text-white font-bold">{avgMs ? `${avgMs}ms` : '—'}</p>
                                                </div>
                                                <div>
                                                    <p className="text-gray-500">Hits</p>
                                                    <p className="text-white font-bold">{hits.length}/{ROUND_COUNT}</p>
                                                </div>
                                            </div>

                                            {phase === 'SUBMITTED' && cashEarned !== null && (
                                                <div className="w-full bg-green-900/50 border border-green-600 rounded-lg px-4 py-3 text-center">
                                                    <p className="text-green-300 font-bold text-lg">+Rs. {cashEarned} earned!</p>
                                                    <p className="text-green-400 text-xs mt-0.5">Added to your wallet</p>
                                                </div>
                                            )}
                                            {submitError && (
                                                <div className="w-full bg-red-900/40 border border-red-700 rounded-lg px-4 py-2 text-center">
                                                    <p className="text-red-300 text-sm">{submitError}</p>
                                                </div>
                                            )}

                                            <div className="flex gap-3 mt-1">
                                                {phase === 'RESULT' && totalScore > 0 && (
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
                                        </>
                                    );
                                })()}
                            </div>
                        )}
                    </div>
                </div>

                {/* ── Side Panel ── */}
                <div className="flex flex-col gap-4 flex-1 min-w-0">

                    {/* Live score */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                        <p className="text-sm text-gray-400">Current Score</p>
                        <p className="text-5xl font-bold text-white mt-1 tabular-nums">{totalScore.toLocaleString()}</p>
                        <p className="text-sm text-gray-500 mt-2">
                            ≈ <span className="text-green-400">Rs. {(totalScore / 1000).toFixed(2)}</span> if you cash out now
                        </p>
                    </div>

                    {/* Round history */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                        <p className="text-sm text-gray-400 mb-3">Round History</p>
                        <div className="grid grid-cols-5 gap-2">
                            {Array.from({ length: ROUND_COUNT }).map((_, i) => {
                                const r = results[i];
                                return (
                                    <div
                                        key={i}
                                        className={`h-10 rounded-lg flex flex-col items-center justify-center text-xs font-bold transition-all ${
                                            !r
                                                ? 'bg-gray-700 text-gray-600'
                                                : r.hit
                                                    ? 'bg-blue-900/60 border border-blue-700 text-blue-300'
                                                    : 'bg-red-900/40 border border-red-800 text-red-400'
                                        }`}
                                    >
                                        {!r && <span className="text-gray-600">{i + 1}</span>}
                                        {r && r.hit && <span>{r.score}</span>}
                                        {r && !r.hit && <span>✕</span>}
                                    </div>
                                );
                            })}
                        </div>
                    </div>

                    {/* How it works */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 text-sm space-y-1.5">
                        <p className="font-bold text-gray-300">How scoring works</p>
                        <p className="text-gray-400">Tap the blue circle the instant it appears</p>
                        <p className="text-gray-400">Score per hit = 500 ÷ reaction_time (seconds)</p>
                        <p className="text-gray-400">Minimum 50 pts · max 500 pts per tap</p>
                        <p className="text-gray-400">Miss = 0 pts for that round</p>
                        <div className="pt-2 border-t border-gray-700 text-xs text-gray-500 space-y-0.5">
                            <p>10 rounds per session · raw score → Rs. via backend</p>
                            <p>Max possible raw score: {RAW_SCORE_CAP.toLocaleString()} pts</p>
                        </div>
                    </div>

                    {/* Rating scale */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 text-sm">
                        <p className="font-bold text-gray-300 mb-2">Rating Scale</p>
                        <div className="space-y-1.5">
                            {[
                                ['4500+', 'Superhuman', 'text-yellow-300'],
                                ['3500+', 'Elite',       'text-purple-300'],
                                ['2500+', 'Sharp',       'text-blue-300'],
                                ['1500+', 'Average',     'text-gray-300'],
                                ['<1500', 'Keep Trying', 'text-gray-500'],
                            ].map(([pts, label, cls]) => (
                                <div key={label} className="flex items-center justify-between">
                                    <span className={`font-bold ${cls}`}>{label}</span>
                                    <span className="text-gray-500 font-mono text-xs">{pts}</span>
                                </div>
                            ))}
                        </div>
                    </div>
                </div>
            </div>

            {/* CSS animations injected once */}
            <style>{`
                @keyframes reactionRipple {
                    0%   { transform: scale(1);   opacity: 0.9; }
                    100% { transform: scale(1.9); opacity: 0;   }
                }
                @keyframes reactionPop {
                    0%   { transform: scale(0.6); opacity: 0; }
                    60%  { transform: scale(1.1); opacity: 1; }
                    100% { transform: scale(1);   opacity: 1; }
                }
                @keyframes reactionFade {
                    0%   { opacity: 1; transform: translateY(0);    }
                    100% { opacity: 0; transform: translateY(-20px); }
                }
            `}</style>
        </div>
    );
}
