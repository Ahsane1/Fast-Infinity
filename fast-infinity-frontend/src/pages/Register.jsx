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
    <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-950 to-slate-900">
      
      {/* The Glass Card */}
      <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] backdrop-blur-lg">
        
        <h1 className="mb-2 text-center text-3xl font-bold text-white tracking-wide">Enroll Now</h1>
        <p className="mb-8 text-center text-sm text-gray-300">Join the FAST INIFINITY</p>
        
        {error && (
            <div className="mb-6 rounded-xl bg-red-500/20 p-3 text-sm text-red-300 border border-red-500/30 backdrop-blur-md text-center">
                {error}
            </div>
        )}
        {success && (
            <div className="mb-6 rounded-xl bg-green-500/20 p-3 text-sm text-green-300 border border-green-500/30 backdrop-blur-md text-center">
                {success}
            </div>
        )}
        
        <form onSubmit={handleRegister} className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1.5">Roll Number</label>
            <input 
              type="text" 
              value={rollNumber}
              onChange={(e) => setRollNumber(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 p-3.5 text-white placeholder-gray-500 outline-none transition focus:border-cyan-400/50 focus:bg-black/40"
              placeholder="e.g. 24L-9999"
              required 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1.5">Full Name</label>
            <input 
              type="text" 
              value={fullName}
              onChange={(e) => setFullName(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 p-3.5 text-white placeholder-gray-500 outline-none transition focus:border-cyan-400/50 focus:bg-black/40"
              placeholder="e.g. Ahmed Khan"
              required 
            />
          </div>
          
          <div>
            <label className="block text-sm font-medium text-gray-200 mb-1.5">Password</label>
            <input 
              type="password" 
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              className="w-full rounded-xl border border-white/10 bg-black/20 p-3.5 text-white placeholder-gray-500 outline-none transition focus:border-cyan-400/50 focus:bg-black/40"
              placeholder="••••••••"
              required 
            />
          </div>
          
          <button 
            type="submit" 
            disabled={loading || success}
            className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 p-3.5 font-bold text-white shadow-lg transition hover:from-cyan-300 hover:to-blue-500 hover:shadow-cyan-500/25 active:scale-[0.98] disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {loading ? 'Registering...' : 'Complete Enrollment'}
          </button>
        </form>

        <p className="mt-8 text-center text-sm text-gray-300">
          Already have an account? <Link to="/login" className="font-semibold text-cyan-400 hover:text-cyan-300 transition">Login here</Link>
        </p>
      </div>
    </div>
  );
}