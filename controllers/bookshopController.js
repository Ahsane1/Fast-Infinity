const { pool } = require('../config/db');

const placeBookshopOrder = async (req, res) => {
    // Extract student_id securely from the JWT token
    
    const student_id = req.user.student_id;

    const { items, receipt_number } = req.body;

    if (!items || items.length === 0 || !receipt_number) {
        return res.status(400).json({ error: 'Cart items and a unique receipt number are required.' });
    }

    try {
        const query = `CALL sp_place_bookshop_order($1, $2::jsonb, $3, null, null)`;
        const values = [student_id, JSON.stringify(items), receipt_number];

        const result = await pool.query(query, values);

        const { p_order_id, p_total } = result.rows[0];

        res.status(200).json({
            message: 'Bookshop order placed successfully',
            order_id: p_order_id,
            receipt: receipt_number,
            total_charged: p_total
        });
    }
    catch (error) {
        console.error('Bookshop checkout error:', error.message);

        if (error.message.includes('DUPLICATE_RECEIPT')) {
            return res.status(409).json({ error: 'This receipt number has already been processed.' });
        }

        res.status(400).json({ error: error.message });
    }
};

module.exports = { placeBookshopOrder };
