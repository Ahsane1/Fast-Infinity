import {BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import CampusLayout from './components/CampusLayout';

const HubPlaceHolder = () => <div><h1 className="text-3xl font-bold">Welcome to the Campus Hub</h1><p className="mt-4 text-gray-400">Your dashboard data will load here.</p></div>;

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public Route */}
                <Route path="/login" element={<Login />} />
                
                {/* Protected Routes (Wrapped in the Layout) */}
                <Route element={<CampusLayout />}>
                    <Route path="/" element={<HubPlaceHolder />} />
                    {/* We will add /cafeteria, /esports, and /bookshop here next */}
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
