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

    if (req.user.roll_number !== ADMIN_ROLL_NUMBER) {
        return res.status(403).json({ error: 'FORBIDDEN: You do not have admin priveleges.' });
    }

    try {
        await pool.query('CALL sp_manual_wallet_adjustment($1, $2)', [target_student_id, amount]);

        res.status(200).json({
            message: `Successfully adjusted student ${target_student_id}'s wallet by ${amount}.`
        });
    }
    catch (error) {
        console.error('Wallet adjustment error.', error.message);
        res.status(400).json({ error: error.message });
    }
};

module.exports = { restockItem, adjustWallet };
