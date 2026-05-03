const { pool } = require('../config/db');

const getStudentDashboard = async (req, res) => {

    const studentId = req.params.id;

    try {
        const result = await pool.query(
            'SELECT * FROM vw_student_dashboard WHERE student_id = $1',
            [studentId]
        );

        if (result.rows.length === 0) {
            return res.status(404).json({ error: 'Dashboard data not found' });
        }

        res.status(200).json(result.rows[0]);
    }
    catch (error) {
        console.error('Dashboard error:', error);
        res.status(500).json({ error: 'Failed to fetch dashboard' });
    }
};

module.exports = { getStudentDashboard };
