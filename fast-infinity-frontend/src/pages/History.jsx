import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import useStore from '../store/useStore';

const formatRs = (amount) => {
    return Number(amount || 0).toLocaleString('en-US', {
        minimumFractionDigits: 2,
        maximumFractionDigits: 2
    });
  };

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });
  
  // New State for our Date Filter
  const [filter, setFilter] = useState('ALL'); 
  
  const addBalance = useStore((state) => state.addBalance);

  const fetchHistory = async () => {
    try {
      const response = await axiosClient.get('/wallet/history');
      setHistory(response.data);
    } catch (err) {
      console.error("Failed to load history");
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    fetchHistory();
  }, []);

  const handleRefund = async (transaction_id, amount) => {
    setMsg({ text: 'Processing...', type: 'info' });
    try {
      const response = await axiosClient.post('/wallet/refund', { transaction_id });
      setMsg({ text: response.data.message, type: 'success' });
      addBalance(Math.abs(amount));
      fetchHistory(); // Refresh the table instantly
    } catch (err) {
      setMsg({ text: err.response?.data?.error || 'Refund failed.', type: 'error' });
    }
  };

  const isPastOneWeek = (timestamp) => {
    const txDate = new Date(timestamp);
    const diffDays = Math.ceil(Math.abs(new Date() - txDate) / (1000 * 60 * 60 * 24));
    return diffDays > 7;
  };

  // BULLETPROOF ID MATCHING
  const refundedCafeteriaIds = history
    .filter(tx => tx.transaction_type === 'MANUAL_ADJUSTMENT' && tx.cafeteria_order_id)
    .map(tx => tx.cafeteria_order_id);

  const refundedBookshopReceipts = history
    .filter(tx => tx.transaction_type === 'MANUAL_ADJUSTMENT' && tx.bookshop_receipt)
    .map(tx => tx.bookshop_receipt);

  // --- FILTERING LOGIC ---
  const getFilteredHistory = () => {
    const now = new Date();
    if (filter === '7DAYS') {
      const oneWeekAgo = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      return history.filter(tx => new Date(tx.transaction_timestamp) >= oneWeekAgo);
    }
    if (filter === '30DAYS') {
      const thirtyDaysAgo = new Date(now.getTime() - 30 * 24 * 60 * 60 * 1000);
      return history.filter(tx => new Date(tx.transaction_timestamp) >= thirtyDaysAgo);
    }
    return history;
  };

  const displayedHistory = getFilteredHistory();

  if (loading) return <div className="text-gray-400">Loading ledger...</div>;

  return (
    <div className="space-y-6">
      <h1 className="text-3xl font-bold text-white">Transaction History</h1>
      <p className="text-gray-400">Your complete financial ledger. Purchases are eligible for a refund within 7 days.</p>

      {msg.text && (
        <div className={`p-4 rounded-xl border font-medium ${
          msg.type === 'error' ? 'bg-red-900/30 text-red-400 border-red-700' : 
          msg.type === 'success' ? 'bg-green-900/30 text-green-400 border-green-700' : 
          'bg-blue-900/30 text-blue-400 border-blue-700'
        }`}>
          {msg.text}
        </div>
      )}

      {/* FILTER CONTROLS */}
      <div className="flex items-center space-x-3 mb-4">
        <span className="text-sm font-bold text-gray-400 uppercase tracking-wider">Filter By Date:</span>
        <div className="flex space-x-2 bg-gray-800 p-1 rounded-lg border border-gray-700">
          <button 
            onClick={() => setFilter('ALL')}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${filter === 'ALL' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
          >
            All Time
          </button>
          <button 
            onClick={() => setFilter('7DAYS')}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${filter === '7DAYS' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
          >
            Last 7 Days
          </button>
          <button 
            onClick={() => setFilter('30DAYS')}
            className={`px-4 py-1.5 text-sm font-bold rounded-md transition ${filter === '30DAYS' ? 'bg-blue-600 text-white' : 'text-gray-400 hover:text-white hover:bg-gray-700'}`}
          >
            Last 30 Days
          </button>
        </div>
      </div>

      <div className="overflow-hidden rounded-xl border border-gray-700 bg-gray-800">
        <table className="w-full text-left text-sm text-gray-300">
          <thead className="bg-gray-900 text-xs uppercase text-gray-400">
            <tr>
              <th className="px-6 py-4">Date</th>
              <th className="px-6 py-4">Description</th>
              <th className="px-6 py-4">Type</th>
              <th className="px-6 py-4 text-right">Amount</th>
              <th className="px-6 py-4 text-center">Action</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-700">
            {displayedHistory.length === 0 ? (
              <tr><td colSpan="5" className="p-6 text-center text-gray-500">No transactions found for this time period.</td></tr>
            ) : (
              displayedHistory.map((tx) => {
                const canRefund = (tx.transaction_type === 'CAFETERIA_SPEND' || tx.transaction_type === 'BOOKSHOP_SPEND');
                
                const isRefunded = 
                  (tx.transaction_type === 'CAFETERIA_SPEND' && refundedCafeteriaIds.includes(tx.cafeteria_order_id)) ||
                  (tx.transaction_type === 'BOOKSHOP_SPEND' && refundedBookshopReceipts.includes(tx.bookshop_receipt));
                
                const expired = !isRefunded && isPastOneWeek(tx.transaction_timestamp);

                return (
                  <tr key={tx.transaction_id} className="hover:bg-gray-750 transition">
                    <td className="whitespace-nowrap px-6 py-4 text-gray-400">
                      {new Date(tx.transaction_timestamp).toLocaleDateString()}
                    </td>
                    <td className="px-6 py-4 text-white font-medium">{tx.description}</td>
                    <td className="px-6 py-4 text-xs">
                      <span className="rounded bg-gray-700 px-2 py-1">{tx.transaction_type.replace('_', ' ')}</span>
                    </td>
                    <td className={`px-6 py-4 text-right font-bold ${tx.amount > 0 ? 'text-green-400' : 'text-red-400'}`}>
                      {tx.amount > 0 ? '+' : ''}{tx.amount}
                    </td>
                    <td className="px-6 py-4 text-center">
                      {canRefund && (
                        <button 
                          onClick={() => handleRefund(tx.transaction_id, tx.amount)}
                          disabled={expired || isRefunded}
                          className={`px-3 py-1 text-xs font-bold rounded transition ${
                            isRefunded 
                              ? 'bg-green-900 text-green-400 border border-green-700 cursor-not-allowed opacity-100'
                              : expired 
                                ? 'bg-gray-700 text-gray-500 cursor-not-allowed' 
                                : 'bg-red-900/50 text-red-400 border border-red-700 hover:bg-red-600 hover:text-white'
                          }`}
                        >
                          {isRefunded ? 'Refunded' : expired ? 'Expired' : 'Refund'}
                        </button>
                      )}
                    </td>
                  </tr>
                );
              })
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
