import { Navigate, Outlet, Link, useNavigate, useLocation } from 'react-router-dom';
import useStore from '../store/useStore';

export default function CampusLayout() {
    const { token, user, dashboard, logout } = useStore();
    const navigate  = useNavigate();
    const location  = useLocation();

    if (!token) return <Navigate to="/login" replace />;

    const handleLogout = () => { logout(); navigate('/login'); };

    // Use startsWith so /esports/snake keeps the E-Sports link highlighted
    const getLinkClass = (path) => {
        const active = path === '/'
            ? location.pathname === '/'
            : location.pathname.startsWith(path);
        return `block p-3 rounded cursor-pointer transition ${
            active
                ? 'bg-blue-600 text-white font-bold'
                : 'bg-gray-800 text-gray-300 hover:bg-gray-700'
        }`;
    };

    return (
        <div className="flex h-screen w-screen bg-gray-900 text-white overflow-hidden">
            {/* Sidebar */}
            <div className="w-64 border-r border-gray-800 bg-gray-950 p-6 flex flex-col">
                <h2 className="text-2xl font-bold text-blue-500 mb-10 tracking-widest">
                    FAST Infinity
                </h2>
                <nav className="flex-1 space-y-4">
                    <Link to="/"          className={getLinkClass('/')}>Campus Hub</Link>
                    <Link to="/cafeteria" className={getLinkClass('/cafeteria')}>Cafeteria</Link>
                    <Link to="/esports"   className={getLinkClass('/esports')}>E-Sports Center</Link>
                    <Link to="/bookshop"  className={getLinkClass('/bookshop')}>Bookshop</Link>
                </nav>
            </div>

            {/* Main */}
            <div className="flex flex-1 flex-col">
                {/* Topbar */}
                <header className="h-16 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-8">
                    <span className="text-gray-400 capitalize">
                        Location: {location.pathname === '/' ? 'Hub' : location.pathname.substring(1).replace('/', ' › ')}
                    </span>
                    <div className="flex items-center space-x-4">
                        <span className="font-bold text-green-400 text-lg">
                            Wallet: Rs. {dashboard?.current_balance || '0.00'}
                        </span>
                        <button onClick={handleLogout} className="text-sm text-red-400 hover:text-red-300">
                            Logout
                        </button>
                    </div>
                </header>

                {/* Page content */}
                <main className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}
