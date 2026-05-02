const { pool } = require('../config/db');

const ADMIN_ROLL_NUMBER = '24L-0561'; // current admin

const restockItem = async (req, res) => {

    // only allow the designated admin
    if (req.user.roll_number !== ADMIN_ROLL_NUMBER) {
        return res.status(403).json({ error: 'FORBIDDEN: You do not have admin priveleges.' });
    }

    const { item_id, add_quantity } = req.body;

    if (!item_id || !add_quantity || add_quantity <= 0) {
        return res.status(400).json({ error: 'Valid item ID and positive quantity are required.' });
    }

    try {
        await pool.query('CALL sp_restock_cafeteria_item($1, $2)', [item_id, add_quantity]);

        res.status(200).json({
            message: `Successfully restocked item ${item_id} with ${add_quantity} units`
        });
    }
    catch (error) {
        console.error('Restock error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

const adjustWallet = async (req, res) => {
    // SECURITY GATE: Only allow the designated admin
    if (req.user.roll_number !== ADMIN_ROLL_NUMBER) {
        return res.status(403).json({ error: 'FORBIDDEN: You do not have admin privileges.' });
    }

    // We now accept target_roll_number instead of target_student_id
    const { target_roll_number, amount } = req.body;

    if (!target_roll_number || amount === undefined || amount === 0) {
        return res.status(400).json({ error: 'Valid target roll number and non-zero amount are required.' });
    }

    try {
        // 1. Look up the actual student_id from the database using the roll number
        const studentQuery = await pool.query('SELECT student_id FROM Students WHERE roll_number = $1', [target_roll_number]);
        
        if (studentQuery.rows.length === 0) {
            return res.status(404).json({ error: `Student with roll number ${target_roll_number} not found.` });
        }

        const target_student_id = studentQuery.rows[0].student_id;

        // 2. Call your teammate's procedure using the correct INT ID
        await pool.query('CALL sp_manual_wallet_adjustment($1, $2)', [target_student_id, amount]);
        
        res.status(200).json({ 
            message: `Successfully adjusted wallet for ${target_roll_number} by Rs. ${amount}.` 
        });

    } catch (error) {
        console.error('Wallet adjustment error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

module.exports = { restockItem, adjustWallet };
