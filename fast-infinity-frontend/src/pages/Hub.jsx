import { useEffect, useState } from 'react';
import useStore from '../store/useStore';
import axiosClient from '../api/axiosClient';


const formatRs = (amount) => {
    return Number(amount || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
};

export default function Hub() {
    const { user, dashboard, setDashboardData } = useStore();
    const [loading, setLoading] = useState(true);
    const [error, setError] = useState('');

    useEffect(() => {
        const fetchDashboard = async () => {
            try {
                const response = await axiosClient.get(`/dashboard/${user.id}`);
                setDashboardData(response.data);
                setLoading(false);
            }
            catch (err) {
                setError('Failed to load dashboard data.');
                setLoading(false);
            }
        };

        if (user?.id) {
            fetchDashboard();
        }
    }, [user]);

    if (loading) return <div className="text-gray-400">Loading your campus data...</div>;
    if (error) return <div className="text-red-400">{error}</div>;
    if (!dashboard) return null;
    
    return (
        <div className="space-y-6">
            <div>
                <h1 className="text-3xl font-bold text-white">Welcome back, {user.name}</h1>
                <p className="mt-2 text-gray-400">Roll Number: {dashboard.roll_number}</p>
            </div>

            <div className="grid grid-cols-1 gap-6 md:grid-cols-3">
                {/* Wallet Card */}
                <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
                    <h3 className="text-sm font-medium text-gray-400">Current Balance</h3>
                    <p className="mt-2 text-4xl font-bold text-green-400">Rs. {formatRs(dashboard.current_balance)}</p>
                </div>
            
                {/* E-Sports Earnings */}
                <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
                    <h3 className="text-sm font-medium text-gray-400">Total Game Earnings</h3>
                    <p className="mt-2 text-3xl font-bold text-blue-400">Rs. {formatRs(dashboard.total_game_earnings)}</p>
                    <p className="mt-1 text-sm text-gray-500">{dashboard.total_game_sessions} sessions played</p>
                </div>

                {/* Total Spend */}
                <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-lg">
                    <h3 className="text-sm font-medium text-gray-400">Total Campus Spend</h3>
                    <p className="mt-2 text-3xl font-bold text-red-400">
                        Rs. {formatRs((parseFloat(dashboard.total_cafeteria_spend) + parseFloat(dashboard.total_bookshop_spend)))}
                    </p>
                    <p className="mt-1 text-sm text-gray-500">
                        {dashboard.total_cafeteria_orders} food orders, {dashboard.total_bookshop_orders} bookshop orders
                    </p>
                </div>
            </div>
        </div>
    );
}
