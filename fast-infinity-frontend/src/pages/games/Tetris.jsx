
import { useState, useEffect, useRef, useCallback } from 'react';
import { useNavigate } from 'react-router-dom';
import useStore from '../../store/useStore';
import axiosClient from '../../api/axiosClient';

// ─── Constants ───────────────────────────────────────────────────────────────
const COLS       = 10;
const ROWS       = 20;
const CELL       = 28;
const CANVAS_W   = COLS * CELL;   // 280px
const CANVAS_H   = ROWS * CELL;   // 560px
const NEXT_SIZE  = 4 * CELL;      // preview box

// Speed (ms per drop tick) per level, capped at level 10
const SPEEDS = [800, 720, 630, 550, 470, 380, 300, 220, 140, 80];

// ─── Tetrominoes ─────────────────────────────────────────────────────────────
// Each piece: color + rotation matrices
const PIECES = [
    // I – cyan
    {
        color: '#22d3ee',
        ghost: 'rgba(34,211,238,0.18)',
        rotations: [
            [[0,0],[1,0],[2,0],[3,0]],
            [[0,0],[0,1],[0,2],[0,3]],
            [[0,0],[1,0],[2,0],[3,0]],
            [[0,0],[0,1],[0,2],[0,3]],
        ],
        spawn: { x: 3, y: 0 },
    },
    // O – yellow
    {
        color: '#fbbf24',
        ghost: 'rgba(251,191,36,0.18)',
        rotations: [
            [[0,0],[1,0],[0,1],[1,1]],
            [[0,0],[1,0],[0,1],[1,1]],
            [[0,0],[1,0],[0,1],[1,1]],
            [[0,0],[1,0],[0,1],[1,1]],
        ],
        spawn: { x: 4, y: 0 },
    },
    // T – purple
    {
        color: '#a78bfa',
        ghost: 'rgba(167,139,250,0.18)',
        rotations: [
            [[1,0],[0,1],[1,1],[2,1]],
            [[0,0],[0,1],[1,1],[0,2]],
            [[0,0],[1,0],[2,0],[1,1]],
            [[1,0],[0,1],[1,1],[1,2]],
        ],
        spawn: { x: 3, y: 0 },
    },
    // S – green
    {
        color: '#4ade80',
        ghost: 'rgba(74,222,128,0.18)',
        rotations: [
            [[1,0],[2,0],[0,1],[1,1]],
            [[0,0],[0,1],[1,1],[1,2]],
            [[1,0],[2,0],[0,1],[1,1]],
            [[0,0],[0,1],[1,1],[1,2]],
        ],
        spawn: { x: 3, y: 0 },
    },
    // Z – red
    {
        color: '#f87171',
        ghost: 'rgba(248,113,113,0.18)',
        rotations: [
            [[0,0],[1,0],[1,1],[2,1]],
            [[1,0],[0,1],[1,1],[0,2]],
            [[0,0],[1,0],[1,1],[2,1]],
            [[1,0],[0,1],[1,1],[0,2]],
        ],
        spawn: { x: 3, y: 0 },
    },
    // J – blue
    {
        color: '#60a5fa',
        ghost: 'rgba(96,165,250,0.18)',
        rotations: [
            [[0,0],[0,1],[1,1],[2,1]],
            [[0,0],[1,0],[0,1],[0,2]],
            [[0,0],[1,0],[2,0],[2,1]],
            [[1,0],[1,1],[0,2],[1,2]],
        ],
        spawn: { x: 3, y: 0 },
    },
    // L – orange
    {
        color: '#fb923c',
        ghost: 'rgba(251,146,60,0.18)',
        rotations: [
            [[2,0],[0,1],[1,1],[2,1]],
            [[0,0],[0,1],[0,2],[1,2]],
            [[0,0],[1,0],[2,0],[0,1]],
            [[0,0],[1,0],[1,1],[1,2]],
        ],
        spawn: { x: 3, y: 0 },
    },
];

// ─── Helpers ─────────────────────────────────────────────────────────────────
function emptyBoard() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

function randomPieceIdx() {
    return Math.floor(Math.random() * PIECES.length);
}

