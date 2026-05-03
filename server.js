require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const { verifyToken } = require('./middleware/authMiddleware');

const { loginStudent, registerStudent, resetPassword } = require('./controllers/authController');
const { getStudentDashboard } = require('./controllers/dashboardController');
const { recordSession } = require('./controllers/gameController');
const { placeOrder, getMenu } = require('./controllers/cafeteriaController');
const { placeBookshopOrder, getInventory } = require('./controllers/bookshopController');
const { restockItem, adjustWallet, addCafeteriaItem, addBookshopItem } = require('./controllers/adminController');
const { getTransactionHistory, processRefund } = require('./controllers/walletController');

// Health check
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'Server is running, database is ready.' });
});

// Auth (public)
app.post('/api/auth/login', loginStudent);
app.post('/api/auth/register', registerStudent);
app.post('/api/auth/reset-password', resetPassword);

// Dashboard
app.get('/api/dashboard/:id', verifyToken, getStudentDashboard);

// Games
app.post('/api/games/session', verifyToken, recordSession);

// Cafeteria
app.get('/api/cafeteria/menu', verifyToken, getMenu);
app.post('/api/cafeteria/checkout', verifyToken, placeOrder);

// Bookshop
app.get('/api/bookshop/inventory', verifyToken, getInventory);
app.post('/api/bookshop/checkout', verifyToken, placeBookshopOrder);

// Admin
app.post('/api/admin/restock', verifyToken, restockItem);
app.post('/api/admin/wallet', verifyToken, adjustWallet);
app.post('/api/admin/cafeteria/add-item', verifyToken, addCafeteriaItem);
app.post('/api/admin/bookshop/add-item', verifyToken, addBookshopItem);

// Wallet
app.get('/api/wallet/history', verifyToken, getTransactionHistory);
app.post('/api/wallet/refund', verifyToken, processRefund);


const PORT = process.env.PORT || 5050;
app.listen(PORT, () => {
    console.log(`Server executing on port ${PORT}`);
});
