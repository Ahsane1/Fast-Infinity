import { useEffect } from 'react';
import { Navigate, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useStore from '../store/useStore';
import axiosClient from '../api/axiosClient';

export default function CampusLayout() {
    // Added user and setDashboardData here
    const { token, user, dashboard, logout, setDashboardData } = useStore();
    const navigate = useNavigate();
    const location = useLocation();

    // The Reload Fix: globally fetches wallet data if missing on refresh
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

    const getLinkClass = (path) => {
        const active = path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path);
        return `block p-3 rounded cursor-pointer transition ${
            active ? 'bg-blue-600 text-white font-bold' : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`;
    };

    return (
        <div className="flex h-screen w-screen bg-gray-900 text-white overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r border-gray-800 bg-gray-950 p-6 flex flex-col">
                <h2 className="text-2xl font-bold text-blue-500 mb-10 tracking-widest">FAST Infinity</h2>
                <nav className="flex-1 space-y-4">
                    <Link to="/" className={getLinkClass('/')}>Campus Hub</Link>
                    <Link to="/cafeteria" className={getLinkClass('/cafeteria')}>Cafeteria</Link>
                    <Link to="/esports" className={getLinkClass('/esports')}>E-Sports Center</Link>
                    <Link to="/bookshop" className={getLinkClass('/bookshop')}>Bookshop</Link>
                    <Link to="/history" className={getLinkClass('/history')}>Transaction History</Link>

                    {/* Your exact multi-admin check */}
                    {['24L-0561', '24L-3062', '24L-0556'].includes(dashboard?.roll_number) && (
                        <Link
                            to="/admin"
                            className={`block p-3 rounded cursor-pointer transition mt-8 ${
                                location.pathname === '/admin'
                                    ? 'bg-red-600 text-white font-bold'
                                    : 'bg-red-900/20 text-red-400 hover:bg-red-900/40 border border-red-900/50'
                            }`}
                        >
                            Admin Terminal
                        </Link>
                    )}
                </nav>
            </div>
            
            {/* Main Content Area */}
            <div className="flex flex-1 flex-col">
                {/* Topbar */}
                <header className="h-16 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-8">
                    <span className="text-gray-400 capitalize">Location: {location.pathname === '/' ? 'Hub' : location.pathname.substring(1)}</span>
                    <div className="flex items-center space-x-4">
                        {/* Fallback to user?.balance to prevent 0.00 flash during load */}
                        <span className="font-bold text-green-400 text-lg">
                            Wallet: Rs. {dashboard?.current_balance || user?.balance || '0.00'}
                        </span>
                        <button
                            onClick={handleLogout}
                            className="text-sm text-red-400 hover:text-red-300"
                        >
                            Logout
                        </button>
                    </div>
                </header>
                
                {/* Page Content */}
                <main className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}