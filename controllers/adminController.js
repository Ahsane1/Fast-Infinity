const { pool } = require('../config/db');

// 1. Change this to an array and add your new roll numbers here
const ADMIN_ROLL_NUMBERS = ['24L-0561', '24L-3062', '24L-0556']; 

const restockItem = async (req, res) => {

    // 2. Check if the array includes the user's roll number
    if (!ADMIN_ROLL_NUMBERS.includes(req.user.roll_number)) {
        return res.status(403).json({ error: 'FORBIDDEN: You do not have admin privileges.' });
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
    // 3. Update the security gate here as well
    if (!ADMIN_ROLL_NUMBERS.includes(req.user.roll_number)) {
        return res.status(403).json({ error: 'FORBIDDEN: You do not have admin privileges.' });
    }

    const { target_roll_number, amount } = req.body;

    if (!target_roll_number || amount === undefined || amount === 0) {
        return res.status(400).json({ error: 'Valid target roll number and non-zero amount are required.' });
    }

    try {
        const studentQuery = await pool.query('SELECT student_id FROM Students WHERE roll_number = $1', [target_roll_number]);
        
        if (studentQuery.rows.length === 0) {
            return res.status(404).json({ error: `Student with roll number ${target_roll_number} not found.` });
        }

        const target_student_id = studentQuery.rows[0].student_id;

        await pool.query('CALL sp_manual_wallet_adjustment($1, $2)', [target_student_id, amount]);
        
        res.status(200).json({ 
            message: `Successfully adjusted wallet for ${target_roll_number} by Rs. ${amount}.` 
        });

    } catch (error) {
        console.error('Wallet adjustment error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

// ── Add Cafeteria Item ────────────────────────────────────────────────────────
const addCafeteriaItem = async (req, res) => {
      if (!ADMIN_ROLL_NUMBERS.includes(req.user.roll_number)) {
        return res.status(403).json({ error: 'FORBIDDEN: You do not have admin privileges.' });
    }

    const { item_name, description, price, stock_quantity, category } = req.body;

    if (!item_name || !price || stock_quantity === undefined || !category) {
        return res.status(400).json({ error: 'item_name, price, stock_quantity, and category are required.' });
    }
    if (price <= 0) return res.status(400).json({ error: 'Price must be positive.' });
    if (stock_quantity < 0) return res.status(400).json({ error: 'Stock quantity cannot be negative.' });

    try {
        const result = await pool.query(
            `INSERT INTO Cafeteria_Items (item_name, description, price, stock_quantity, category, is_active)
             VALUES ($1, $2, $3, $4, $5, true)
             RETURNING *`,
            [item_name, description || null, parseFloat(price), parseInt(stock_quantity), category]
        );
        res.status(201).json({ message: 'Cafeteria item added successfully.', item: result.rows[0] });
    } catch (error) {
        console.error('Add cafeteria item error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

// ── Add Bookshop Item ─────────────────────────────────────────────────────────
const addBookshopItem = async (req, res) => {
    if (!ADMIN_ROLL_NUMBERS.includes(req.user.roll_number)) {
        return res.status(403).json({ error: 'FORBIDDEN: You do not have admin privileges.' });
    }

    const { item_name, item_category, isbn, author, price, stock_quantity } = req.body;

    if (!item_name || !item_category || !price || stock_quantity === undefined) {
        return res.status(400).json({ error: 'item_name, item_category, price, and stock_quantity are required.' });
    }
    if (price <= 0) return res.status(400).json({ error: 'Price must be positive.' });
    if (stock_quantity < 0) return res.status(400).json({ error: 'Stock quantity cannot be negative.' });

    try {
        const result = await pool.query(
            `INSERT INTO Bookshop_Items (item_name, item_category, isbn, author, price, stock_quantity, is_active)
             VALUES ($1, $2, $3, $4, $5, $6, true)
             RETURNING *`,
            [item_name, item_category, isbn || null, author || null, parseFloat(price), parseInt(stock_quantity)]
        );
        res.status(201).json({ message: 'Bookshop item added successfully.', item: result.rows[0] });
    } catch (error) {
        console.error('Add bookshop item error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

module.exports = { restockItem, adjustWallet, addCafeteriaItem, addBookshopItem };
