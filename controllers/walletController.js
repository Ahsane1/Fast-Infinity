const { pool } = require('../config/db');

const getTransactionHistory = async (req, res) => {
    try {
        // Your verifyToken middleware should attach the decoded user info to req.user
        const studentId = req.user.student_id || req.user.id; 

        // Fetch from the enriched view
        const result = await pool.query(
            "SELECT * FROM vw_wallet_transaction_history WHERE student_id = $1 ORDER BY transaction_timestamp DESC",
            [studentId]
        );
        
        res.status(200).json(result.rows);
    } catch (error) {
        console.error('History fetch error:', error.message);
        res.status(500).json({ error: 'Failed to fetch transaction history.' });
    }
};

const processRefund = async (req, res) => {
    const { transaction_id } = req.body;
    const studentId = req.user.student_id || req.user.id;

    // We use a dedicated client for ACID transactions
    const client = await pool.connect();

    try {
        // 1. Fetch the specific transaction
        const txResult = await client.query(
            'SELECT * FROM Wallet_Ledger WHERE transaction_id = $1 AND student_id = $2',
            [transaction_id, studentId]
        );

        if (txResult.rows.length === 0) {
            return res.status(404).json({ error: 'Transaction not found.' });
        }

        const tx = txResult.rows[0];

        if (tx.transaction_type !== 'CAFETERIA_SPEND' && tx.transaction_type !== 'BOOKSHOP_SPEND') {
            return res.status(400).json({ error: 'Only purchases can be refunded.' });
        }

        // 2. ENFORCE THE 1-WEEK POLICY (7 Days)
        const txDate = new Date(tx.transaction_timestamp);
        const diffDays = Math.ceil(Math.abs(new Date() - txDate) / (1000 * 60 * 60 * 24)); 

        if (diffDays > 7) {
            return res.status(403).json({ error: `Refund denied: Purchase is ${diffDays} days old. Policy is strictly 7 days.` });
        }

        // 3. BULLETPROOF DOUBLE-REFUND PROTECTION (By Order ID)
        // We check if a MANUAL_ADJUSTMENT exists that is tied to this exact order ID
        const duplicateCheck = await client.query(
            `SELECT * FROM Wallet_Ledger 
             WHERE student_id = $1 AND transaction_type = 'MANUAL_ADJUSTMENT' 
             AND (cafeteria_order_id = $2 OR bookshop_order_id = $3)`,
            [studentId, tx.cafeteria_order_id, tx.bookshop_order_id]
        );

        if (duplicateCheck.rows.length > 0) {
            return res.status(409).json({ error: 'This specific order has already been refunded.' });
        }

        // 4. Execute the Refund as a safe ACID Transaction
        const refundAmount = Math.abs(parseFloat(tx.amount));

        await client.query('BEGIN'); // Start transaction

        // Credit the student's wallet
        await client.query(
            'UPDATE Students SET current_balance = current_balance + $1 WHERE student_id = $2',
            [refundAmount, studentId]
        );

        // Log the refund AND attach the original order ID so it can never be refunded again
        await client.query(
            `INSERT INTO Wallet_Ledger (student_id, transaction_type, amount, cafeteria_order_id, bookshop_order_id)
             VALUES ($1, 'MANUAL_ADJUSTMENT', $2, $3, $4)`,
            [studentId, refundAmount, tx.cafeteria_order_id, tx.bookshop_order_id]
        );

        await client.query('COMMIT'); // Save transaction

        res.status(200).json({ message: `Policy met! Rs. ${refundAmount} has been refunded for this order.` });
    } catch (error) {
        await client.query('ROLLBACK'); // Cancel everything if anything fails
        console.error('Refund error:', error);
        res.status(500).json({ error: 'Failed to process refund.' });
    } finally {
        client.release(); // Return connection to the pool
    }
};


module.exports = { getTransactionHistory, processRefund };
