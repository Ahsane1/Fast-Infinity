const { pool } = require('../config/db');

const getMenu = async (req, res) => {
    try {
        const result = await pool.query(
            "SELECT * FROM vw_cafeteria_inventory WHERE is_active = TRUE AND stock_status != 'OUT_OF_STOCK'"
        );
        res.status(200).json(result.rows);
    }
    catch (error) {
        console.error('Menu fetch error:', error);
        res.status(500).json({ error: 'Failed to fetch menu' });
    }
};

const placeOrder = async (req, res) => {
    const { student_id, items } = req.body;

    if (!student_id || !items || items.length === 0) {
        return res.status(400).json({ error: 'Student ID and Cart Items are required.' });
    }

    try {
        const query = `CALL sp_place_cafeteria_order($1, $2::jsonb, null, null)`;
        const values = [student_id, JSON.stringify(items)];

        const result = await pool.query(query, values);

        const { p_order_id, p_total } = result.rows[0];

        res.status(200).json({
            message: 'Order placed successfully',
            order_id: p_order_id,
            total_charged: p_total
        });
    }
    catch (error) {
        console.error('Checkout failed:', error.message);
        res.status(400).json({ error: error.message });
    }
};

module.exports = { placeOrder, getMenu };
