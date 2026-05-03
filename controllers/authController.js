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

        // 2. THE SECURITY GATE: Compare raw password against the database hash
        const isValid = await bcrypt.compare(password, student.password_hash);
        if (!isValid) {
            return res.status(401).json({ error: 'Invalid credentials.' });
        }
        
        // 3. Generate the JWT
        const token = jwt.sign(
            { student_id: student.student_id, roll_number: student.roll_number },
            process.env.JWT_SECRET || 'fallback_secret_key',
            { expiresIn: '24h' }
        );

        // 4. Send back the token and basic user data
        res.status(200).json({
            message: 'Login successful',
            token,
            student: {
                id: student.student_id,
                name: student.full_name,
                roll_number: student.roll_number,
                balance: student.current_balance
            }
        });
    }
    catch (error) {
        console.error('Login error:', error);
        res.status(500).json({ error: 'Internal server error' });
    }
};

const registerStudent = async (req, res) => {
    const { roll_number, full_name, password } = req.body;

    if (!roll_number || !full_name || !password) {
        return res.status(400).json({ error: 'Roll number, full name, and password are required' });
    }

    try {
        // 1. Hash the password before it ever touches the database
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(password, saltRounds);

        // 2. Send the secure hash to your teammate's procedure
        await pool.query(
            'CALL sp_register_student($1, $2, $3, $4)', 
            [roll_number, full_name, hashedPassword, 0.00]
        );

        res.status(201).json({ message: 'Registration successful! You can now log in.' });
    } catch (error) {
        console.error('Registration error:', error.message);
        
        if (error.message.includes('DUPLICATE_ROLL') || error.code === '23505') {
            return res.status(409).json({ error: 'This roll number is already registered.' });
        }
        res.status(500).json({ error: 'Failed to register student.' });
    }
};

const resetPassword = async (req, res) => {
    const { roll_number, full_name, new_password } = req.body;

    if (!roll_number || !full_name || !new_password) {
        return res.status(400).json({ error: 'Roll number, full name, and new password are required.' });
    }

    try {
        // 1. Verify the student exists and the name matches exactly
        const userCheck = await pool.query(
            'SELECT * FROM Students WHERE roll_number = $1 AND full_name = $2',
            [roll_number, full_name]
        );

        if (userCheck.rows.length === 0) {
            return res.status(404).json({ error: 'No student found with that Roll Number and Name combination.' });
        }

        // 2. Hash the new password
        const saltRounds = 10;
        const hashedPassword = await bcrypt.hash(new_password, saltRounds);

        // 3. Update the database
        await pool.query(
            'UPDATE Students SET password_hash = $1 WHERE roll_number = $2',
            [hashedPassword, roll_number]
        );

        res.status(200).json({ message: 'Password reset successfully! You can now log in.' });
    } catch (error) {
        console.error('Password reset error:', error);
        res.status(500).json({ error: 'Failed to reset password.' });
    }
};

module.exports = { loginStudent, registerStudent, resetPassword };
