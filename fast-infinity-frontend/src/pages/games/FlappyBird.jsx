
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import axiosClient from '../../api/axiosClient';

const W = 320, H = 480, BIRD_X = 60, BIRD_R = 14;
const GRAVITY = 0.45, JUMP = -8.5, MAX_FALL = 10;
const PIPE_W = 52, PIPE_GAP = 135, PIPE_SPEED = 2.4, PIPE_INTERVAL = 1500;

function initBird() { return { y: H / 2, vy: 0 }; }

export default function FlappyBird() {
    const navigate = useNavigate();
    const { addBalance } = useStore();

    const canvasRef = useRef(null);
    const bird      = useRef(initBird());
    const pipes     = useRef([]);
    const frameRef  = useRef(null);
    const pipeTimer = useRef(null);
    const scoreRef  = useRef(0);
    const phaseRef  = useRef('IDLE');
    const lastTime  = useRef(null);

    const [phase,      setPhase]      = useState('IDLE');
    const [score,      setScore]      = useState(0);
    const [highScore,  setHighScore]  = useState(() => parseInt(localStorage.getItem('fi_flappy_hs') || '0', 10));
    const [cashEarned, setCashEarned] = useState(null);
    const [submitErr,  setSubmitErr]  = useState(null);

    const spawnPipe = useCallback(() => {
        if (phaseRef.current !== 'PLAYING') return;
        const gapY = 100 + Math.random() * (H - 200 - PIPE_GAP);
        pipes.current.push({ x: W, gapY, scored: false });
    }, []);

    const draw = useCallback(() => {
        const cv = canvasRef.current; if (!cv) return;
        const ctx = cv.getContext('2d');

        // Sky
        const sky = ctx.createLinearGradient(0, 0, 0, H);
        sky.addColorStop(0, '#0f172a');
        sky.addColorStop(1, '#1e3a5f');
        ctx.fillStyle = sky; ctx.fillRect(0, 0, W, H);

        // Stars (static seed)
        ctx.fillStyle = 'rgba(255,255,255,0.5)';
        for (let i = 0; i < 30; i++) {
            const sx = ((i * 137 + 50) % W);
            const sy = ((i * 97 + 20) % (H * 0.6));
            ctx.fillRect(sx, sy, 1.5, 1.5);
        }

        // Pipes
        pipes.current.forEach(p => {
            // Shadow
            ctx.fillStyle = 'rgba(0,0,0,0.2)';
            ctx.fillRect(p.x + 4, 0, PIPE_W, p.gapY);
            ctx.fillRect(p.x + 4, p.gapY + PIPE_GAP, PIPE_W, H);

            // Body gradient
            const pg = ctx.createLinearGradient(p.x, 0, p.x + PIPE_W, 0);
            pg.addColorStop(0, '#1d4ed8'); pg.addColorStop(0.4, '#3b82f6'); pg.addColorStop(1, '#1e40af');
            ctx.fillStyle = pg;
            ctx.fillRect(p.x, 0, PIPE_W, p.gapY);
            ctx.fillRect(p.x, p.gapY + PIPE_GAP, PIPE_W, H);

            // Cap top
            ctx.fillStyle = '#60a5fa';
            ctx.fillRect(p.x - 4, p.gapY - 16, PIPE_W + 8, 16);
            ctx.fillRect(p.x - 4, p.gapY + PIPE_GAP, PIPE_W + 8, 16);

            // Highlight stripe
            ctx.fillStyle = 'rgba(255,255,255,0.08)';
            ctx.fillRect(p.x + 6, 0, 8, p.gapY);
            ctx.fillRect(p.x + 6, p.gapY + PIPE_GAP, 8, H);
        });

        // Ground
        ctx.fillStyle = '#1e293b';
        ctx.fillRect(0, H - 24, W, 24);
        ctx.fillStyle = '#334155';
        ctx.fillRect(0, H - 24, W, 4);

        // Bird
        const b = bird.current;
        const angle = Math.min(Math.max(b.vy * 0.06, -0.4), 1.0);
        ctx.save();
        ctx.translate(BIRD_X, b.y);
        ctx.rotate(angle);

        // Glow
        ctx.shadowColor = '#fbbf24'; ctx.shadowBlur = 12;
        ctx.fillStyle = '#fbbf24';
        ctx.beginPath(); ctx.arc(0, 0, BIRD_R, 0, Math.PI * 2); ctx.fill();
        ctx.shadowBlur = 0;

        // Wing
        ctx.fillStyle = '#f59e0b';
        ctx.beginPath(); ctx.ellipse(-4, 4, 9, 5, 0.3, 0, Math.PI * 2); ctx.fill();

        // Belly
        ctx.fillStyle = '#fde68a';
        ctx.beginPath(); ctx.ellipse(2, 3, 7, 6, 0, 0, Math.PI * 2); ctx.fill();

        // Eye
        ctx.fillStyle = '#fff';
        ctx.beginPath(); ctx.arc(6, -4, 4, 0, Math.PI * 2); ctx.fill();
        ctx.fillStyle = '#1e293b';
        ctx.beginPath(); ctx.arc(7, -4, 2, 0, Math.PI * 2); ctx.fill();

        // Beak
        ctx.fillStyle = '#f97316';
        ctx.beginPath(); ctx.moveTo(12, -1); ctx.lineTo(18, 2); ctx.lineTo(12, 5); ctx.closePath(); ctx.fill();

        ctx.restore();

        // Score
        ctx.fillStyle = 'rgba(0,0,0,0.4)';
        ctx.beginPath(); ctx.roundRect(W/2 - 30, 14, 60, 32, 8); ctx.fill();
        ctx.fillStyle = '#fff'; ctx.font = 'bold 22px monospace';
        ctx.textAlign = 'center'; ctx.fillText(scoreRef.current, W / 2, 37);
    }, []);

    const endGame = useCallback(() => {
        cancelAnimationFrame(frameRef.current);
        clearInterval(pipeTimer.current);
        phaseRef.current = 'GAME_OVER';
        setPhase('GAME_OVER');
        setScore(scoreRef.current);
        const hs = parseInt(localStorage.getItem('fi_flappy_hs') || '0', 10);
        if (scoreRef.current > hs) {
            localStorage.setItem('fi_flappy_hs', String(scoreRef.current));
            setHighScore(scoreRef.current);
        }
        draw();
    }, [draw]);

    const loop = useCallback((ts) => {
        if (phaseRef.current !== 'PLAYING') return;
        if (!lastTime.current) lastTime.current = ts;
        lastTime.current = ts;

        const b = bird.current;
        b.vy = Math.min(b.vy + GRAVITY, MAX_FALL);
        b.y += b.vy;

        // Ground / ceiling
        if (b.y + BIRD_R >= H - 24 || b.y - BIRD_R <= 0) { endGame(); return; }

        // Move pipes + score
        pipes.current.forEach(p => {
            p.x -= PIPE_SPEED;
            if (!p.scored && p.x + PIPE_W < BIRD_X) {
                p.scored = true;
                scoreRef.current++;
                setScore(scoreRef.current);
            }
        });
        pipes.current = pipes.current.filter(p => p.x + PIPE_W > 0);

        // Collision
        for (const p of pipes.current) {
            if (BIRD_X + BIRD_R > p.x + 4 && BIRD_X - BIRD_R < p.x + PIPE_W) {
                if (b.y - BIRD_R < p.gapY || b.y + BIRD_R > p.gapY + PIPE_GAP) {
                    endGame(); return;
                }
            }
        }

        draw();
        frameRef.current = requestAnimationFrame(loop);
    }, [draw, endGame]);

    const flap = useCallback(() => {
        if (phaseRef.current === 'GAME_OVER' || phaseRef.current === 'SUBMITTED') return;
        if (phaseRef.current === 'IDLE') {
            // Start
            bird.current   = initBird();
            pipes.current  = [];
            scoreRef.current = 0;
            setScore(0); setCashEarned(null); setSubmitErr(null);
            phaseRef.current = 'PLAYING'; setPhase('PLAYING');
            lastTime.current = null;
            spawnPipe();
            pipeTimer.current = setInterval(spawnPipe, PIPE_INTERVAL);
            frameRef.current  = requestAnimationFrame(loop);
        }
        if (phaseRef.current === 'PLAYING') {
            bird.current.vy = JUMP;
        }
    }, [spawnPipe, loop]);

    useEffect(() => {
        const onKey = (e) => { if (e.code === 'Space' || e.code === 'ArrowUp') { e.preventDefault(); flap(); } };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [flap]);

    useEffect(() => { draw(); return () => { cancelAnimationFrame(frameRef.current); clearInterval(pipeTimer.current); }; }, [draw]);

    const handleCashOut = async () => {
        const rawScore = scoreRef.current * 100;
        if (!rawScore) return;
        setPhase('SUBMITTING');
        try {
            const res = await axiosClient.post('/games/session', {
                game_code: 'FLAPPY', match_id: `FLAPPY-${Math.random().toString(36).substring(2,10).toUpperCase()}`, raw_score: rawScore,
            });
            setCashEarned(res.data.cash_earned);
            addBalance(parseFloat(res.data.cash_earned));
            setPhase('SUBMITTED');
        } catch (err) {
            setSubmitErr(err.response?.status === 403 ? 'Score flagged as suspicious.' : err.response?.data?.error || 'Failed to submit.');
            setPhase('GAME_OVER');
        }
    };

    const restart = () => {
        cancelAnimationFrame(frameRef.current);
        clearInterval(pipeTimer.current);
        bird.current  = initBird();
        pipes.current = [];
        scoreRef.current = 0;
        setScore(0); setCashEarned(null); setSubmitErr(null);
        phaseRef.current = 'IDLE'; setPhase('IDLE');
        draw();
    };

    const isOver = phase === 'GAME_OVER' || phase === 'SUBMITTING' || phase === 'SUBMITTED';

    return (
        <div className="flex h-full flex-col space-y-6">
            <div className="flex items-start justify-between">
                <div>
                    <button onClick={() => { cancelAnimationFrame(frameRef.current); clearInterval(pipeTimer.current); navigate('/esports'); }}
                        className="mb-2 text-sm text-gray-400 hover:text-white transition">← Back to E-Sports</button>
                    <h1 className="text-3xl font-bold text-white">Flappy Bird</h1>
                    <p className="mt-1 text-sm text-gray-400">Dodge the pipes. Each pipe = 100 raw pts.</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Best</p>
                    <p className="text-2xl font-bold text-yellow-400">{highScore}</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">
                {/* Canvas */}
                <div className="flex-shrink-0">
                    <div className="relative rounded-xl overflow-hidden border border-gray-700 cursor-pointer"
                        style={{ width: W, height: H }} onClick={flap}>
                        <canvas ref={canvasRef} width={W} height={H} />

                        {phase === 'IDLE' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/80 backdrop-blur-sm gap-4">
                                <span className="text-6xl select-none">🐦</span>
                                <p className="text-white font-bold text-xl">Ready?</p>
                                <p className="text-gray-400 text-sm">Press Space or tap to flap</p>
                                <button onClick={flap} className="mt-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition">
                                    Start Game
                                </button>
                            </div>
                        )}

                        {isOver && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/88 backdrop-blur-sm gap-3 px-6">
                                <p className="text-white font-bold text-2xl">Game Over</p>
                                <div className="text-center">
                                    <p className="text-gray-400 text-sm">Pipes Cleared</p>
                                    <p className="text-blue-400 font-bold text-5xl tabular-nums">{score}</p>
                                </div>
                                <p className="text-gray-500 text-xs">Raw: {score * 100} pts</p>

                                {phase === 'SUBMITTED' && cashEarned !== null && (
                                    <div className="w-full bg-green-900/50 border border-green-600 rounded-lg px-4 py-3 text-center">
                                        <p className="text-green-300 font-bold text-lg">+Rs. {cashEarned} earned!</p>
                                        <p className="text-green-400 text-xs mt-0.5">Added to your wallet</p>
                                    </div>
                                )}
                                {submitErr && (
                                    <div className="w-full bg-red-900/40 border border-red-700 rounded-lg px-4 py-2 text-center">
                                        <p className="text-red-300 text-sm">{submitErr}</p>
                                    </div>
                                )}

                                <div className="flex gap-3 mt-1">
                                    {phase === 'GAME_OVER' && score > 0 && (
                                        <button onClick={handleCashOut} className="px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white font-bold rounded-lg transition">
                                            💰 Cash Out
                                        </button>
                                    )}
                                    {phase !== 'SUBMITTING' && (
                                        <button onClick={restart} className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition">
                                            {phase === 'SUBMITTED' ? 'Play Again' : 'Retry'}
                                        </button>
                                    )}
                                    {phase === 'SUBMITTING' && <p className="text-gray-400 text-sm animate-pulse">Submitting…</p>}
                                </div>
                            </div>
                        )}
                    </div>
                </div>

                {/* Side panel */}
                <div className="flex flex-col gap-4 flex-1 min-w-0">
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                        <p className="text-sm text-gray-400">Current Score</p>
                        <p className="text-5xl font-bold text-white mt-1 tabular-nums">{score}</p>
                        <p className="text-sm text-gray-500 mt-2">
                            ≈ <span className="text-green-400">Rs. {(score * 100 / 10).toFixed(2)}</span> if you cash out now
                        </p>
                    </div>

                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                        <p className="text-sm text-gray-400 mb-3">Controls</p>
                        <div className="space-y-2 text-sm">
                            {[['Space / ↑', 'Flap'], ['Tap / Click', 'Flap']].map(([k, v]) => (
                                <div key={k} className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-gray-700 text-gray-200 px-2 py-0.5 rounded">{k}</span>
                                    <span className="text-gray-400">{v}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 text-sm space-y-1.5">
                        <p className="font-bold text-gray-300">How scoring works</p>
                        <p className="text-gray-400">Each pipe passed = +1 score</p>
                        <p className="text-gray-400">raw_score = pipes × 100</p>
                        <p className="text-gray-400">Backend converts raw score → Rs.</p>
                    </div>
                </div>
            </div>
        </div>
    );
}
