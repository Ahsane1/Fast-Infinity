require('dotenv').config();
const express = require('express');
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

const { loginStudent } = require('./controllers/authController');
const { getStudentDashboard } = require('./controllers/dashboardController');

// Define routes
app.post('/api/auth/login', loginStudent);
app.get('/api/dashboard/:id', getStudentDashboard);

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server executing on port ${PORT}`);
});
