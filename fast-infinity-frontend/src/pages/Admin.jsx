import { useState } from 'react';
import axiosClient from '../api/axiosClient';

export default function Admin() {
  const [rollNumber, setRollNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  const handleRefund = async (e) => {
    e.preventDefault();
    setMessage('');
    setError('');

    try {
      const response = await axiosClient.post('/admin/wallet', {
        target_roll_number: rollNumber, // Sending the text roll number now
        amount: parseFloat(amount)
      });
      setMessage(response.data.message);
      setRollNumber('');
      setAmount('');
    } catch (err) {
      setError(err.response?.data?.error || 'Refund failed. Are you an admin?');
    }
  };

  return (
    <div className="space-y-6 max-w-lg">
      <h1 className="text-3xl font-bold text-white">Admin Terminal: Refunds</h1>
      <p className="text-gray-400">Process manual wallet adjustments and refunds using Roll Numbers.</p>

      <div className="rounded-xl border border-gray-700 bg-gray-800 p-6">
        {error && <div className="mb-4 rounded bg-red-500/20 p-3 text-red-400 border border-red-500/50">{error}</div>}
        {message && <div className="mb-4 rounded bg-green-500/20 p-3 text-green-400 border border-green-500/50">{message}</div>}

        <form onSubmit={handleRefund} className="space-y-4">
          <div>
            <label className="block text-sm text-gray-400">Target Roll Number</label>
            <input 
              type="text" 
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="mt-1 w-full rounded bg-gray-900 p-3 text-white border border-gray-700 focus:border-blue-500 outline-none"
              placeholder="e.g. 23L-0001"
              required 
            />
          </div>
          <div>
            <label className="block text-sm text-gray-400">Refund Amount (Rs.)</label>
            <input 
              type="number" 
              value={amount}
              onChange={(e) => setAmount(e.target.value)}
              className="mt-1 w-full rounded bg-gray-900 p-3 text-white border border-gray-700 focus:border-blue-500 outline-none"
              placeholder="e.g. 150.00"
              step="0.01"
              required 
            />
          </div>
          <button type="submit" className="w-full rounded bg-red-600 p-3 font-bold text-white hover:bg-red-500 transition">
            Issue Refund
          </button>
        </form>
      </div>
    </div>
  );
}
