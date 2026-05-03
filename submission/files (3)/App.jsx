import { BrowserRouter, Routes, Route } from 'react-router-dom';
import Login        from './pages/Login';
import CampusLayout from './components/CampusLayout';
import Hub          from './pages/Hub';
import Cafeteria    from './pages/Cafeteria';
import ESports      from './pages/ESports';
import Bookshop     from './pages/Bookshop';
import Snake        from './pages/games/Snake';
import Tetris       from './pages/games/Tetris';
import ReactionTap  from './pages/games/ReactionTap';
import FlappyBird   from './pages/games/FlappyBird';

export default function App() {
    return (
        <BrowserRouter>
            <Routes>
                <Route path="/login" element={<Login />} />
                <Route element={<CampusLayout />}>
                    <Route path="/"                  element={<Hub />} />
                    <Route path="/cafeteria"         element={<Cafeteria />} />
                    <Route path="/esports"           element={<ESports />} />
                    <Route path="/esports/snake"     element={<Snake />} />
                    <Route path="/esports/tetris"    element={<Tetris />} />
                    <Route path="/esports/reaction"  element={<ReactionTap />} />
                    <Route path="/esports/flappy"    element={<FlappyBird />} />
                    <Route path="/bookshop"          element={<Bookshop />} />
                </Route>
            </Routes>
        </BrowserRouter>
    );
}
