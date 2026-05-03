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
    const [isAboutOpen, setIsAboutOpen] = useState(false);

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
        <div className="relative h-screen w-screen overflow-hidden bg-black text-slate-100 dark:text-white">
            
            {/* THE PUSH-BACK WRAPPER */}
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
                {/* DIGITAL WALLET */}
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

                {/* HEADER */}
                <header className="fixed inset-x-6 top-6 z-50 flex h-16 items-center justify-between rounded-full border border-slate-700/50 bg-slate-800/40 px-6 py-2 shadow-lg backdrop-blur-lg dark:border-white/10 dark:bg-white/5">
                    
                    <button onClick={() => setIsAboutOpen(true)} className="flex items-center space-x-2 group transition-transform hover:scale-105">
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

            {/* THE IMMERSIVE PORTFOLIO OVERLAY */}
            <AnimatePresence>
                {isAboutOpen && (
                    <motion.div
                        initial={{ y: '100%', opacity: 0 }}
                        animate={{ y: 0, opacity: 1 }}
                        exit={{ y: '100%', opacity: 0 }}
                        transition={{ type: 'spring', damping: 25, stiffness: 200 }}
                        className="fixed inset-x-0 bottom-0 z-[80] h-[95vh] w-full rounded-t-[2.5rem] border-t border-white/10 bg-slate-950/80 p-8 shadow-[0_-20px_50px_rgba(0,0,0,0.5)] backdrop-blur-2xl overflow-y-auto"
                    >
                        {/* Ambient Background Glow */}
                        <div className="absolute -left-40 top-20 h-[500px] w-[500px] rounded-full bg-cyan-600/20 blur-[120px] pointer-events-none" />
                        <div className="absolute -right-40 top-60 h-[500px] w-[500px] rounded-full bg-indigo-600/20 blur-[120px] pointer-events-none" />

                        {/* Top Control Bar */}
                        <div className="sticky top-0 z-20 flex w-full justify-end pb-8">
                            <button 
                                onClick={() => setIsAboutOpen(false)}
                                className="flex items-center space-x-2 rounded-full border border-white/20 bg-white/10 px-6 py-2 text-sm font-bold backdrop-blur-md transition-colors hover:bg-white/20 text-white shadow-lg"
                            >
                                <span>Close Portfolio</span>
                                <span>✕</span>
                            </button>
                        </div>

                        {/* Content Wrapper */}
                        <div className="relative z-10 flex w-full flex-col items-center justify-center pt-2 pb-20 text-left">
                            
                            {/* Mission Header */}
                            <div className="text-center mb-16">
                                <motion.div 
                                    initial={{ scale: 0.8, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} transition={{ delay: 0.2, type: 'spring', bounce: 0.4 }}
                                    className="mx-auto flex h-32 w-32 items-center justify-center rounded-[2rem] bg-gradient-to-br from-cyan-400 to-blue-600 shadow-[0_0_60px_rgba(34,211,238,0.4)] mb-8"
                                >
                                    <span className="text-5xl font-black tracking-tighter text-white drop-shadow-lg">FI</span>
                                </motion.div>
                                <h1 className="text-5xl font-black tracking-tight text-white mb-4">The <span className="text-cyan-400">Architects</span></h1>
                                <p className="mx-auto max-w-xl text-lg text-gray-400 font-medium">The minds building the unified ecosystem for academics, e-sports, and the campus economy at FAST-NUCES.</p>
                            </div>

                            {/* ======================================= */}
                            {/* THE ARCHITECTS: TEAM GRID               */}
                            {/* ======================================= */}
                            <div className="w-full max-w-6xl grid grid-cols-1 md:grid-cols-3 gap-8 mt-4 px-4">
                                
                                {/* CARD 1: SHEIKH AHSAN OMER (FRONTEND) */}
                                <motion.div 
                                    whileHover={{ y: -4 }}
                                    className="flex flex-col items-center w-full rounded-[2.5rem] border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-2xl relative overflow-hidden group"
                                >
                                    <div className="absolute -inset-2 bg-gradient-to-br from-cyan-500/10 to-blue-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl pointer-events-none"></div>

                                    <div className="relative z-10 flex flex-col items-center w-full">
                                        <div className="h-32 w-32 rounded-full overflow-hidden border-2 border-white/20 mb-6 shadow-inner bg-slate-800 flex items-center justify-center">
                                            <img src="/ahsan-profile.jpg" alt="Ahsan Omer" className="h-full w-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                                            {/* Fallback if image fails to load */}
                                            <span className="absolute text-4xl font-black text-white/30 -z-10">AO</span>
                                        </div>

                                        <h3 className="text-2xl font-bold text-white text-center">Sheikh Ahsan Omer</h3>
                                        <p className="text-cyan-400 font-medium mt-1 text-center">Front-end Developer</p>

                                        <div className="flex items-center space-x-2 mt-4 mb-8">
                                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-gray-300 border border-white/5">24L-3062</span>
                                            <span className="text-sm font-medium text-gray-400">Sophomore CS</span>
                                        </div>

                                        <div className="flex space-x-4 w-full">
                                            <a href="https://github.com/Ahsane1" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center space-x-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-3 transition-colors">
                                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                                                <span className="text-sm font-medium text-white">GitHub</span>
                                            </a>
                                            <a href="https://www.linkedin.com/in/ahsan-omer-b7710b301" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center space-x-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 py-3 transition-colors">
                                                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                                                <span className="text-sm font-medium text-blue-400">LinkedIn</span>
                                            </a>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* CARD 2: MUHAMMAD MOOSA (BACKEND) */}
                                <motion.div 
                                    whileHover={{ y: -4 }}
                                    className="flex flex-col items-center w-full rounded-[2.5rem] border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-2xl relative overflow-hidden group"
                                >
                                    <div className="absolute -inset-2 bg-gradient-to-br from-indigo-500/10 to-purple-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl pointer-events-none"></div>

                                    <div className="relative z-10 flex flex-col items-center w-full">
                                        <div className="h-32 w-32 rounded-full overflow-hidden border-2 border-white/20 mb-6 shadow-inner bg-slate-800 flex items-center justify-center">
                                            {/* Add moosa-profile.png to public folder later */}
                                            <img src="/moosa-profile.jpeg" alt="Muhammad Moosa" className="h-full w-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                                            <span className="absolute text-4xl font-black text-white/30 -z-10">MM</span>
                                        </div>

                                        <h3 className="text-2xl font-bold text-white text-center">Muhammad Moosa</h3>
                                        <p className="text-indigo-400 font-medium mt-1 text-center">Backend Developer</p>

                                        <div className="flex items-center space-x-2 mt-4 mb-8">
                                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-gray-300 border border-white/5">24L-0561</span>
                                            <span className="text-sm font-medium text-gray-400">Sophomore CS</span>
                                        </div>

                                        <div className="flex space-x-4 w-full">
                                            <a href="https://github.com/MoosaTeam" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center space-x-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-3 transition-colors">
                                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                                                <span className="text-sm font-medium text-white">GitHub</span>
                                            </a>
                                            <a href="https://www.linkedin.com/in/muhammad-moosa-39734b2b8/" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center space-x-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 py-3 transition-colors">
                                                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                                                <span className="text-sm font-medium text-blue-400">LinkedIn</span>
                                            </a>
                                        </div>
                                    </div>
                                </motion.div>

                                {/* CARD 3: EMAN JAMEEL (DATABASE) */}
                                <motion.div 
                                    whileHover={{ y: -4 }}
                                    className="flex flex-col items-center w-full rounded-[2.5rem] border border-white/10 bg-white/5 p-8 backdrop-blur-md shadow-2xl relative overflow-hidden group"
                                >
                                    <div className="absolute -inset-2 bg-gradient-to-br from-emerald-500/10 to-teal-500/10 opacity-0 group-hover:opacity-100 transition-opacity duration-500 blur-xl pointer-events-none"></div>

                                    <div className="relative z-10 flex flex-col items-center w-full">
                                        <div className="h-32 w-32 rounded-full overflow-hidden border-2 border-white/20 mb-6 shadow-inner bg-slate-800 flex items-center justify-center">
                                            {/* Add eman-profile.png to public folder later */}
                                            <img src="/eman-profile.jpg" alt="Eman Jameel" className="h-full w-full object-cover" onError={(e) => e.target.style.display = 'none'} />
                                            <span className="absolute text-4xl font-black text-white/30 -z-10">EJ</span>
                                        </div>

                                        <h3 className="text-2xl font-bold text-white text-center">Eman Jameel</h3>
                                        <p className="text-emerald-400 font-medium mt-1 text-center">Database Architect</p>

                                        <div className="flex items-center space-x-2 mt-4 mb-8">
                                            <span className="rounded-full bg-white/10 px-3 py-1 text-xs font-mono text-gray-300 border border-white/5">24L-0556</span>
                                            <span className="text-sm font-medium text-gray-400">Sophomore CS</span>
                                        </div>

                                        <div className="flex space-x-4 w-full">
                                            <a href="https://github.com/Eman-2211" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center space-x-2 rounded-xl bg-white/5 hover:bg-white/10 border border-white/10 py-3 transition-colors">
                                                <svg className="w-5 h-5 text-white" fill="currentColor" viewBox="0 0 24 24"><path fillRule="evenodd" d="M12 2C6.477 2 2 6.484 2 12.017c0 4.425 2.865 8.18 6.839 9.504.5.092.682-.217.682-.483 0-.237-.008-.868-.013-1.703-2.782.605-3.369-1.343-3.369-1.343-.454-1.158-1.11-1.466-1.11-1.466-.908-.62.069-.608.069-.608 1.003.07 1.531 1.032 1.531 1.032.892 1.53 2.341 1.088 2.91.832.092-.647.35-1.088.636-1.338-2.22-.253-4.555-1.113-4.555-4.951 0-1.093.39-1.988 1.029-2.688-.103-.253-.446-1.272.098-2.65 0 0 .84-.27 2.75 1.026A9.564 9.564 0 0112 6.844c.85.004 1.705.115 2.504.337 1.909-1.296 2.747-1.027 2.747-1.027.546 1.379.202 2.398.1 2.651.64.7 1.028 1.595 1.028 2.688 0 3.848-2.339 4.695-4.566 4.943.359.309.678.92.678 1.855 0 1.338-.012 2.419-.012 2.747 0 .268.18.58.688.482A10.019 10.019 0 0022 12.017C22 6.484 17.522 2 12 2z" clipRule="evenodd" /></svg>
                                                <span className="text-sm font-medium text-white">GitHub</span>
                                            </a>
                                            <a href="https://www.linkedin.com/in/eman-jameel" target="_blank" rel="noopener noreferrer" className="flex-1 flex items-center justify-center space-x-2 rounded-xl bg-blue-500/10 hover:bg-blue-500/20 border border-blue-500/20 py-3 transition-colors">
                                                <svg className="w-5 h-5 text-blue-400" fill="currentColor" viewBox="0 0 24 24"><path d="M20.447 20.452h-3.554v-5.569c0-1.328-.027-3.037-1.852-3.037-1.853 0-2.136 1.445-2.136 2.939v5.667H9.351V9h3.414v1.561h.046c.477-.9 1.637-1.85 3.37-1.85 3.601 0 4.267 2.37 4.267 5.455v6.286zM5.337 7.433c-1.144 0-2.063-.926-2.063-2.065 0-1.138.92-2.063 2.063-2.063 1.14 0 2.064.925 2.064 2.063 0 1.139-.925 2.065-2.064 2.065zm1.782 13.019H3.555V9h3.564v11.452zM22.225 0H1.771C.792 0 0 .774 0 1.729v20.542C0 23.227.792 24 1.771 24h20.451C23.2 24 24 23.227 24 22.271V1.729C24 .774 23.2 0 22.222 0h.003z"/></svg>
                                                <span className="text-sm font-medium text-blue-400">LinkedIn</span>
                                            </a>
                                        </div>
                                    </div>
                                </motion.div>

                            </div>

                        </div>
                    </motion.div>
                )}
            </AnimatePresence>
        </div>
    );
}