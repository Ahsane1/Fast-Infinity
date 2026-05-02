import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

export default function Register() {
  const [rollNumber, setRollNumber] = useState('');
  const [fullName, setFullName] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const [loading, setLoading] = useState(false);
  const navigate = useNavigate();

  const handleRegister = async (e) => {
    e.preventDefault();
    setError('');
    setSuccess('');
    setLoading(true);
    
    try {
      const response = await axiosClient.post('/auth/register', {
        roll_number: rollNumber,
        full_name: fullName,
        password: password
      });
      
      setSuccess(response.data.message);
      
      // Auto-redirect to login after 2 seconds
      setTimeout(() => navigate('/login'), 2000);
    } catch (err) {
      setError(err.response?.data?.error || 'Registration failed. Check your connection.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="flex h-screen w-screen items-center justify-center bg-gray-900">
      <div className="w-full max-w-md rounded-xl bg-gray-800 p-8 shadow-2xl">
        <h1 className="mb-6 text-center text-3xl font-bold text-white">Enroll Now</h1>
        <p className="mb-8 text-center text-gray-400">Join the FAST Infinity Campus</p>
        
        {error && <div className="mb-4 rounded bg-red-500/20 p-3 text-red-400 border border-red-500/50">{error}</div>}
        {success && <div className="mb-4 rounded bg-green-500/20 p-3 text-green-400 border border-green-500/50">{success}</div>}
        
        <form onSubmit={handleRegister} className="space-y-6">
          <div>
            <label className="block text-sm font-medium text-gray-300">Roll Number</label>
            <input 
              type="text" 
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 p-3 text-white focus:border-blue-500 focus:outline-none"
              placeholder="e.g. 24L-9999"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Full Name</label>
            <input 
              type="text" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 p-3 text-white focus:border-blue-500 focus:outline-none"
              placeholder="e.g. Ahmed Khan"
              required 
            />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-300">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 p-3 text-white focus:border-blue-500 focus:outline-none"
              placeholder="••••••••"
              required 
            />
          </div>
          <button 
            type="submit" 
            disabled={loading || success}
            className="w-full rounded-lg bg-green-600 p-3 font-bold text-white transition hover:bg-green-500 disabled:opacity-50"
          >
            {loading ? 'Registering...' : 'Complete Enrollment'}
          </button>
        </form>

        <p className="mt-6 text-center text-sm text-gray-400">
          Already have an account? <Link to="/login" className="text-blue-400 hover:text-blue-300">Login here</Link>
        </p>
      </div>
    </div>
  );
}
