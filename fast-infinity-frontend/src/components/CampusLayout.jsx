import { useEffect, useState } from 'react';
import { Navigate, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion, AnimatePresence } from 'framer-motion'; 
import useStore from '../store/useStore';
import axiosClient from '../api/axiosClient';

const ADMIN_ROLL_NUMBERS = ['24L-0561', '24L-3062', '24L-0556'];

const formatRs = (amount) => {
    return Number(amount || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

export default function CampusLayout() {
    const { token, user, dashboard, logout, setDashboardData, theme, toggleTheme } = useStore();
    const navigate = useNavigate();
    const location = useLocation();

    // UI States
    const [isWalletOpen, setIsWalletOpen] = useState(false);
    const [isAboutOpen, setIsAboutOpen] = useState(false); // NEW STATE

    useEffect(() => {
        if (token && user?.id && !dashboard) {
            const fetchDashboard = async () => {
                try {
                    const response = await axiosClient.get(`/dashboard/${user.id}`);
                    setDashboardData(response.data);
                } catch (err) {
                    console.error("Dashboard fetch error:", err);
                }
            };
            fetchDashboard();
        }
    }, [token, user, dashboard, setDashboardData]);

    if (!token) return <Navigate to="/login" replace />;

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    const navItems = [
        { name: 'Hub', path: '/' },
        { name: 'Cafeteria', path: '/cafeteria' },
        { name: 'E-Sports', path: '/esports' },
        { name: 'Bookshop', path: '/bookshop' },
        { name: 'Ledger', path: '/history' },
    ];

    const monthlySpend = parseFloat(dashboard?.monthly_campus_spend || 0);

    return (
        // The absolute root needs a dark background so the "push back" reveals black
        <div className="relative h-screen w-screen overflow-hidden bg-black text-slate-100 dark:text-white">
            
            {/* 
                THE PUSH-BACK WRAPPER
                When 'isAboutOpen' is true, the entire dashboard shrinks and dims
            */}
            <motion.div
                animate={{ 
                    scale: isAboutOpen ? 0.93 : 1, 
                    y: isAboutOpen ? -15 : 0,
                    opacity: isAboutOpen ? 0.4 : 1,
                    borderRadius: isAboutOpen ? '2rem' : '0rem',
                    filter: isAboutOpen ? 'blur(4px)' : 'blur(0px)'
                }}
                transition={{ type: 'spring', bounce: 0, duration: 0.5 }}
                className="flex h-full w-full flex-col overflow-hidden transition-colors duration-700 bg-gradient-to-br from-slate-800 via-slate-900 to-slate-950 dark:from-gray-900 dark:via-indigo-950 dark:to-black"
            >
                {/* --- DIGITAL WALLET (PRESERVED) --- */}
                <AnimatePresence mode="wait">
                    {isWalletOpen && (
                        <motion.div 
                            key="wallet-modal-overlay"
                            initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
                            className="fixed inset-0 z-[100] flex items-center justify-center p-4"
                        >
                            <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={() => setIsWalletOpen(false)} />
                            <motion.div 
                                key="wallet-modal-content"
                                initial={{ scale: 0.9, opacity: 0, y: 20 }} animate={{ scale: 1, opacity: 1, y: 0 }} exit={{ scale: 0.9, opacity: 0, y: 20 }}
                                className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-white/10 bg-gray-900/80 p-6 shadow-2xl backdrop-blur-2xl"
                            >
                                <div className="relative z-10 space-y-4">
                                    <div className="flex items-center justify-between">
                                        <h3 className="text-lg font-medium">Digital Wallet</h3>
                                        <button onClick={() => setIsWalletOpen(false)} className="text-gray-400 hover:text-white">✕</button>
                                    </div>
                                    <div className="rounded-3xl border border-white/5 bg-black/20 p-5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Balance</p>
                                        <span className="text-3xl font-black text-white">Rs. {formatRs(dashboard?.current_balance)}</span>
                                    </div>
                                    <div className="rounded-3xl border border-white/5 bg-black/20 p-5">
                                        <p className="text-[10px] font-bold uppercase tracking-widest text-gray-400">Monthly Spend</p>
                                        <span className="text-2xl font-bold text-gray-300">Rs. {formatRs(monthlySpend)}</span>
                                    </div>
                                    <button onClick={() => { setIsWalletOpen(false); navigate('/history'); }} className="w-full rounded-2xl py-3.5 text-sm font-bold border border-white/10 bg-white/10 text-white hover:bg-white/20 transition">
                                        View Ledger
                                    </button>
                                </div>
                            </motion.div>
                        </motion.div>
                    )}
                </AnimatePresence>

                {/* --- HEADER (PRESERVED) --- */}
                <header className="fixed inset-x-6 top-6 z-50 flex h-16 items-center justify-between rounded-full border border-slate-700/50 bg-slate-800/40 px-6 py-2 shadow-lg backdrop-blur-lg dark:border-white/10 dark:bg-white/5">
                    
                    {/* TRIGGER: Clickable Logo */}
                    <button 
                        onClick={() => setIsAboutOpen(true)}
                        className="flex items-center space-x-2 group transition-transform hover:scale-105"
                    >
                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 font-black text-white shadow-[0_0_15px_rgba(34,211,238,0.4)] group-hover:shadow-[0_0_25px_rgba(34,211,238,0.7)] transition-shadow">FI</div>
                        <span className="hidden text-xl font-bold md:block">FAST<span className="text-cyan-400">INFINITY</span></span>
                    </button>

                    <nav className="relative hidden items-center space-x-1 lg:flex">
                        {navItems.map((item) => {
                            const isActive = item.path === '/' ? location.pathname === '/' : location.pathname.startsWith(item.path);
                            return (
                                <Link key={item.path} to={item.path} className={`relative px-4 py-2 text-sm font-medium transition-colors ${isActive ? 'text-white' : 'text-slate-400 hover:text-slate-100'}`}>
                                    {isActive && (
                                        <motion.div layoutId="nav-indicator" className="absolute inset-0 z-0 rounded-full bg-white/10 shadow-[inset_0_1px_1px_rgba(255,255,255,0.1)]" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                                    )}
                                    <span className="relative z-10">{item.name}</span>
                                </Link>
                            );
                        })}
                        {ADMIN_ROLL_NUMBERS.includes(dashboard?.roll_number) && (
                            <Link to="/admin" className={`relative ml-2 px-4 py-2 text-sm font-bold transition-colors ${location.pathname === '/admin' ? 'text-white' : 'text-red-400 hover:text-red-300'}`}>
                                {location.pathname === '/admin' && (
                                    <motion.div layoutId="nav-indicator" className="absolute inset-0 z-0 rounded-full bg-red-500/20 border border-red-500/30" transition={{ type: 'spring', stiffness: 380, damping: 30 }} />
                                )}
                                <span className="relative z-10">Admin</span>
                            </Link>
                        )}
                    </nav>

                    <div className="flex items-center space-x-3">
                        <button onClick={() => toggleTheme()} className="flex h-9 w-9 items-center justify-center rounded-full bg-white/5 border border-white/10">
                            {theme === 'dark' ? '🌌' : '🌑'}
                        </button>
                        <button onClick={() => setIsWalletOpen(true)} className="flex items-center space-x-2 rounded-full border border-green-500/30 bg-green-500/10 px-4 py-1.5 shadow-inner">
                            <span className="text-sm font-bold text-green-300">Rs. {formatRs(dashboard?.current_balance)}</span>
                        </button>
                        <button onClick={handleLogout} className="rounded-full border border-red-400/30 bg-red-500/10 px-4 py-1.5 text-sm font-bold text-red-300">Logout</button>
                    </div>
                </header>
                
                <main className="flex-1 overflow-y-auto px-8 pb-8 pt-32">
                    <Outlet />
                </main>
            </motion.div>

            {/* --- THE IMMERSIVE PORTFOLIO OVERLAY --- */}
            <AnimatePresence>
                {isAboutOpen && (
                    <motion.div
                        initial={{ y: '100%', opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-x-0 bottom-0 z-[80] h-[95vh] w-full rounded-t-[2.5rem] border-t border-white/10 bg-slate-950/80 p-8 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl overflow-y-auto"
                    >
                        {/* Dynamic Ambient Blobs */}
                        <div className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-cyan-600/20 blur-[120px] pointer-events-none" />
                        <div className="absolute -right-40 top-60 h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />

                        {/* Top Close Bar */}
                        <div className="sticky top-0 z-20 flex w-full justify-end pb-8">
                            <button 
                                onClick={() => setIsAboutOpen(false)}
                                className="flex items-center space-x-2 rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm font-bold backdrop-blur-md transition-colors hover:bg-white/20"
                            >
                                <span>Close Portfolio</span>
                                <span>✕</span>
                            </button>
                        </div>

                        {/* The Hero Section */}
                        <div className="relative z-10 flex w-full flex-col items-center justify-center pt-10 text-center">
                            
                            {/* Massive Glowing Logo */}
                            <motion.div 
                                initial={{ scale: 0.8, opacity: 0 }}
                                animate={{ scale: 1, opacity: 1 }}
                                transition={{ delay: 0.2, type: 'spring', bounce: 0.4 }}
                                className="flex h-48 w-48 items-center justify-center rounded-[3rem] bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_80px_rgba(34,211,238,0.5)]"
                            >
                                <span className="text-7xl font-black tracking-tighter text-white drop-shadow-2xl">FI</span>
                            </motion.div>

                            <h1 className="mt-12 text-6xl font-black tracking-tight text-white">
                                FAST<span className="text-cyan-400">INFINITY</span>
                            </h1>
                            <p className="mt-6 max-w-2xl text-xl leading-relaxed text-gray-300 font-medium">
                                Redefining the FAST-NUCES campus experience. A unified ecosystem connecting your academics, e-sports victories, and campus economy into one seamless digital wallet.
                            </p>

                            {/* Divider */}
                            <div className="mt-16 h-px w-full max-w-4xl bg-gradient-to-r from-transparent via-white/20 to-transparent" />

                            {/* Team / Tech Stack Section Hook */}
                            <div className="mt-16 w-full max-w-5xl">
                                <h2 className="text-3xl font-bold text-white mb-10">The Architects</h2>
                                
                                {/* Placeholder for your Team Cards (Bento Box style) */}
                                <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
                                    <div className="h-64 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                                        <p className="text-gray-400 italic">Member 1 Profile</p>
                                    </div>
                                    <div className="h-64 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                                        <p className="text-gray-400 italic">Member 2 Profile</p>
                                    </div>
                                    <div className="h-64 rounded-3xl border border-white/10 bg-white/5 p-6 backdrop-blur-md">
                                        <p className="text-gray-400 italic">Member 3 Profile</p>
                                    </div>
                                </div>
                            </div>
                        </div>
                    </motion.div>
                )}
            </AnimatePresence>

        </div>
    );
}