function getCells(pieceIdx, rotation, origin) {
    return PIECES[pieceIdx].rotations[rotation].map(([dx, dy]) => ({
        x: origin.x + dx,
        y: origin.y + dy,
    }));
}

function isValid(cells, board) {
    return cells.every(({ x, y }) =>
        x >= 0 && x < COLS && y >= 0 && y < ROWS && !board[y]?.[x]
    );
}

function getGhost(pieceIdx, rotation, pos, board) {
    let ghostY = pos.y;
    while (true) {
        const next = getCells(pieceIdx, rotation, { x: pos.x, y: ghostY + 1 });
        if (!isValid(next, board)) break;
        ghostY++;
    }
    return ghostY;
}

function lockPiece(cells, color, board) {
    const b = board.map(r => [...r]);
    cells.forEach(({ x, y }) => { b[y][x] = color; });
    return b;
}

function clearLines(board) {
    const newBoard = board.filter(row => row.some(cell => !cell));
    const cleared = ROWS - newBoard.length;
    const blanks = Array.from({ length: cleared }, () => Array(COLS).fill(null));
    return { board: [...blanks, ...newBoard], cleared };
}

// ─── Canvas Drawing ───────────────────────────────────────────────────────────
function drawCell(ctx, x, y, color, ghost = false) {
    const px = x * CELL;
    const py = y * CELL;
    if (ghost) {
        ctx.fillStyle = color;
        ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
        return;
    }
    // Main fill
    ctx.fillStyle = color;
    ctx.fillRect(px + 1, py + 1, CELL - 2, CELL - 2);
    // Highlight
    ctx.fillStyle = 'rgba(255,255,255,0.18)';
    ctx.fillRect(px + 2, py + 2, CELL - 6, 4);
    ctx.fillRect(px + 2, py + 2, 4, CELL - 6);
    // Shadow
    ctx.fillStyle = 'rgba(0,0,0,0.35)';
    ctx.fillRect(px + 1, py + CELL - 4, CELL - 2, 3);
    ctx.fillRect(px + CELL - 4, py + 1, 3, CELL - 2);
}

function drawBoard(ctx, board) {
    // Background
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(0, 0, CANVAS_W, CANVAS_H);

    // Grid lines
    ctx.strokeStyle = 'rgba(255,255,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x <= COLS; x++) {
        ctx.beginPath(); ctx.moveTo(x * CELL, 0); ctx.lineTo(x * CELL, CANVAS_H); ctx.stroke();
    }
    for (let y = 0; y <= ROWS; y++) {
        ctx.beginPath(); ctx.moveTo(0, y * CELL); ctx.lineTo(CANVAS_W, y * CELL); ctx.stroke();
    }

    // Locked cells
    board.forEach((row, y) =>
        row.forEach((color, x) => { if (color) drawCell(ctx, x, y, color); })
    );
}

function drawPiece(ctx, pieceIdx, rotation, pos, board) {
    const piece = PIECES[pieceIdx];
    const ghostY = getGhost(pieceIdx, rotation, pos, board);

    // Ghost
    if (ghostY !== pos.y) {
        getCells(pieceIdx, rotation, { x: pos.x, y: ghostY }).forEach(({ x, y }) => {
            drawCell(ctx, x, y, piece.ghost, true);
        });
    }

    // Active piece
    getCells(pieceIdx, rotation, pos).forEach(({ x, y }) => {
        if (y >= 0) drawCell(ctx, x, y, piece.color);
    });
}

function drawNextPreview(ctx, nextIdx) {
    ctx.fillStyle = '#1e293b';
    ctx.fillRect(0, 0, NEXT_SIZE, NEXT_SIZE);

    const cells = PIECES[nextIdx].rotations[0];
    const minX = Math.min(...cells.map(c => c[0]));
    const minY = Math.min(...cells.map(c => c[1]));
    const maxX = Math.max(...cells.map(c => c[0]));
    const maxY = Math.max(...cells.map(c => c[1]));
    const pw   = maxX - minX + 1;
    const ph   = maxY - minY + 1;
    const offX = Math.floor((4 - pw) / 2) - minX;
    const offY = Math.floor((4 - ph) / 2) - minY;

    cells.forEach(([dx, dy]) => {
        drawCell(ctx, dx + offX, dy + offY, PIECES[nextIdx].color);
    });
}

