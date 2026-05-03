const { pool } = require('../config/db');

const recordSession = async (req, res) => {
    // 1. Extract the secure student_id from the verified JWT token
    const student_id = req.user.student_id;

    const { game_code, match_id, raw_score } = req.body;

    if (!game_code || raw_score === undefined) {
        return res.status(400).json({ error: 'Game code and raw score are required. '});
    }

    try {
        const query = `CALL sp_record_game_session($1, $2, $3, $4, null, null, null)`;
        const values = [student_id, game_code, match_id || null, raw_score];

        const result = await pool.query(query, values);

        const { p_session_id, p_cash_earned, p_status } = result.rows[0];

        if (p_status === 'REJECTED_SUSPICIOUS') {
            return res.status(403).json({
                message: 'Session flagged for suspicious activity. Wallet not credited.',
                session_id: p_session_id,
                status: p_status
            });
        }

        res.status(200).json({
            message: 'Game session recorded successfully',
            session_id: p_session_id,
            cash_earned: p_cash_earned,
            status: p_status
        });
    }
    catch (error) {
        console.error('Game session error:', error.message);
        res.status(400).json({ error: error.message });
    }
};

module.exports = { recordSession };
