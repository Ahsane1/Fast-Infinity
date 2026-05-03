import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import axiosClient from '../../api/axiosClient';

// ─── Config ───────────────────────────────────────────────────────────────────
const QUESTIONS_PER_LEVEL = 5;
const MAX_LEVEL           = 8;
const TIME_PER_Q          = 8;   // seconds per question (reduces with level)

// Generate a question for a given level
function makeQuestion(level) {
    const r = (min, max) => Math.floor(Math.random() * (max - min + 1)) + min;

    if (level <= 2) {
        // Addition / subtraction, small numbers
        const a = r(1, 20 + level * 5);
        const b = r(1, 20 + level * 5);
        const op = Math.random() < 0.5 ? '+' : '-';
        const [x, y] = op === '-' && b > a ? [b, a] : [a, b];
        return { question: `${x} ${op} ${y}`, answer: op === '+' ? x + y : x - y };
    }
    if (level <= 4) {
        // Add multiplication
        const ops = ['+', '-', '×'];
        const op  = ops[r(0, ops.length - 1)];
        if (op === '×') {
            const a = r(2, 5 + level);
            const b = r(2, 5 + level);
            return { question: `${a} × ${b}`, answer: a * b };
        }
        const a = r(10, 50 + level * 10);
        const b = r(1,  30 + level * 5);
        const [x, y] = op === '-' && b > a ? [b, a] : [a, b];
        return { question: `${x} ${op} ${y}`, answer: op === '+' ? x + y : x - y };
    }
    if (level <= 6) {
        // Add division, larger numbers
        const ops = ['+', '-', '×', '÷'];
        const op  = ops[r(0, ops.length - 1)];
        if (op === '×') { const a = r(3, 12); const b = r(3, 12); return { question: `${a} × ${b}`, answer: a * b }; }
        if (op === '÷') { const b = r(2, 12); const a = b * r(2, 12); return { question: `${a} ÷ ${b}`, answer: a / b }; }
        const a = r(20, 100 + level * 10);
        const b = r(10, 80 + level * 5);
        const [x, y] = op === '-' && b > a ? [b, a] : [a, b];
        return { question: `${x} ${op} ${y}`, answer: op === '+' ? x + y : x - y };
    }
    // Level 7-8: mixed hard
    const ops = ['+', '-', '×', '÷'];
    const op  = ops[r(0, 3)];
    if (op === '×') { const a = r(6, 20); const b = r(6, 20); return { question: `${a} × ${b}`, answer: a * b }; }
    if (op === '÷') { const b = r(3, 15); const a = b * r(3, 15); return { question: `${a} ÷ ${b}`, answer: a / b }; }
    const a = r(50, 200 + level * 15);
    const b = r(20, 150 + level * 10);
    const [x, y] = op === '-' && b > a ? [b, a] : [a, b];
    return { question: `${x} ${op} ${y}`, answer: op === '+' ? x + y : x - y };
}

