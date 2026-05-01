const { pool } = require('../config/db');
const bcrypt = require('bcrypt');
const jwt = require('jsonwebtoken');

const loginStudent = async (req, res) => {
    const { roll_number, password } = req.body;

    if (!roll_number || !password) {
        return res.status(400).json({ error: 'Roll number and password are required' });
    }

    try {
        // 1. Find the student
        const result = await pool.query('SELECT * FROM Students WHERE roll_number = $1', [roll_number]);

        if (result.rows.length === 0) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }

        const student = result.rows[0];

        // 2. Verify the password
        //
        //
        // const isValid = await bcrypt.compare(password, student.password_hash);
        // if (!isValid) return res.status(401).json({ error: 'Invalid credentials.' });
        
        // 3. Generate the JWT
        const token = jwt.sign(
            { student_id: student.student_id, roll_number: student.roll_number },
            process.env.JWT_SECRET,
            { expiresIN: '24h' }
        );

        // 4. Send back the token and basic user data
        res.status(200).json({
            message: 'Login successful',
            token,
            student: {
                id: student.student_id,
                name: student.full_name,
                balance: student.current_balance
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

module.exports = { loginStudent };
