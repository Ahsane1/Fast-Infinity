import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import axiosClient from '../api/axiosClient';

export default function ForgotPassword() {
    const [rollNumber, setRollNumber] = useState('');
    const [fullName, setFullName] = useState('');
    const [newPassword, setNewPassword] = useState('');
    const [msg, setMsg] = useState({ text: '', type: '' });
    const [loading, setLoading] = useState(false);
    const navigate = useNavigate();

    const handleReset = async (e) => {
        e.preventDefault();
        setMsg({ text: '', type: '' });
        setLoading(true);

        try {
            const response = await axiosClient.post('/auth/reset-password', {
                roll_number: rollNumber,
                full_name: fullName,
                new_password: newPassword
            });

            setMsg({ text: response.data.message, type: 'success' });
            
            // Redirect to login after a short delay
            setTimeout(() => navigate('/login'), 2500);
        } catch (err) {
            setMsg({ text: err.response?.data?.error || 'Password reset failed.', type: 'error' });
        } finally {
            setLoading(false);
        }
    };

    return (
        <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-950 to-slate-900">
            <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] backdrop-blur-lg">
                
                <h1 className="mb-2 text-center text-3xl font-bold text-white tracking-wide">Reset Password</h1>
                <p className="mb-8 text-center text-sm text-gray-300">Verify your identity to create a new password</p>

                {msg.text && (
                    <div className={`mb-6 rounded-xl p-3 text-sm border backdrop-blur-md text-center ${
                        msg.type === 'error' ? 'bg-red-500/20 text-red-300 border-red-500/30' : 'bg-green-500/20 text-green-300 border-green-500/30'
                    }`}>
                        {msg.text}
                    </div>
                )}

                <form onSubmit={handleReset} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1.5">Roll Number</label>
                        <input
                            type="text"
                            value={rollNumber}
                            onChange={(e) => setRollNumber(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/20 p-3.5 text-white placeholder-gray-500 outline-none transition focus:border-cyan-400/50 focus:bg-black/40"
                            placeholder="e.g. 24L-1234"
                            required
                        />
                    </div>
                    
                    <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1.5">Full Name (Exact Match)</label>
                        <input
                            type="text"
                            value={fullName}
                            onChange={(e) => setFullName(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/20 p-3.5 text-white placeholder-gray-500 outline-none transition focus:border-cyan-400/50 focus:bg-black/40"
                            placeholder="e.g. Ali Hassan"
                            required
                        />
                    </div>

                    <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1.5">New Password</label>
                        <input
                            type="password"
                            value={newPassword}
                            onChange={(e) => setNewPassword(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/20 p-3.5 text-white placeholder-gray-500 outline-none transition focus:border-cyan-400/50 focus:bg-black/40"
                            placeholder="••••••••"
                            required
                        />
                    </div>

                    <button
                        type="submit"
                        disabled={loading || msg.type === 'success'}
                        className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 p-3.5 font-bold text-white shadow-lg transition hover:from-cyan-300 hover:to-blue-500 hover:shadow-cyan-500/25 active:scale-[0.98] disabled:opacity-50"
                    >
                        {loading ? 'Resetting...' : 'Update Password'}
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-gray-300">
                    Remembered it? <Link to="/login" className="font-semibold text-cyan-400 hover:text-cyan-300 transition">Back to Login</Link>
                </p>
            </div>
        </div>
    );
}