// ─── Component ───────────────────────────────────────────────────────────────
export default function Tetris() {
    const navigate = useNavigate();
    const { addBalance } = useStore();

    const canvasRef  = useRef(null);
    const nextRef    = useRef(null);

    // UI state
    const [phase,       setPhase]       = useState('IDLE');
    // IDLE | PLAYING | PAUSED | GAME_OVER | SUBMITTING | SUBMITTED
    const [lines,       setLines]       = useState(0);
    const [level,       setLevel]       = useState(1);
    const [score,       setScore]       = useState(0);
    const [highScore,   setHighScore]   = useState(() =>
        parseInt(localStorage.getItem('fi_tetris_hs') || '0', 10));
    const [cashEarned,  setCashEarned]  = useState(null);
    const [submitError, setSubmitError] = useState(null);

    // Game refs
    const boardRef      = useRef(emptyBoard());
    const pieceIdxRef   = useRef(randomPieceIdx());
    const nextIdxRef    = useRef(randomPieceIdx());
    const rotRef        = useRef(0);
    const posRef        = useRef({ ...PIECES[pieceIdxRef.current].spawn });
    const linesRef      = useRef(0);
    const levelRef      = useRef(1);
    const scoreRef      = useRef(0);
    const phaseRef      = useRef('IDLE');
    const tickRef       = useRef(null);
    const lockDelayRef  = useRef(null);

    // ── Draw ─────────────────────────────────────────────────────────────────
    const draw = useCallback(() => {
        const cv  = canvasRef.current; if (!cv) return;
        const ctx = cv.getContext('2d');
        drawBoard(ctx, boardRef.current);
        if (phaseRef.current === 'PLAYING' || phaseRef.current === 'PAUSED') {
            drawPiece(ctx, pieceIdxRef.current, rotRef.current, posRef.current, boardRef.current);
        }
    }, []);

    const drawNext = useCallback(() => {
        const cv  = nextRef.current; if (!cv) return;
        const ctx = cv.getContext('2d');
        drawNextPreview(ctx, nextIdxRef.current);
    }, []);

    // ── Spawn next piece ──────────────────────────────────────────────────────
    const spawnNext = useCallback(() => {
        pieceIdxRef.current = nextIdxRef.current;
        nextIdxRef.current  = randomPieceIdx();
        rotRef.current      = 0;
        posRef.current      = { ...PIECES[pieceIdxRef.current].spawn };

        // Check if spawn position is blocked → game over
        if (!isValid(getCells(pieceIdxRef.current, 0, posRef.current), boardRef.current)) {
            clearInterval(tickRef.current);
            clearTimeout(lockDelayRef.current);
            phaseRef.current = 'GAME_OVER';
            setPhase('GAME_OVER');
            const final = scoreRef.current;
            const stored = parseInt(localStorage.getItem('fi_tetris_hs') || '0', 10);
            if (final > stored) {
                localStorage.setItem('fi_tetris_hs', String(final));
                setHighScore(final);
            }
            draw();
            return;
        }
        draw();
        drawNext();
    }, [draw, drawNext]);

    // ── Lock active piece ─────────────────────────────────────────────────────
    const lockActive = useCallback(() => {
        clearTimeout(lockDelayRef.current);
        const cells = getCells(pieceIdxRef.current, rotRef.current, posRef.current);
        const newBoard = lockPiece(cells, PIECES[pieceIdxRef.current].color, boardRef.current);
        const { board: clearedBoard, cleared } = clearLines(newBoard);
        boardRef.current = clearedBoard;

        if (cleared > 0) {
            const lineScores = [0, 100, 300, 500, 800]; // 0,1,2,3,4 lines
            const pts = (lineScores[cleared] || 800) * levelRef.current;
            const newLines = linesRef.current + cleared;
            const newLevel = Math.min(10, Math.floor(newLines / 10) + 1);
            linesRef.current = newLines;
            scoreRef.current += pts;
            levelRef.current = newLevel;
            setLines(newLines);
            setScore(scoreRef.current);
            setLevel(newLevel);

            // Adjust speed on level up
            clearInterval(tickRef.current);
            tickRef.current = setInterval(drop, SPEEDS[newLevel - 1]);
        }

        spawnNext();
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [spawnNext]);

    // ── Drop one row ──────────────────────────────────────────────────────────
    const drop = useCallback(() => {
        if (phaseRef.current !== 'PLAYING') return;
        const newPos = { ...posRef.current, y: posRef.current.y + 1 };
        if (isValid(getCells(pieceIdxRef.current, rotRef.current, newPos), boardRef.current)) {
            posRef.current = newPos;
            draw();
        } else {
            lockActive();
        }
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, [draw, lockActive]);

    // ── Hard drop ─────────────────────────────────────────────────────────────
    const hardDrop = useCallback(() => {
        if (phaseRef.current !== 'PLAYING') return;
        const ghostY = getGhost(pieceIdxRef.current, rotRef.current, posRef.current, boardRef.current);
        posRef.current = { ...posRef.current, y: ghostY };
        lockActive();
    }, [lockActive]);

    // ── Move horizontal ───────────────────────────────────────────────────────
    const moveH = useCallback((dx) => {
        if (phaseRef.current !== 'PLAYING') return;
        const newPos = { ...posRef.current, x: posRef.current.x + dx };
        if (isValid(getCells(pieceIdxRef.current, rotRef.current, newPos), boardRef.current)) {
            posRef.current = newPos;
            draw();
        }
    }, [draw]);

    // ── Rotate ───────────────────────────────────────────────────────────────
    const rotate = useCallback((dir = 1) => {
        if (phaseRef.current !== 'PLAYING') return;
        const nextRot = (rotRef.current + dir + 4) % 4;
        // Simple wall-kick: try 0, ±1, ±2
        const kicks = [0, -1, 1, -2, 2];
        for (const kick of kicks) {
            const newPos = { ...posRef.current, x: posRef.current.x + kick };
            if (isValid(getCells(pieceIdxRef.current, nextRot, newPos), boardRef.current)) {
                rotRef.current = nextRot;
                posRef.current = newPos;
                draw();
                return;
            }
        }
    }, [draw]);

    // ── Keyboard ─────────────────────────────────────────────────────────────
    useEffect(() => {
        const onKey = (e) => {
            if (['ArrowLeft','ArrowRight','ArrowUp','ArrowDown','Space','KeyP','KeyZ'].includes(e.code)) {
                e.preventDefault();
            }
            switch (e.code) {
                case 'ArrowLeft':  moveH(-1); break;
                case 'ArrowRight': moveH(1);  break;
                case 'ArrowDown':  drop();    break;
                case 'ArrowUp':    rotate(1); break;
                case 'KeyZ':       rotate(-1); break;
                case 'Space':      hardDrop(); break;
                case 'KeyP':
                    if (phaseRef.current === 'PLAYING') {
                        clearInterval(tickRef.current);
                        phaseRef.current = 'PAUSED';
                        setPhase('PAUSED');
                    } else if (phaseRef.current === 'PAUSED') {
                        phaseRef.current = 'PLAYING';
                        setPhase('PLAYING');
                        tickRef.current = setInterval(drop, SPEEDS[levelRef.current - 1]);
                    }
                    break;
                default: break;
            }
        };
        window.addEventListener('keydown', onKey);
        return () => window.removeEventListener('keydown', onKey);
    }, [moveH, drop, rotate, hardDrop]);

    // ── Start Game ───────────────────────────────────────────────────────────
    const startGame = useCallback(() => {
        clearInterval(tickRef.current);
        clearTimeout(lockDelayRef.current);

        boardRef.current    = emptyBoard();
        pieceIdxRef.current = randomPieceIdx();
        nextIdxRef.current  = randomPieceIdx();
        rotRef.current      = 0;
        posRef.current      = { ...PIECES[pieceIdxRef.current].spawn };
        linesRef.current    = 0;
        levelRef.current    = 1;
        scoreRef.current    = 0;

        setLines(0);
        setLevel(1);
        setScore(0);
        setCashEarned(null);
        setSubmitError(null);
        phaseRef.current = 'PLAYING';
        setPhase('PLAYING');

        draw();
        drawNext();

        tickRef.current = setInterval(drop, SPEEDS[0]);
    }, [draw, drawNext, drop]);

    // ── Cleanup on unmount ────────────────────────────────────────────────────
    useEffect(() => {
        draw();
        drawNext();
        return () => {
            clearInterval(tickRef.current);
            clearTimeout(lockDelayRef.current);
        };
    // eslint-disable-next-line react-hooks/exhaustive-deps
    }, []);

    // ── Submit Score ──────────────────────────────────────────────────────────
    const handleCashOut = async () => {
        const rawScore = linesRef.current * 100;
        if (rawScore === 0) return;

        setPhase('SUBMITTING');
        setSubmitError(null);

        try {
            const matchId  = `TETRIS-${Math.random().toString(36).substring(2, 10).toUpperCase()}`;
            const response = await axiosClient.post('/games/session', {
                game_code: 'TETRIS',
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
    const rawScore = lines * 100;
    const isOver   = phase === 'GAME_OVER' || phase === 'SUBMITTING' || phase === 'SUBMITTED';

    // ── Mobile controls ───────────────────────────────────────────────────────
    const mobileBtn = (label, action, cls = '') => (
        <button
            onPointerDown={action}
            className={`flex items-center justify-center rounded-lg bg-gray-700 hover:bg-gray-600 active:bg-gray-500 text-white font-bold select-none ${cls}`}
        >
            {label}
        </button>
    );

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
                    <h1 className="text-3xl font-bold text-white">Tetris Lite</h1>
                    <p className="mt-1 text-sm text-gray-400">
                        Clear lines, earn points, convert to campus cash.
                    </p>
                </div>
                <div className="text-right">
                    <p className="text-xs text-gray-500 uppercase tracking-widest">Best</p>
                    <p className="text-2xl font-bold text-yellow-400">{highScore.toLocaleString()}</p>
                </div>
            </div>

            {/* Main Layout */}
            <div className="flex flex-col lg:flex-row gap-6">

                {/* ── Board Canvas ── */}
                <div className="flex-shrink-0">
                    <div
                        className="relative rounded-xl overflow-hidden border border-gray-700"
                        style={{ width: CANVAS_W, height: CANVAS_H }}
                    >
                        <canvas ref={canvasRef} width={CANVAS_W} height={CANVAS_H} />

                        {/* IDLE overlay */}
                        {phase === 'IDLE' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/85 backdrop-blur-sm gap-4">
                                <span className="text-5xl select-none">🧱</span>
                                <p className="text-white font-bold text-xl">Ready?</p>
                                <p className="text-gray-400 text-sm text-center px-6">
                                    Clear lines to earn cash.<br />
                                    1 line = 100 raw points.
                                </p>
                                <button
                                    onClick={startGame}
                                    className="mt-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                                >
                                    Start Game
                                </button>
                            </div>
                        )}

                        {/* PAUSED overlay */}
                        {phase === 'PAUSED' && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/85 backdrop-blur-sm gap-3">
                                <span className="text-4xl select-none">⏸</span>
                                <p className="text-white font-bold text-2xl">Paused</p>
                                <button
                                    onClick={() => {
                                        phaseRef.current = 'PLAYING';
                                        setPhase('PLAYING');
                                        tickRef.current = setInterval(drop, SPEEDS[levelRef.current - 1]);
                                    }}
                                    className="mt-2 px-8 py-3 bg-blue-600 hover:bg-blue-500 text-white font-bold rounded-lg transition"
                                >
                                    Resume
                                </button>
                            </div>
                        )}

                        {/* GAME OVER / SUBMIT overlay */}
                        {isOver && (
                            <div className="absolute inset-0 flex flex-col items-center justify-center bg-gray-900/88 backdrop-blur-sm gap-3 px-6">
                                <p className="text-white font-bold text-2xl">Game Over</p>

                                <div className="text-center">
                                    <p className="text-gray-400 text-sm">Lines Cleared</p>
                                    <p className="text-blue-400 font-bold text-5xl tabular-nums">{lines}</p>
                                </div>
                                <div className="text-center">
                                    <p className="text-gray-400 text-sm">Score</p>
                                    <p className="text-white font-bold text-2xl tabular-nums">{score.toLocaleString()}</p>
                                </div>
                                <p className="text-gray-500 text-xs">
                                    Raw: {rawScore.toLocaleString()} pts
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
                                    {phase === 'GAME_OVER' && lines > 0 && (
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

                    {/* Mobile controls */}
                    <div className="mt-4 lg:hidden">
                        {/* Row 1: rotate */}
                        <div className="flex justify-center gap-2 mb-2">
                            {mobileBtn('↺ CCW', () => rotate(-1), 'w-16 h-12 text-sm')}
                            {mobileBtn('↻ CW',  () => rotate(1),  'w-16 h-12 text-sm')}
                        </div>
                        {/* Row 2: move */}
                        <div className="flex justify-center gap-2 mb-2">
                            {mobileBtn('◀', () => moveH(-1), 'w-14 h-14 text-2xl')}
                            {mobileBtn('▼', () => drop(),    'w-14 h-14 text-2xl')}
                            {mobileBtn('▶', () => moveH(1),  'w-14 h-14 text-2xl')}
                        </div>
                        {/* Row 3: hard drop */}
                        <div className="flex justify-center gap-2">
                            {mobileBtn('⬇ Drop', () => hardDrop(), 'w-36 h-12 text-sm')}
                        </div>
                    </div>
                </div>

                {/* ── Side Panel ── */}
                <div className="flex flex-col gap-4 flex-1 min-w-0">

                    {/* Next piece */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-4">
                        <p className="text-sm text-gray-400 mb-3">Next Piece</p>
                        <canvas
                            ref={nextRef}
                            width={NEXT_SIZE}
                            height={NEXT_SIZE}
                            className="rounded-lg"
                        />
                    </div>

                    {/* Live stats */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 space-y-4">
                        <div>
                            <p className="text-sm text-gray-400">Lines Cleared</p>
                            <p className="text-4xl font-bold text-blue-400 tabular-nums">{lines}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Score</p>
                            <p className="text-2xl font-bold text-white tabular-nums">{score.toLocaleString()}</p>
                        </div>
                        <div>
                            <p className="text-sm text-gray-400">Level</p>
                            <p className="text-xl font-bold text-purple-400 tabular-nums">{level}</p>
                        </div>
                        <div className="pt-2 border-t border-gray-700">
                            <p className="text-sm text-gray-400">
                                ≈ <span className="text-green-400 font-semibold">Rs. {(rawScore / 10).toFixed(2)}</span> if you cash out now
                            </p>
                        </div>
                    </div>

                    {/* Controls */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5">
                        <p className="text-sm text-gray-400 mb-3">Controls</p>
                        <div className="grid grid-cols-2 gap-y-2 gap-x-4 text-sm">
                            {[
                                ['← →',   'Move'],
                                ['↑ / Z',  'Rotate'],
                                ['↓',      'Soft drop'],
                                ['Space',  'Hard drop'],
                                ['P',      'Pause'],
                            ].map(([key, label]) => (
                                <div key={key} className="flex items-center gap-2">
                                    <span className="font-mono text-xs bg-gray-700 text-gray-200 px-2 py-0.5 rounded whitespace-nowrap">
                                        {key}
                                    </span>
                                    <span className="text-gray-400">{label}</span>
                                </div>
                            ))}
                        </div>
                    </div>

                    {/* Scoring info */}
                    <div className="rounded-xl border border-gray-700 bg-gray-800 p-5 text-sm space-y-1.5">
                        <p className="font-bold text-gray-300">How scoring works</p>
                        <p className="text-gray-400">Lines cleared × 100 = raw score</p>
                        <p className="text-gray-400">Score bonus: ×2 for doubles, ×5 for Tetris</p>
                        <p className="text-gray-400">Level multiplier applied to score bonus</p>
                        <div className="pt-2 border-t border-gray-700 text-xs text-gray-500 space-y-0.5">
                            <p>Backend converts raw score → Rs.</p>
                            <p>1 line = 100 raw pts · 4 lines = 800 raw pts</p>
                        </div>
                    </div>
                </div>
            </div>
        </div>
    );
}
