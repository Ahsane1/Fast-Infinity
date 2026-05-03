import { useState } from 'react';
import axiosClient from '../api/axiosClient';

export default function Admin() {
  // ── Refund States ──
  const [rollNumber, setRollNumber] = useState('');
  const [amount, setAmount] = useState('');
  
  // ── Restock States ──
  const [itemId, setItemId] = useState('');
  const [restockQty, setRestockQty] = useState('');

  // ── Shared Feedback States ──
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleRefund = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await axiosClient.post('/admin/wallet', {
        target_roll_number: rollNumber,
        amount: parseFloat(amount)
      });
      setMessage(response.data.message);
      setRollNumber('');
      setAmount('');
    } catch (err) {
      setError(err.response?.data?.error || 'Refund failed. Are you an admin?');
    }
  };

  const handleRestock = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await axiosClient.post('/admin/restock', {
        item_id: parseInt(itemId),
        add_quantity: parseInt(restockQty)
      });
      setMessage(response.data.message);
      setItemId('');
      setRestockQty('');
    } catch (err) {
      setError(err.response?.data?.error || 'Restock failed. Check item ID.');
    }
  };

  return (
    // Added mx-auto here to perfectly center the max-w-lg container on the screen
    <div className="space-y-8 max-w-lg mx-auto py-6">
      
      {/* Centered Header */}
      <div className="text-center">
        <h1 className="text-3xl font-bold text-white">Admin Terminal</h1>
        <p className="mt-2 text-gray-400">Manage campus operations and wallets.</p>
      </div>

      {/* Shared Feedback Messages */}
      {error && <div className="rounded bg-red-500/20 p-3 text-red-400 border border-red-500/50 shadow-lg">{error}</div>}
      {message && <div className="rounded bg-green-500/20 p-3 text-green-400 border border-green-500/50 shadow-lg">{message}</div>}

      {/* ── 1. Wallet Adjustment Card ── */}
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">Issue Refund / Adjustment</h2>
        <form onSubmit={handleRefund} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400">Target Roll Number</label>
            <input 
              type="text" 
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="mt-1 w-full rounded bg-gray-900 p-3 text-white border border-gray-700 focus:border-blue-500 outline-none transition"
              placeholder="e.g. 24L-0001"
              required 
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400">Amount (Rs.)</label>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded bg-gray-900 p-3 text-white border border-gray-700 focus:border-blue-500 outline-none transition"
              placeholder="e.g. 150.00"
              step="0.01"
              required 
            />
          </div>
          <button type="submit" className="w-full rounded bg-red-600 p-3 font-bold text-white hover:bg-red-500 transition">
            Process Wallet Update
          </button>
        </form>
      </div>

      {/* ── 2. Inventory Restock Card ── */}
      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6 shadow-2xl">
        <h2 className="text-xl font-bold text-white mb-4 border-b border-gray-700 pb-2">Quick Restock</h2>
        <form onSubmit={handleRestock} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400">Item ID</label>
            <input 
              type="number" 
              value={itemId}
              onChange={(e) => setItemId(e.target.value)}
              className="mt-1 w-full rounded bg-gray-900 p-3 text-white border border-gray-700 focus:border-blue-500 outline-none transition"
              placeholder="e.g. 5"
              required 
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400">Quantity to Add</label>
            <input 
              type="number" 
              value={restockQty}
              onChange={(e) => setRestockQty(e.target.value)}
              className="mt-1 w-full rounded bg-gray-900 p-3 text-white border border-gray-700 focus:border-blue-500 outline-none transition"
              placeholder="e.g. 20"
              min="1"
              required 
            />
          </div>
          <button type="submit" className="w-full rounded bg-blue-600 p-3 font-bold text-white hover:bg-blue-500 transition">
            Add to Inventory
          </button>
        </form>
      </div>

    </div>
  );
}