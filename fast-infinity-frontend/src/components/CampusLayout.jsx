import { useEffect, useState } from 'react';
import { Navigate, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import { motion } from 'framer-motion'; // Added motion
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

    const [isWalletOpen, setIsWalletOpen] = useState(false);

    useEffect(() => {
        if (token && user?.id && !dashboard) {
            const fetchDashboard = async () => {
                try {
                    const response = await axiosClient.get(`/dashboard/${user.id}`);
                    setDashboardData(response.data);
                } catch (err) {
                    console.error("Failed to fetch balance on reload", err);
                }
            };
            fetchDashboard();
        }
    }, [token, user, dashboard, setDashboardData]);

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    const handleLogout = () => {
        logout();
        navigate('/login');
    };

    // Navigation items array for cleaner mapping with layoutId
    const navLinks = [
        { name: 'Hub', path: '/' },
        { name: 'Cafeteria', path: '/cafeteria' },
        { name: 'E-Sports', path: '/esports' },
        { name: 'Bookshop', path: '/bookshop' },
        { name: 'Ledger', path: '/history' },
    ];

    // PRESERVED ORIGINAL WALLET LOGIC
    const totalSpend = (parseFloat(dashboard?.total_cafeteria_spend || 0) + parseFloat(dashboard?.total_bookshop_spend || 0)).toFixed(2);

    return (
        <div className="flex h-screen w-screen flex-col overflow-hidden bg-gradient-to-br from-gray-900 via-indigo-950 to-slate-900 text-white relative">
            
            {/* The Glassmorphic Wallet Modal - PRESERVED LOGIC & SETTINGS */}
            {isWalletOpen && (
                <div className="fixed inset-0 z-[100] flex items-center justify-center p-4">
                    <div 
                        className="absolute inset-0 bg-black/40 backdrop-blur-sm transition-opacity"
                        onClick={() => setIsWalletOpen(false)}
                    ></div>

                    <div className="relative w-full max-w-sm overflow-hidden rounded-[2.5rem] border border-white/10 bg-gray-900/60 p-6 shadow-[0_8px_32px_0_rgba(0,0,0,0.5)] backdrop-blur-2xl transition-all">
                        
                        <div className="absolute -right-10 -top-10 h-40 w-40 rounded-full bg-cyan-500/20 blur-3xl"></div>
                        <div className="absolute -bottom-10 -left-10 h-40 w-40 rounded-full bg-indigo-500/20 blur-3xl"></div>

                        <div className="relative z-10 mb-6 flex items-center justify-between">
                            <h3 className="text-lg font-medium text-gray-200">Digital Wallet</h3>
                            <button onClick={() => setIsWalletOpen(false)} className="text-gray-400 hover:text-white transition">
                                ✕
                            </button>
                        </div>

                        <div className="relative z-10 space-y-4">
                            <div className="flex items-center space-x-4 mb-2">
                                <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 text-xl font-bold text-white shadow-inner">
                                    {(user?.name || dashboard?.full_name || 'S').charAt(0).toUpperCase()}
                                </div>
                                <div>
                                    <p className="text-lg font-bold text-white">{user?.name || dashboard?.full_name}</p>
                                    <p className="font-mono text-xs text-gray-400">{dashboard?.roll_number}</p>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-white/5 bg-black/20 p-5">
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Available Balance</p>
                                <div className="flex items-end justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-green-500/20 text-xl">
                                            👛
                                        </div>
                                        <span className="text-3xl font-black text-white">
                                            Rs. {formatRs(dashboard?.current_balance || user?.balance)}
                                        </span>
                                    </div>
                                </div>
                            </div>

                            <div className="rounded-3xl border border-white/5 bg-black/20 p-5">
                                <p className="mb-1 text-[10px] font-bold uppercase tracking-widest text-gray-400">Total Campus Spend</p>
                                <div className="flex items-end justify-between">
                                    <div className="flex items-center space-x-3">
                                        <div className="flex h-10 w-10 items-center justify-center rounded-full bg-red-500/10 text-xl">
                                            💸
                                        </div>
                                        <span className="text-2xl font-bold text-gray-300">
                                            Rs. {formatRs(totalSpend)}
                                        </span>
                                    </div>
                                </div>
                                <div className="mt-3 flex justify-between text-xs text-gray-400 font-medium">
                                    <span>Cafeteria: Rs. {formatRs(dashboard?.total_cafeteria_spend)}</span>
                                    <span>Bookshop: Rs. {formatRs(dashboard?.total_bookshop_spend)}</span>
                                </div>
                            </div>

                            <button 
                                onClick={() => { setIsWalletOpen(false); navigate('/history'); }}
                                className="mt-2 w-full rounded-2xl py-3.5 text-sm font-bold shadow-lg transition active:scale-[0.98] border border-white/10 bg-white/10 text-white hover:bg-white/20"
                            >
                                View Full Ledger
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* Floating Glass Header */}
            <header className="fixed inset-x-6 top-6 z-50 flex h-16 items-center justify-between rounded-full border border-white/20 bg-white/10 px-6 py-2 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] backdrop-blur-lg">
                
                <div className="flex items-center space-x-2">
                    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-cyan-400 to-blue-600 font-black text-white shadow-lg">
                        FI
                    </div>
                    <span className="hidden text-xl font-bold tracking-widest text-white md:block">
                        FAST<span className="text-cyan-400">INFINITY</span>
                    </span>
                </div>

                {/* NEW SLIDING NAVIGATION */}
                <nav className="hidden items-center space-x-1 lg:flex">
                    {navLinks.map((link) => {
                        const isActive = link.path === '/' 
                            ? location.pathname === '/' 
                            : location.pathname.startsWith(link.path);
                        
                        return (
                            <Link
                                key={link.path}
                                to={link.path}
                                className={`relative px-4 py-2 text-sm font-semibold transition-colors duration-300 ${
                                    isActive ? 'text-white' : 'text-gray-300 hover:text-white'
                                }`}
                            >
                                {isActive && (
                                    <motion.div
                                        layoutId="nav-pill"
                                        className="absolute inset-0 rounded-full bg-white/20 shadow-inner"
                                        transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
                                    />
                                )}
                                <span className="relative z-10">{link.name}</span>
                            </Link>
                        );
                    })}

                    {/* PRESERVED ADMIN LOGIC WITH SLIDING PILL */}
                    {ADMIN_ROLL_NUMBERS.includes(dashboard?.roll_number) && (
                        <Link
                            to="/admin"
                            className={`relative ml-2 rounded-full px-4 py-2 text-sm font-bold transition-colors duration-300 ${
                                location.pathname === '/admin' ? 'text-white' : 'text-red-300 hover:text-white'
                            }`}
                        >
                            {location.pathname === '/admin' && (
                                <motion.div
                                    layoutId="nav-pill"
                                    className="absolute inset-0 rounded-full bg-red-500/40 border border-red-500/50"
                                    transition={{ type: 'spring', bounce: 0.25, duration: 0.5 }}
                                />
                            )}
                            <span className="relative z-10">Admin</span>
                        </Link>
                    )}
                </nav>

                <div className="flex items-center space-x-3">
                   

                    <button 
                        onClick={() => setIsWalletOpen(true)}
                        className="flex items-center space-x-2 rounded-full border border-green-400/30 bg-green-500/10 px-4 py-1.5 shadow-inner transition hover:bg-green-500/20"
                    >
                        <span className="text-lg">👛</span>
                        <span className="text-sm font-bold text-green-300">
                            Rs. {formatRs(dashboard?.current_balance || user?.balance)}
                        </span>
                    </button>

                    <button
                        onClick={handleLogout}
                        className="rounded-full border border-red-400/30 bg-red-500/10 px-4 py-1.5 text-sm font-bold text-red-300 transition hover:bg-red-500/20 hover:text-red-200"
                    >
                        Logout
                    </button>
                </div>
            </header>
            
            <main className="flex-1 overflow-y-auto px-8 pb-8 pt-32">
                <Outlet />
            </main>
            
        </div>
    );
}