require('dotenv').config();
const express = require('express');
const cors = require('cors');

// Initialize the express application
const app = express();

// Global middleware
app.use(cors());
app.use(express.json());

// Custom middleware
const { verifyToken } = require('./middleware/authMiddleware');

// Import controllers
const { loginStudent } = require('./controllers/authController');
const { getStudentDashboard } = require('./controllers/dashboardController');
const { recordSession } = require('./controllers/gameController');
const { placeOrder, getMenu } = require('./controllers/cafeteriaController');
const { placeBookshopOrder, getInventory } = require('./controllers/bookshopController');
const { restockItem, adjustWallet } = require('./controllers/adminController');

// ------------------
// --- API ROUTES ---
// ------------------

// basic health check
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'Server is running, database is ready.' });
});

// Authentication route (public)
app.post('/api/auth/login', loginStudent);

// Student Dashboard Route (Protected)
app.get('/api/dashboard/:id', verifyToken, getStudentDashboard);

// E-Sports Game Engine Route (Protected)
app.post('/api/games/session', verifyToken, recordSession);

// Cafeteria Checkout Route (Protected)
app.get('/api/cafeteria/menu', verifyToken, getMenu);
app.post('/api/cafeteria/checkout', verifyToken, placeOrder);

// Bookshop order Route (Protected)
app.get('/api/bookshop/inventory', verifyToken, getInventory);
app.post('/api/bookshop/checkout', verifyToken, placeBookshopOrder);

// Restock item route (admin)
app.post('/api/admin/restock', verifyToken, restockItem);
app.post('/api/admin/wallet', verifyToken, adjustWallet);

// ------------------------
// --- SERVER BOOTSTRAP ---
// ------------------------

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server executing on port ${PORT}`);
});
