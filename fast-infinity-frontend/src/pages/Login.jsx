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
        <div className="flex h-screen w-screen items-center justify-center bg-gray-900">
            <div className="w-full max-w-md rounded-xl bg-gray-800 p-8 shadow-2xl">
                <h1 className="mb-6 text-center text-3xl font-bold text-white">FAST Infinity</h1>
                <p className="mb-8 text-center text-gray-400">Campus Life Simulator</p>

                {error && <div className="mb-4 rounded bg-red-500/20 p-3 text-red-400 border border-red-500/50">{error}</div>}

                <form onSubmit={handleLogin} className="space-y-6">
                    <div>
                        <label className="block text-sm font-medium text-gray-300">Roll Number</label>
                        <input
                            type="text"
                            value={rollNumber}
                            onChange={(e) => setRollNumber(e.target.value)}
                            className="mt-1 w-full rounded-lg border border-gray-600 bg-gray-700 p-3 text-white focus:border-blue-500 focus:outline-none"
                            placeholder="e.g. 23L-0001"
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
                            placeholder="........"
                            required
                        />
                    </div>
                    <button
                        type="submit"
                        className="w-full rounded-lg bg-blue-600 p-3 font-bold text-white transition hover:bg-blue-700"
                    >
                        Enter Campus
                    </button>
                </form>
                <p className="mt-6 text-center text-sm text-gray-400">
                    New to campus? <Link to="/register" className="text-blue-400 hover:text-blue-300">Register here</Link>
                </p>
            </div>
        </div>
    );
}
