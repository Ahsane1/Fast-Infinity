import { useState } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import useStore from '../store/useStore';
import axiosClient from '../api/axiosClient';

export default function Login() {
    const [rollNumber, setRollNumber] = useState('');
    const [password, setPassword] = useState('');
    const [error, setError] = useState('');
    const login = useStore((state) => state.login);
    const navigate = useNavigate();

    const handleLogin = async (e) => {
        e.preventDefault();
        setError('');

        try {
            const response = await axiosClient.post('/auth/login', {
                roll_number: rollNumber,
                password: password
            });

            login(response.data.student, response.data.token);
            navigate('/');
        }
        catch (err) {
            setError(err.response?.data?.error || 'Login failed. Check your connection.');
        }
    };

    return (
        // 1. The Background: To make glassmorphism work, you need a vibrant or textured background. 
        // I've added a deep purple/indigo gradient here to match your screenshot's vibe.
        // If you have a specific background image, you can replace this gradient with: bg-[url('/path-to-image.jpg')] bg-cover bg-center
        <div className="flex h-screen w-screen items-center justify-center bg-gradient-to-br from-gray-900 via-indigo-950 to-slate-900">
            
            {/* 2. The Glass Card: backdrop-blur-lg creates the frost, bg-white/10 adds the tint, border-white/20 adds the shine */}
            <div className="w-full max-w-md rounded-3xl border border-white/20 bg-white/10 p-10 shadow-[0_8px_32px_0_rgba(0,0,0,0.3)] backdrop-blur-lg">
                
                <h1 className="mb-2 text-center text-3xl font-bold text-white tracking-wide">Welcome Back</h1>
                <p className="mb-8 text-center text-sm text-gray-300">Sign in to continue to FAST INFINITY</p>

                {error && (
                    <div className="mb-6 rounded-xl bg-red-500/20 p-3 text-sm text-red-300 border border-red-500/30 backdrop-blur-md text-center">
                        {error}
                    </div>
                )}

                <form onSubmit={handleLogin} className="space-y-5">
                    <div>
                        <label className="block text-sm font-medium text-gray-200 mb-1.5">Roll Number</label>
                        {/* 3. The Inputs: Dark, translucent backgrounds with subtle borders */}
                        <input
                            type="text"
                            value={rollNumber}
                            onChange={(e) => setRollNumber(e.target.value)}
                            className="w-full rounded-xl border border-white/10 bg-black/20 p-3.5 text-white placeholder-gray-500 outline-none transition focus:border-cyan-400/50 focus:bg-black/40"
                            placeholder="Enter your roll number"
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
                            placeholder="Enter your password"
                            required
                        />
                        <div className="mt-2 text-right">
                            <Link to="/forgot-password" className="text-xs text-gray-400 hover:text-cyan-300 transition">Forgot Password?</Link>
                        </div>
                    </div>

                    {/* 4. The Button: A vibrant gradient matching the image */}
                    <button
                        type="submit"
                        className="mt-4 w-full rounded-xl bg-gradient-to-r from-cyan-400 to-blue-600 p-3.5 font-bold text-white shadow-lg transition hover:from-cyan-300 hover:to-blue-500 hover:shadow-cyan-500/25 active:scale-[0.98]"
                    >
                        Login
                    </button>
                </form>

                <p className="mt-8 text-center text-sm text-gray-300">
                    Don't have an account? <Link to="/register" className="font-semibold text-cyan-400 hover:text-cyan-300 transition">Sign up</Link>
                </p>
            </div>
        </div>
    );
}
