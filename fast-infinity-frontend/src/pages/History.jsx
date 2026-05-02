import { useEffect, useState } from 'react';
import axiosClient from '../api/axiosClient';
import useStore from '../store/useStore';

export default function History() {
  const [history, setHistory] = useState([]);
  const [loading, setLoading] = useState(true);
  const [msg, setMsg] = useState({ text: '', type: '' });
  
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

  // BULLETPROOF ID MATCHING: Find all order IDs that have a corresponding refund adjustment
  const refundedCafeteriaIds = history
    .filter(tx => tx.transaction_type === 'MANUAL_ADJUSTMENT' && tx.cafeteria_order_id)
    .map(tx => tx.cafeteria_order_id);

  const refundedBookshopReceipts = history
    .filter(tx => tx.transaction_type === 'MANUAL_ADJUSTMENT' && tx.bookshop_receipt)
    .map(tx => tx.bookshop_receipt);

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
            {history.length === 0 ? (
              <tr><td colSpan="5" className="p-6 text-center text-gray-500">No transactions found.</td></tr>
            ) : (
              history.map((tx) => {
                const canRefund = (tx.transaction_type === 'CAFETERIA_SPEND' || tx.transaction_type === 'BOOKSHOP_SPEND');
                
                // Check if this specific row's ID exists in our array of refunded IDs
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
