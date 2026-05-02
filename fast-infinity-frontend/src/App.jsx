import {BrowserRouter, Routes, Route } from 'react-router-dom';
import Login from './pages/Login';
import CampusLayout from './components/CampusLayout';
import Hub from './pages/Hub';
import Cafeteria from './pages/Cafeteria';
import ESports from './pages/ESports';
import Bookshop from './pages/Bookshop';
import Register from './pages/Register';
import History from './pages/History';
import Admin from './pages/Admin';
import Snake from './pages/games/Snake';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                {/* Public Route */}
                <Route path="/login" element={<Login />} />
                <Route path="/register" element={<Register />} />
                
                {/* Protected Routes (Wrapped in the Layout) */}
                <Route element={<CampusLayout />}>
                    <Route path="/" element={<Hub />} />
                    <Route path="/cafeteria" element={<Cafeteria />} />
                    <Route path="/esports" element={<ESports />} />
                    <Route path="/esports/snake" element={<Snake />} />
                    <Route path="/bookshop" element={<Bookshop />} />
                    <Route path="/history" element={<History />} />
                    <Route path="/admin" element={<Admin />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