// ─── Component ────────────────────────────────────────────────────────────────
export default function MathBlaster() {
    const navigate = useNavigate();
    const { addBalance } = useStore();

    const [phase,       setPhase]       = useState('IDLE');
    // IDLE | PLAYING | LEVEL_UP | GAME_OVER | SUBMITTING | SUBMITTED
    const [level,       setLevel]       = useState(1);
    const [qIndex,      setQIndex]      = useState(0);   // 0..QUESTIONS_PER_LEVEL-1
    const [question,    setQuestion]    = useState(null);
    const [input,       setInput]       = useState('');
    const [timeLeft,    setTimeLeft]    = useState(TIME_PER_Q);
    const [correct,     setCorrect]     = useState(0);
    const [totalScore,  setTotalScore]  = useState(0);
    const [feedback,    setFeedback]    = useState(null); // 'correct'|'wrong'|'timeout'
    const [highScore,   setHighScore]   = useState(() => parseInt(localStorage.getItem('fi_math_hs') || '0', 10));
    const [cashEarned,  setCashEarned]  = useState(null);
    const [submitErr,   setSubmitErr]   = useState(null);
    const [history,     setHistory]     = useState([]);  // { correct, question, answer, given }

    const phaseRef    = useRef('IDLE');
    const levelRef    = useRef(1);
    const qIndexRef   = useRef(0);
    const correctRef  = useRef(0);
    const scoreRef    = useRef(0);
    const questionRef = useRef(null);
    const timerRef    = useRef(null);
    const tickRef     = useRef(null);
    const inputRef    = useRef(null);

    const timeForLevel = (lvl) => Math.max(4, TIME_PER_Q - Math.floor(lvl / 2));

    // ── Next question ─────────────────────────────────────────────────────────
    const nextQuestion = useCallback((lvl, qi) => {
        clearInterval(timerRef.current);
        const q    = makeQuestion(lvl);
        const secs = timeForLevel(lvl);
        questionRef.current = q;
        setQuestion(q);
        setInput('');
        setFeedback(null);
        setTimeLeft(secs);
        setQIndex(qi);
        inputRef.current?.focus();

        let remaining = secs;
        tickRef.current = remaining;
        timerRef.current = setInterval(() => {
            remaining--;
            tickRef.current = remaining;
            setTimeLeft(remaining);
            if (remaining <= 0) {
                clearInterval(timerRef.current);
                handleTimeout();
            }
        }, 1000);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    const handleTimeout = useCallback(() => {
        if (phaseRef.current !== 'PLAYING') return;
        const q = questionRef.current;
        setFeedback('timeout');
        setHistory(h => [...h, { correct: false, question: q.question, answer: q.answer, given: '—' }]);
        setTimeout(() => advance(false), 900);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Advance after answer ──────────────────────────────────────────────────
    const advance = useCallback((wasCorrect) => {
        clearInterval(timerRef.current);
        if (phaseRef.current !== 'PLAYING') return;

        const newCorrect = correctRef.current + (wasCorrect ? 1 : 0);
        correctRef.current = newCorrect;
        setCorrect(newCorrect);

        if (wasCorrect) {
            const pts = levelRef.current;
            scoreRef.current += pts;
            setTotalScore(scoreRef.current);
        }

        const nextQi = qIndexRef.current + 1;
        qIndexRef.current = nextQi;

        if (nextQi >= QUESTIONS_PER_LEVEL) {
            // Level complete
            const nextLvl = levelRef.current + 1;
            if (nextLvl > MAX_LEVEL) {
                // Game complete — all levels done
                endGame();
            } else {
                phaseRef.current = 'LEVEL_UP';
                setPhase('LEVEL_UP');
                levelRef.current = nextLvl;
                setLevel(nextLvl);
                correctRef.current = 0;
                setCorrect(0);
                qIndexRef.current = 0;
            }
        } else {
            setFeedback(null);
            nextQuestion(levelRef.current, nextQi);
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [nextQuestion]);

    const endGame = useCallback(() => {
        clearInterval(timerRef.current);
        phaseRef.current = 'GAME_OVER';
        setPhase('GAME_OVER');
        const final  = scoreRef.current;
        const stored = parseInt(localStorage.getItem('fi_math_hs') || '0', 10);
        if (final > stored) { localStorage.setItem('fi_math_hs', String(final)); setHighScore(final); }
    }, []);

    // ── Submit answer ─────────────────────────────────────────────────────────
    const submitAnswer = useCallback(() => {
        if (phaseRef.current !== 'PLAYING') return;
        clearInterval(timerRef.current);
        const q       = questionRef.current;
        const given   = parseFloat(input.trim());
        const correct = !isNaN(given) && given === q.answer;
        setFeedback(correct ? 'correct' : 'wrong');
        setHistory(h => [...h, { correct, question: q.question, answer: q.answer, given: input.trim() || '—' }]);
        setTimeout(() => advance(correct), 650);
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [input, advance]);

    const onKey = useCallback((e) => {
        if (e.key === 'Enter' && phaseRef.current === 'PLAYING') { e.preventDefault(); submitAnswer(); }
    }, [submitAnswer]);

    // ── Start / restart ───────────────────────────────────────────────────────
    const startGame = useCallback(() => {
        clearInterval(timerRef.current);
        levelRef.current   = 1;
        qIndexRef.current  = 0;
        correctRef.current = 0;
        scoreRef.current   = 0;
        setLevel(1); setQIndex(0); setCorrect(0); setTotalScore(0);
        setHistory([]); setCashEarned(null); setSubmitErr(null);
        phaseRef.current = 'PLAYING';
        setPhase('PLAYING');
        nextQuestion(1, 0);
    }, [nextQuestion]);

    const continueToNextLevel = useCallback(() => {
        phaseRef.current = 'PLAYING';
        setPhase('PLAYING');
        nextQuestion(levelRef.current, 0);
    }, [nextQuestion]);

    useEffect(() => () => clearInterval(timerRef.current), []);

    // ── Cash out ──────────────────────────────────────────────────────────────
    const handleCashOut = async () => {
        const rawScore = scoreRef.current;
        if (!rawScore) return;
        setPhase('SUBMITTING');
        try {
            const res = await axiosClient.post('/games/session', {
                game_code: 'MATH',
                match_id:  `MATH-${Math.random().toString(36).substring(2, 10).toUpperCase()}`,
                raw_score: rawScore,
            });
            setCashEarned(res.data.cash_earned);
            addBalance(parseFloat(res.data.cash_earned));
            setPhase('SUBMITTED');
        } catch (err) {
            setSubmitErr(err.response?.status === 403 ? 'Score flagged as suspicious.' : err.response?.data?.error || 'Failed to submit.');
            setPhase('GAME_OVER');
        }
    };

    // ── Helpers ───────────────────────────────────────────────────────────────
    const isOver    = phase === 'GAME_OVER' || phase === 'SUBMITTING' || phase === 'SUBMITTED';
    const timeFrac  = question ? timeLeft / timeForLevel(level) : 1;
    const timerColor = timeFrac > 0.5 ? '#3b82f6' : timeFrac > 0.25 ? '#f59e0b' : '#ef4444';

    const ratingLabel = (s) => {
        if (s >= 60) return { text: 'Genius',      cls: 'text-yellow-300' };
        if (s >= 40) return { text: 'Sharp',        cls: 'text-purple-300' };
        if (s >= 20) return { text: 'Solid',        cls: 'text-blue-300'   };
        if (s >= 8)  return { text: 'Getting There', cls: 'text-gray-300'  };
        return              { text: 'Keep Practicing', cls: 'text-gray-500' };
    };

    // ── Render ────────────────────────────────────────────────────────────────
    return (
        <div className="flex h-full flex-col space-y-6">

            {/* Header */}
            <div className="flex items-start justify-between">
                <div>
                    <button onClick={() => { clearInterval(timerRef.current); navigate('/esports'); }}
                        className="mb-2 text-sm text-gray-400 hover:text-white transition">← Back to E-Sports</button>
                    <h1 className="text-3xl font-bold text-white">Math Blaster</h1>
                    <p className="mt-1 text-sm text-gray-400">Answer fast. Difficulty ramps up each level.</p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Best</p>
                    <p className="text-2xl font-bold text-yellow-400">{highScore}</p>
                </div>
            </div>

            <div className="flex flex-col lg:flex-row gap-6">

                {/* ── Game area ── */}
                <div className="flex-shrink-0 flex flex-col gap-4" style={{ width: 340 }}>

                    {/* Progress: level dots */}
                    <div className="flex items-center gap-1.5">
                        {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                            <div key={i} className={`h-2 flex-1 rounded-full transition-all duration-300 ${
                                i + 1 < level  ? 'bg-blue-500' :
                                i + 1 === level ? 'bg-blue-400 animate-pulse' :
                                'bg-gray-700'
                            }`} />
                        ))}
                    </div>
                    <div className="flex justify-between text-xs text-gray-500">
                        <span>Level {level} / {MAX_LEVEL}</span>
                        <span>Q {Math.min(qIndex + 1, QUESTIONS_PER_LEVEL)} / {QUESTIONS_PER_LEVEL}</span>
                    </div>

                    {/* Question card */}
                    <div className={`relative rounded-2xl border bg-gray-800 p-8 flex flex-col items-center gap-6 transition-all duration-200 ${
                        feedback === 'correct' ? 'border-green-500 bg-green-900/20' :
                        feedback === 'wrong' || feedback === 'timeout' ? 'border-red-500 bg-red-900/20' :
                        'border-gray-700'
                    }`}>

                        {/* Timer bar */}
                        {phase === 'PLAYING' && (
                            <div className="absolute top-0 left-0 right-0 h-1 rounded-t-2xl bg-gray-700 overflow-hidden">
                                <div className="h-full transition-all duration-1000 ease-linear rounded-t-2xl"
                                    style={{ width: `${timeFrac * 100}%`, backgroundColor: timerColor }} />
                            </div>
                        )}

                        {/* IDLE state */}
                        {phase === 'IDLE' && (
                            <div className="flex flex-col items-center gap-4 py-4">
                                <span className="text-5xl">🔢</span>
                                <p className="text-white font-bold text-xl">Math Blaster</p>
                                <p className="text-gray-400 text-sm text-center">
                                    {MAX_LEVEL} levels · {QUESTIONS_PER_LEVEL} questions each<br/>
                                    raw_score = correct × level
                                </p>
                                <button onClick={startGame}
                                    className="mt-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition">
                                    Start Game
                                </button>
                            </div>
                        )}

                        {/* LEVEL UP state */}
                        {phase === 'LEVEL_UP' && (
                            <div className="flex flex-col items-center gap-4 py-4">
                                <span className="text-5xl">🎯</span>
                                <p className="text-white font-bold text-2xl">Level {level - 1} Done!</p>
                                <p className="text-gray-400 text-sm text-center">
                                    Next up: Level {level}<br/>
                                    <span className="text-blue-300">+{level} pts per correct answer</span>
                                </p>
                                <button onClick={continueToNextLevel}
                                    className="mt-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition">
                                    Continue →
                                </button>
                            </div>
                        )}

                        {/* PLAYING state */}
                        {phase === 'PLAYING' && question && (
                            <>
                                {/* Feedback flash */}
                                {feedback && (
                                    <div className={`absolute inset-0 flex items-center justify-center rounded-2xl pointer-events-none z-10 ${
                                        feedback === 'correct' ? 'bg-green-500/10' : 'bg-red-500/10'
                                    }`}>
                                        <span className={`text-4xl font-black ${
                                            feedback === 'correct' ? 'text-green-400' :
                                            feedback === 'timeout' ? 'text-orange-400' : 'text-red-400'
                                        }`}>
                                            {feedback === 'correct' ? '✓' : feedback === 'timeout' ? 'TIME!' : '✗'}
                                        </span>
                                    </div>
                                )}

                                {/* Timer number */}
                                <div className="self-end">
                                    <span className={`text-2xl font-black tabular-nums ${
                                        timeLeft <= 2 ? 'text-red-400 animate-pulse' :
                                        timeLeft <= 4 ? 'text-yellow-400' : 'text-gray-400'
                                    }`}>{timeLeft}s</span>
                                </div>

                                {/* Question */}
                                <div className="text-center">
                                    <p className="text-5xl font-black text-white tracking-tight">{question.question}</p>
                                    <p className="text-gray-500 text-sm mt-2">= ?</p>
                                </div>

                                {/* Input */}
                                <div className="flex gap-2 w-full">
                                    <input
                                        ref={inputRef}
                                        type="number"
                                        value={input}
                                        onChange={e => setInput(e.target.value)}
                                        onKeyDown={onKey}
                                        placeholder="Your answer…"
                                        className="flex-1 bg-gray-700 border border-gray-600 focus:border-blue-500 rounded-lg px-4 py-3 text-white text-xl font-bold text-center outline-none tabular-nums transition"
                                        autoComplete="off"
                                        disabled={!!feedback}
                                    />
                                    <button
                                        onClick={submitAnswer}
                                        disabled={!!feedback || !input.trim()}
                                        className="px-5 py-3 bg-blue-600 hover:bg-blue-500 disabled:opacity-40 disabled:cursor-not-allowed text-white font-bold rounded-lg transition"
                                    >→</button>
                                </div>

                                {/* Hint: wrong answer reveal */}
                                {feedback === 'wrong' && (
                                    <p className="text-sm text-gray-400">
                                        Answer was <span className="text-white font-bold">{question.answer}</span>
                                    </p>
                                )}
                                {feedback === 'timeout' && (
                                    <p className="text-sm text-gray-400">
                                        Time's up! Answer was <span className="text-white font-bold">{question.answer}</span>
                                    </p>
                                )}
                            </>
                        )}

                        {/* GAME OVER / SUBMIT */}
                        {isOver && (() => {
                            const r = ratingLabel(totalScore);
                            return (
                                <div className="flex flex-col items-center gap-3 py-2 w-full">
                                    <p className={`text-2xl font-black ${r.cls}`}>{r.text}</p>
                                    <div className="text-center">
                                        <p className="text-gray-400 text-sm">Raw Score</p>
                                        <p className="text-blue-400 font-bold text-5xl tabular-nums">{totalScore}</p>
                                    </div>
                                    <div className="flex gap-6 text-center text-sm">
                                        <div>
                                            <p className="text-gray-500">Correct</p>
                                            <p className="text-white font-bold">{history.filter(h => h.correct).length}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Total Qs</p>
                                            <p className="text-white font-bold">{history.length}</p>
                                        </div>
                                        <div>
                                            <p className="text-gray-500">Accuracy</p>
                                            <p className="text-white font-bold">
                                                {history.length ? Math.round(history.filter(h => h.correct).length / history.length * 100) : 0}%
                                            </p>
                                        </div>
                                    </div>

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
                                        {phase === 'GAME_OVER' && totalScore > 0 && (
                                            <button onClick={handleCashOut}
                                                className="px-5 py-2.5 bg-green-700 hover:bg-green-600 text-white font-bold rounded-lg transition">
                                                💰 Cash Out
                                            </button>
                                        )}
                                        {phase !== 'SUBMITTING' && (
                                            <button onClick={startGame}
                                                className="px-5 py-2.5 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition">
                                                {phase === 'SUBMITTED' ? 'Play Again' : 'Retry'}
                                            </button>
                                        )}
                                        {phase === 'SUBMITTING' && <p className="text-gray-400 text-sm animate-pulse">Submitting…</p>}
                                    </div>
                                </div>
                            );
                        })()}
                    </div>

                    {/* Mobile numpad */}
                    {phase === 'PLAYING' && (
                        <div className="grid grid-cols-3 gap-2">
                            {[7,8,9,4,5,6,1,2,3].map(n => (
                                <button key={n} onClick={() => setInput(i => i + String(n))}
                                    className="h-12 rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white text-xl font-bold transition select-none">
                                    {n}
                                </button>
                            ))}
                            <button onClick={() => setInput(i => i === '-' || i === '' ? (i === '-' ? '' : '-') : i)}
                                className="h-12 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold transition select-none">±</button>
                            <button onClick={() => setInput(i => i + '0')}
                                className="h-12 rounded-lg bg-gray-700 hover:bg-gray-600 text-white text-xl font-bold transition select-none">0</button>
                            <button onClick={() => setInput(i => i.slice(0, -1))}
                                className="h-12 rounded-lg bg-gray-700 hover:bg-gray-600 text-orange-300 text-xl font-bold transition select-none">⌫</button>
                        </div>
                    )}
                </div>

                {/* ── Side panel ── */}
                <div className="flex flex-col gap-4 flex-1 min-w-0">

                    {/* Live score */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
                        <p className="text-sm text-gray-400">Raw Score</p>
                        <p className="text-5xl font-bold text-white mt-1 tabular-nums">{totalScore}</p>
                        <p className="text-sm text-gray-500 mt-2">
                            ≈ <span className="text-green-400">Rs. {(totalScore / 1000).toFixed(2)}</span> if you cash out now
                        </p>
                    </div>

                    {/* Level multiplier display */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                        <p className="text-sm text-gray-400 mb-3">Level Multipliers</p>
                        <div className="grid grid-cols-4 gap-2">
                            {Array.from({ length: MAX_LEVEL }).map((_, i) => (
                                <div key={i} className={`rounded-lg p-2 text-center border transition ${
                                    i + 1 < level  ? 'border-gray-600 bg-gray-700/40 text-gray-500' :
                                    i + 1 === level ? 'border-blue-500 bg-blue-900/30 text-blue-300' :
                                    'border-gray-700 bg-gray-900 text-gray-600'
                                }`}>
                                    <p className="text-xs">Lvl {i + 1}</p>
                                    <p className="font-bold">×{i + 1}</p>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Answer history */}
                    {history.length > 0 && (
                        <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                            <p className="text-sm text-gray-400 mb-3">History</p>
                            <div className="space-y-1.5 max-h-48 overflow-y-auto pr-1">
                                {[...history].reverse().map((h, i) => (
                                    <div key={i} className={`flex items-center justify-between rounded-lg px-3 py-1.5 text-sm ${
                                        h.correct ? 'bg-green-900/20 border border-green-800' : 'bg-red-900/20 border border-red-900'
                                    }`}>
                                        <span className="font-mono text-gray-300">{h.question} = {h.answer}</span>
                                        <span className={`font-bold ${h.correct ? 'text-green-400' : 'text-red-400'}`}>
                                            {h.correct ? '✓' : `✗ ${h.given}`}
                                        </span>
                                    </div>
                                ))}
                            </div>
                        </div>
                    )}

                    {/* Scoring info */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 text-sm space-y-1.5">
                        <p className="font-bold text-gray-300">How scoring works</p>
                        <p className="text-gray-400">raw_score = correct_answers × level</p>
                        <p className="text-gray-400">{MAX_LEVEL} levels · {QUESTIONS_PER_LEVEL} questions each</p>
                        <p className="text-gray-400">Timer shrinks each level — stay sharp</p>
                        <div className="pt-2 border-t border-gray-700 text-xs text-gray-500">
                            <p>Max raw score: {Array.from({length: MAX_LEVEL}, (_,i) => (i+1)*QUESTIONS_PER_LEVEL).reduce((a,b)=>a+b)} pts (perfect run)</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
