import React, { useState, useEffect, useRef, useCallback } from 'react';
import axiosClient from '../../../api/axiosClient'; // Path adjusted for src/pages/games/ folder[cite: 3]
import useStore from '../../../store/useStore'; // Path adjusted for src/pages/games/ folder[cite: 3]

// --- Game Configuration ---
const GAME_TIME = 30;
const RADIUS = 35; 
const PENALTY = 100;
const BASE_VALUE = 200;
const MAX_BALLS = 6;
const CONVERSION_RATE = 500; // 500 points = $1.00[cite: 4]

export default function ReactionTap() {
  // Game Lifecycle State
  const [gameState, setGameState] = useState('IDLE'); // IDLE, PLAYING, SUBMITTING, RESULTS[cite: 7]
  const [timeLeft, setTimeLeft] = useState(GAME_TIME);
  const [score, setScore] = useState(0);
  const [hits, setHits] = useState(0);
  const [earnedCash, setEarnedCash] = useState(0);
  const [targets, setTargets] = useState([]);
  
  // Refs for physics and containers
  const requestRef = useRef();
  const containerRef = useRef();
  
  // Global store for real-time balance updates[cite: 3]
  const updateBalance = useStore((state) => state.updateBalance);

  // --- Logic: Create a New Ball ---
  const createTarget = useCallback(() => {
    if (!containerRef.current) return;
    const { width, height } = containerRef.current.getBoundingClientRect();
    
    return {
      id: Math.random(),
      x: Math.random() * (width - RADIUS * 2) + RADIUS,
      y: Math.random() * (height - RADIUS * 2) + RADIUS,
      dx: (Math.random() - 0.5) * 8, // Velocity X
      dy: (Math.random() - 0.5) * 8, // Velocity Y
      color: `hsl(${Math.random() * 360}, 80%, 60%)`, // Fixed Template Literal[cite: 7]
      createdAt: performance.now()
    };
  }, []);

  // --- Physics Engine: Wall & Ball-to-Ball Collisions ---
  const updatePhysics = useCallback(() => {
    if (gameState !== 'PLAYING') return;

    setTargets((prev) => {
      const next = prev.map(t => ({ ...t }));
      const { width, height } = containerRef.current.getBoundingClientRect();

      for (let i = 0; i < next.length; i++) {
        let b1 = next[i];

        // Wall Collision Handling
        if (b1.x + b1.dx > width - RADIUS || b1.x + b1.dx < RADIUS) b1.dx = -b1.dx;
        if (b1.y + b1.dy > height - RADIUS || b1.y + b1.dy < RADIUS) b1.dy = -b1.dy;

        // Ball-to-Ball Collision Handling
        for (let j = i + 1; j < next.length; j++) {
          let b2 = next[j];
          const distance = Math.hypot(b1.x - b2.x, b1.y - b2.y);
          if (distance < RADIUS * 2) {
            // Elastic Collision: Swap velocities[cite: 7]
            const tempDx = b1.dx;
            const tempDy = b1.dy;
            b1.dx = b2.dx;
            b1.dy = b2.dy;
            b2.dx = tempDx;
            b2.dy = tempDy;
          }
        }
        b1.x += b1.dx;
        b1.y += b1.dy;
      }
      return next;
    });
    requestRef.current = requestAnimationFrame(updatePhysics);
  }, [gameState]);

  // --- Game Controls ---
  const startGame = () => {
    setScore(0); 
    setHits(0); 
    setTimeLeft(GAME_TIME);
    setTargets(Array.from({ length: 3 }, createTarget));
    setGameState('PLAYING');
  };

  const endGame = useCallback(async () => {
    cancelAnimationFrame(requestRef.current);
    setGameState('SUBMITTING');
    
    try {
      // Sync score with backend PostgreSQL database[cite: 5, 6]
      const response = await axiosClient.post('/api/games/reward', { 
        game_code: 'REACTION_TAP', 
        score: score 
      });
      
      setEarnedCash(response.data.earnedCash || (score / CONVERSION_RATE));
      
      // Update global balance in store immediately[cite: 3]
      if (updateBalance && response.data.newBalance) {
        updateBalance(response.data.newBalance);
      }
    } catch (err) {
      console.error("Score submission error:", err);
      setEarnedCash(score / CONVERSION_RATE);
    } finally {
      setGameState('RESULTS');
    }
  }, [score, updateBalance]);

  useEffect(() => {
    if (gameState === 'PLAYING') {
      requestRef.current = requestAnimationFrame(updatePhysics);
      const timer = setInterval(() => {
        setTimeLeft(t => {
          if (t <= 1) { endGame(); return 0; }
          return t - 1;
        });
      }, 1000);
      return () => {
        cancelAnimationFrame(requestRef.current);
        clearInterval(timer);
      };
    }
  }, [gameState, updatePhysics, endGame]);

  // --- Interaction Handlers ---
  const handleHit = (e, id, createdAt) => {
    e.stopPropagation(); // Prevents background "miss" penalty[cite: 7]
    const reaction = performance.now() - createdAt;
    
    // Scoring logic: hits × speed_bonus
    const speedBonus = Math.max(1, 5 - (reaction / 500)); 
    setScore(s => s + Math.round(BASE_VALUE * speedBonus));
    setHits(h => h + 1);
    
    setTargets(prev => prev.filter(t => t.id !== id));
    if (targets.length < MAX_BALLS) setTargets(prev => [...prev, createTarget()]);
  };

  const handleMiss = () => {
    if (gameState !== 'PLAYING') return;
    setScore(s => Math.max(0, s - PENALTY)); // Penalty for clicking background[cite: 7]
  };

  return (
    <div className="flex flex-col items-center w-full font-sans p-4 bg-slate-50 rounded-3xl border border-slate-200 shadow-sm">
      {/* HUD Header */}
      <div className="grid grid-cols-3 gap-4 w-full mb-6">
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Remaining</p>
          <p className={`text-xl font-black ${timeLeft < 10 ? 'text-red-500' : 'text-slate-800'}`}>{timeLeft}s</p>
        </div>
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Score</p>
          <p className="text-xl font-black text-amber-500">{score.toLocaleString()}</p>
        </div>
        <div className="bg-white p-3 rounded-2xl shadow-sm border border-slate-100 text-center">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-widest">Precision</p>
          <p className="text-xl font-black text-emerald-600">{hits}</p>
        </div>
      </div>

      {/* Main Arcade Screen (16:9 Ratio) */}
      <div 
        ref={containerRef}
        onMouseDown={handleMiss}
        className="relative w-full aspect-video bg-slate-900 rounded-2xl border-4 border-slate-800 shadow-2xl overflow-hidden cursor-crosshair"
      >
        {gameState === 'PLAYING' && targets.map(t => (
          <div 
            key={t.id}
            onMouseDown={(e) => handleHit(e, t.id, t.createdAt)}
            style={{ 
              left: t.x - RADIUS, top: t.y - RADIUS, backgroundColor: t.color,
              width: RADIUS * 2, height: RADIUS * 2 
            }}
            className="absolute rounded-full border-2 border-white flex items-center justify-center cursor-pointer select-none active:scale-90 transition-transform shadow-[0_0_15px_rgba(255,255,255,0.3)]"
          >
            <span className="text-[10px] font-black text-white pointer-events-none">TAP</span>
          </div>
        ))}

        {/* Screen Overlays */}
        {gameState === 'IDLE' && (
          <div className="absolute inset-0 bg-slate-900/90 flex flex-col items-center justify-center z-10 text-white">
            <h1 className="text-4xl font-black mb-4 tracking-tighter italic">REACTION TAP</h1>
            <p className="text-slate-400 mb-6 text-sm">Hit targets quickly. Accuracy is everything.</p>
            <button 
              onClick={startGame}
              className="bg-amber-400 text-slate-900 px-10 py-3 rounded-xl font-black text-lg hover:bg-amber-300 transition-transform active:scale-95"
            >
              START MISSION
            </button>
          </div>
        )}

        {(gameState === 'RESULTS' || gameState === 'SUBMITTING') && (
          <div className="absolute inset-0 bg-slate-900/95 flex flex-col items-center justify-center z-10 text-white p-6">
            <h2 className="text-amber-400 text-3xl font-black mb-2 uppercase italic tracking-tighter text-center">Mission Analysis</h2>
            <p className="opacity-60 mb-6 text-sm uppercase font-bold tracking-widest text-center">Score: {score.toLocaleString()}</p>
            
            <div className="bg-emerald-500/10 border-2 border-emerald-500/40 px-10 py-6 rounded-3xl text-center mb-8 w-full max-w-[280px]">
               <p className="text-emerald-400 text-[10px] font-bold uppercase mb-1 tracking-widest">Credits Generated</p>
               <h3 className="text-emerald-400 text-5xl font-black">
                 {gameState === 'SUBMITTING' ? "..." : `$${earnedCash.toFixed(2)}`}
               </h3>
            </div>

            <button 
              onClick={startGame} 
              className="bg-white text-slate-900 px-8 py-3 rounded-xl font-black hover:bg-slate-100 transition-all active:scale-95"
            >
              RETRY
            </button>
          </div>
        )}
      </div>
      
      <p className="mt-4 text-[10px] font-bold text-slate-400 uppercase tracking-tighter">
        Campus E-Sports Division • {GAME_TIME}S Round Cycle
      </p>
    </div>
  );
}