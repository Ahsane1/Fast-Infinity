import { Navigate, Outlet } from 'react-router-dom';
import useStore from '../store/useStore';

export default function CampusLayout() {
    const token = useStore((state) => state.token);

    if (!token) {
        return <Navigate to="/login" replace />;
    }

    return (
        <div className="flex h-screen w-screen bg-gray-900 text-white overflow-hidden">
            {/* Sidebar Placeholder */}
            <div className="w-64 border-r border-gray-800 bg-gray-950 p-6 flex flex-col">
                <h2 className="text-2xl font-bold text-blue-500 mb-10">FAST Map</h2>
                <nav className="flex-1 space-y-4">
                    <div classname="p-3 bg-gray-800 rounded text-gray-300 cursor-pointer hover:bg-gray-700">Hub Dashboard</div>
                    <div classname="p-3 bg-gray-800 rounded text-gray-300 cursor-pointer hover:bg-gray-700">Cafeteria</div>
                    <div classname="p-3 bg-gray-800 rounded text-gray-300 cursor-pointer hover:bg-gray-700">E-Sports Center</div>
                    <div classname="p-3 bg-gray-800 rounded text-gray-300 cursor-pointer hover:bg-gray-700">Bookshop</div>
                </nav>
            </div>
            
            {/* Main Content Area */}
            <div className="flex flex-1 flex-col">
                {/* Topbard Placeholder (Wallet) */}
                <header className="h-16 border-b border-gray-800 bg-gray-950 flex items-center justify-between px-8">
                    <span className="text-gray-400">Location: Campus Hub</span>
                    <div className="flex items-center space-x-4">
                        <span className="font-bold text-green-400">Wallet: Rs. 0.00</span>
                        <button className="text-sm text-red-400 hover:text-red-300">Logout</button>
                    </div>
                </header>
                
                {/* The actual page content loads inside this Outlet */}
                <main className="flex-1 overflow-y-auto p-8">
                    <Outlet />
                </main>
            </div>
        </div>
    );
}


