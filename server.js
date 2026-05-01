require('dotenv').config();
const express = require('express')
const cors = require('cors');

const app = express();

app.use(cors());
app.use(express.json());

// Basic health check route
app.get('/api/health', (req, res) => {
    res.status(200).json({ status: 'Server is running, database is ready.' });
});

// You will import and use your real routes here later

const PORT = process.env.PORT || 5000;

app.listen(PORT, () => {
    console.log(`Server executing on port ${PORT}`);
});
