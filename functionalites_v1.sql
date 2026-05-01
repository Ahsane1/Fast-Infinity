-- ============================================================
--  FAST-INFINITY  |  Database Layer
--  PostgreSQL 14+
--  Includes: Indexes · Views · Functions · Procedures · Queries
-- ============================================================
--
--  SECTIONS
--  ─────────────────────────────────────────────────────────
--  1. Performance Indexes
--  2. Helper / Utility Functions
--  3. Views
--       3A. vw_student_dashboard
--       3B. vw_esports_leaderboard
--       3C. vw_wallet_transaction_history
--       3D. vw_cafeteria_inventory
--       3E. vw_bookshop_inventory
--       3F. vw_admin_revenue_dashboard
--  4. Stored Procedures
--       4A. sp_register_student
--       4B. sp_place_cafeteria_order
--       4C. sp_place_bookshop_order
--       4D. sp_record_game_session        (with fraud detection)
--       4E. sp_restock_cafeteria_item
--       4F. sp_manual_wallet_adjustment
--  5. Complex Analytical Queries
--       5A. Student 30-day spending breakdown
--       5B. Peak cafeteria hours
--       5C. Top 10 students by wallet activity
--       5D. Most popular cafeteria items + revenue share
--       5E. Fraud review dashboard
--       5F. Per-student game performance trend (rolling window)
--       5G. Bookshop category revenue report
--       5H. Idle wallets (students with no activity in 30 days)
-- ============================================================


-- ============================================================
-- SECTION 1 : PERFORMANCE INDEXES
-- ============================================================

-- Students
CREATE INDEX IF NOT EXISTS idx_students_roll       ON Students(roll_number);

-- Wallet Ledger (most queried table after Students)
CREATE INDEX IF NOT EXISTS idx_wallet_student      ON Wallet_Ledger(student_id);
CREATE INDEX IF NOT EXISTS idx_wallet_type         ON Wallet_Ledger(transaction_type);
CREATE INDEX IF NOT EXISTS idx_wallet_timestamp    ON Wallet_Ledger(transaction_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_wallet_session      ON Wallet_Ledger(game_session_id)  WHERE game_session_id  IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_cafeteria    ON Wallet_Ledger(cafeteria_order_id) WHERE cafeteria_order_id IS NOT NULL;
CREATE INDEX IF NOT EXISTS idx_wallet_bookshop     ON Wallet_Ledger(bookshop_order_id)  WHERE bookshop_order_id  IS NOT NULL;

-- Game Sessions
CREATE INDEX IF NOT EXISTS idx_gamesessions_student   ON Game_Sessions(student_id);
CREATE INDEX IF NOT EXISTS idx_gamesessions_game      ON Game_Sessions(game_id);
CREATE INDEX IF NOT EXISTS idx_gamesessions_status    ON Game_Sessions(status);
CREATE INDEX IF NOT EXISTS idx_gamesessions_played    ON Game_Sessions(played_at DESC);
CREATE UNIQUE INDEX IF NOT EXISTS idx_gamesessions_matchid ON Game_Sessions(external_match_id) WHERE external_match_id IS NOT NULL;

-- Cafeteria
CREATE INDEX IF NOT EXISTS idx_caforders_student   ON Cafeteria_Orders(student_id);
CREATE INDEX IF NOT EXISTS idx_caforders_timestamp ON Cafeteria_Orders(order_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_caforders_status    ON Cafeteria_Orders(status);
CREATE INDEX IF NOT EXISTS idx_cafitems_active     ON Cafeteria_Items(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_cafinvlog_item      ON Cafeteria_Inventory_Logs(item_id);

-- Bookshop
CREATE INDEX IF NOT EXISTS idx_bsorders_student    ON Bookshop_Orders(student_id);
CREATE INDEX IF NOT EXISTS idx_bsorders_timestamp  ON Bookshop_Orders(order_timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_bsorders_status     ON Bookshop_Orders(status);
CREATE INDEX IF NOT EXISTS idx_bsitems_active      ON Bookshop_Items(is_active) WHERE is_active = TRUE;
CREATE INDEX IF NOT EXISTS idx_bsitems_category    ON Bookshop_Items(item_category);


-- ============================================================
-- SECTION 2 : HELPER / UTILITY FUNCTIONS
-- ============================================================

-- Returns current balance; raises if student doesn't exist.
-- Used as a lightweight guard in application-level checks.
CREATE OR REPLACE FUNCTION fn_get_student_balance(p_student_id INT)
RETURNS DECIMAL(10,2)
LANGUAGE plpgsql
STABLE
AS $$
DECLARE
    v_balance DECIMAL(10,2);
BEGIN
    SELECT current_balance
    INTO   v_balance
    FROM   Students
    WHERE  student_id = p_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND: No student with id %', p_student_id;
    END IF;

    RETURN v_balance;
END;
$$;


-- ============================================================
-- SECTION 3 : VIEWS
-- ============================================================

-- ─────────────────────────────────────────
-- 3A. Student Dashboard Summary
--     One row per student. Aggregates game
--     earnings and spend across both shops.
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW vw_student_dashboard AS
SELECT
    s.student_id,
    s.roll_number,
    s.full_name,
    s.current_balance,

    -- Earnings
    COALESCE(SUM(CASE WHEN wl.transaction_type = 'GAME_EARNING'
                      THEN wl.amount END), 0)             AS total_game_earnings,

    -- Spend (stored as negative; ABS for display)
    COALESCE(SUM(CASE WHEN wl.transaction_type = 'CAFETERIA_SPEND'
                      THEN ABS(wl.amount) END), 0)        AS total_cafeteria_spend,
    COALESCE(SUM(CASE WHEN wl.transaction_type = 'BOOKSHOP_SPEND'
                      THEN ABS(wl.amount) END), 0)        AS total_bookshop_spend,

    -- Counts
    COUNT(DISTINCT gs.session_id)                          AS total_game_sessions,
    COUNT(DISTINCT co.order_id)                            AS total_cafeteria_orders,
    COUNT(DISTINCT bo.order_id)                            AS total_bookshop_orders

FROM Students s
LEFT JOIN Wallet_Ledger    wl ON s.student_id = wl.student_id
LEFT JOIN Game_Sessions    gs ON s.student_id = gs.student_id
                              AND gs.status = 'PROCESSED'
LEFT JOIN Cafeteria_Orders co ON s.student_id = co.student_id
                              AND co.status = 'COMPLETED'
LEFT JOIN Bookshop_Orders  bo ON s.student_id = bo.student_id
                              AND bo.status = 'COMPLETED'
GROUP BY
    s.student_id, s.roll_number, s.full_name, s.current_balance;


-- ─────────────────────────────────────────
-- 3B. E-Sports Leaderboard
--     Ranks students both per-game and
--     globally by total cash earned.
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW vw_esports_leaderboard AS
SELECT
    s.student_id,
    s.roll_number,
    s.full_name,
    eg.game_id,
    eg.game_name,

    COUNT(gs.session_id)        AS sessions_played,
    SUM(gs.raw_score)           AS total_score,
    MAX(gs.raw_score)           AS highest_score,
    ROUND(AVG(gs.raw_score), 0) AS avg_score,
    SUM(gs.cash_earned)         AS total_cash_earned,

    RANK() OVER (
        PARTITION BY eg.game_id
        ORDER BY SUM(gs.raw_score) DESC
    )                           AS game_rank,

    RANK() OVER (
        ORDER BY SUM(gs.cash_earned) DESC
    )                           AS overall_cash_rank

FROM Students       s
JOIN Game_Sessions  gs ON s.student_id = gs.student_id
                       AND gs.status   = 'PROCESSED'
JOIN E_Sports_Games eg ON gs.game_id  = eg.game_id
GROUP BY
    s.student_id, s.roll_number, s.full_name,
    eg.game_id,   eg.game_name;


-- ─────────────────────────────────────────
-- 3C. Unified Wallet Transaction History
--     Enriches each ledger row with context
--     from the originating entity.
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW vw_wallet_transaction_history AS
SELECT
    wl.transaction_id,
    wl.student_id,
    s.roll_number,
    wl.transaction_type,
    wl.amount,
    wl.transaction_timestamp,

    -- Game context
    eg.game_name,
    gs.raw_score,
    gs.external_match_id,

    -- Cafeteria context
    co.order_id       AS cafeteria_order_id,

    -- Bookshop context
    bo.receipt_number AS bookshop_receipt,

    -- Human-readable label for the UI
    CASE wl.transaction_type
        WHEN 'GAME_EARNING'      THEN 'Earned from '       || COALESCE(eg.game_name, 'Game')
        WHEN 'CAFETERIA_SPEND'   THEN 'Cafeteria order #'  || COALESCE(co.order_id::TEXT, '')
        WHEN 'BOOKSHOP_SPEND'    THEN 'Bookshop receipt '  || COALESCE(bo.receipt_number, '')
        WHEN 'MANUAL_ADJUSTMENT' THEN 'Admin wallet adjustment'
        ELSE wl.transaction_type
    END AS description

FROM Wallet_Ledger     wl
JOIN Students           s  ON wl.student_id         = s.student_id
LEFT JOIN Game_Sessions gs  ON wl.game_session_id    = gs.session_id
LEFT JOIN E_Sports_Games eg ON gs.game_id            = eg.game_id
LEFT JOIN Cafeteria_Orders co ON wl.cafeteria_order_id = co.order_id
LEFT JOIN Bookshop_Orders  bo ON wl.bookshop_order_id  = bo.order_id

ORDER BY wl.transaction_timestamp DESC;


-- ─────────────────────────────────────────
-- 3D. Cafeteria Inventory Status
--     Surfaces low-stock / out-of-stock
--     items and total revenue per item.
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW vw_cafeteria_inventory AS
SELECT
    ci.item_id,
    ci.item_name,
    ci.category,
    ci.price,
    ci.stock_quantity,
    ci.is_active,

    CASE
        WHEN ci.stock_quantity = 0  THEN 'OUT_OF_STOCK'
        WHEN ci.stock_quantity < 10 THEN 'LOW_STOCK'
        ELSE                             'IN_STOCK'
    END AS stock_status,

    COALESCE(SUM(cod.quantity_purchased), 0)                             AS total_units_sold,
    COALESCE(SUM(cod.quantity_purchased * cod.unit_price_at_purchase), 0) AS total_revenue

FROM Cafeteria_Items        ci
LEFT JOIN Cafeteria_Order_Details cod ON ci.item_id   = cod.item_id
LEFT JOIN Cafeteria_Orders        co  ON cod.order_id = co.order_id
                                     AND co.status    = 'COMPLETED'
GROUP BY
    ci.item_id, ci.item_name, ci.category,
    ci.price,   ci.stock_quantity, ci.is_active;


-- ─────────────────────────────────────────
-- 3E. Bookshop Inventory Status
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW vw_bookshop_inventory AS
SELECT
    bi.item_id,
    bi.item_name,
    bi.item_category,
    bi.author,
    bi.isbn,
    bi.price,
    bi.stock_quantity,
    bi.is_active,

    CASE
        WHEN bi.stock_quantity = 0 THEN 'OUT_OF_STOCK'
        WHEN bi.stock_quantity < 5 THEN 'LOW_STOCK'
        ELSE                            'IN_STOCK'
    END AS stock_status,

    COALESCE(SUM(bod.quantity_purchased), 0)                              AS total_units_sold,
    COALESCE(SUM(bod.quantity_purchased * bod.unit_price_at_purchase), 0) AS total_revenue

FROM Bookshop_Items         bi
LEFT JOIN Bookshop_Order_Details bod ON bi.item_id   = bod.item_id
LEFT JOIN Bookshop_Orders        bo  ON bod.order_id = bo.order_id
                                     AND bo.status   = 'COMPLETED'
GROUP BY
    bi.item_id,    bi.item_name,  bi.item_category,
    bi.author,     bi.isbn,       bi.price,
    bi.stock_quantity, bi.is_active;


-- ─────────────────────────────────────────
-- 3F. Admin Revenue Dashboard (daily)
--     UNION of cafeteria + bookshop sales.
-- ─────────────────────────────────────────
CREATE OR REPLACE VIEW vw_admin_revenue_dashboard AS
SELECT
    DATE_TRUNC('day', order_timestamp) AS report_date,
    'CAFETERIA'                        AS source,
    COUNT(*)                           AS order_count,
    SUM(total_amount)                  AS total_revenue,
    ROUND(AVG(total_amount), 2)        AS avg_order_value
FROM Cafeteria_Orders
WHERE status = 'COMPLETED'
GROUP BY DATE_TRUNC('day', order_timestamp)

UNION ALL

SELECT
    DATE_TRUNC('day', order_timestamp) AS report_date,
    'BOOKSHOP'                         AS source,
    COUNT(*)                           AS order_count,
    SUM(total_amount)                  AS total_revenue,
    ROUND(AVG(total_amount), 2)        AS avg_order_value
FROM Bookshop_Orders
WHERE status = 'COMPLETED'
GROUP BY DATE_TRUNC('day', order_timestamp)

ORDER BY report_date DESC, source;


-- ============================================================
-- SECTION 4 : STORED PROCEDURES
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 4A. Register a New Student
--     Optionally seeds initial wallet balance.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_register_student(
    p_roll_number     VARCHAR(15),
    p_full_name       VARCHAR(100),
    p_password_hash   VARCHAR(255),
    p_initial_balance DECIMAL(10,2) DEFAULT 0.00
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_student_id INT;
BEGIN
    -- Guard: duplicate roll number
    IF EXISTS (SELECT 1 FROM Students WHERE roll_number = p_roll_number) THEN
        RAISE EXCEPTION 'DUPLICATE_ROLL: Roll number % is already registered', p_roll_number;
    END IF;

    IF p_initial_balance < 0 THEN
        RAISE EXCEPTION 'INVALID_BALANCE: Initial balance cannot be negative';
    END IF;

    INSERT INTO Students (roll_number, full_name, password_hash, current_balance)
    VALUES (p_roll_number, p_full_name, p_password_hash, p_initial_balance)
    RETURNING student_id INTO v_student_id;

    -- Record the seeded balance so the ledger is always complete
    IF p_initial_balance > 0 THEN
        INSERT INTO Wallet_Ledger (student_id, transaction_type, amount)
        VALUES (v_student_id, 'MANUAL_ADJUSTMENT', p_initial_balance);
    END IF;

    RAISE NOTICE 'Student registered: id=%, roll=%', v_student_id, p_roll_number;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 4B. Place a Cafeteria Order  (ACID-safe)
--
--  p_items  JSONB array:
--    '[{"item_id": 2, "quantity": 1}, {"item_id": 5, "quantity": 3}]'
--
--  OUT p_order_id  → the new order's PK (return to caller)
--  OUT p_total     → amount charged
--
--  Guarantees
--    • Student row is locked before balance check   (no race)
--    • Each item row is locked before stock check   (no oversell)
--    • All-or-nothing: any violation rolls back everything
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_place_cafeteria_order(
    p_student_id  INT,
    p_items       JSONB,
    OUT p_order_id INT,
    OUT p_total    DECIMAL(10,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_elem        JSONB;
    v_item_id     INT;
    v_quantity    INT;
    v_price       DECIMAL(10,2);
    v_stock       INT;
    v_is_active   BOOLEAN;
    v_item_name   VARCHAR(100);
    v_balance     DECIMAL(10,2);
    v_running     DECIMAL(10,2) := 0;
BEGIN
    -- ── Step 1: Lock student row ──────────────────────────────
    SELECT current_balance
    INTO   v_balance
    FROM   Students
    WHERE  student_id = p_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND: id=%', p_student_id;
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_ORDER: cart cannot be empty';
    END IF;

    -- ── Step 2: Validate all items & build total ──────────────
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_id  := (v_elem->>'item_id')::INT;
        v_quantity := (v_elem->>'quantity')::INT;

        IF v_quantity <= 0 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY: quantity must be > 0 (item_id=%)', v_item_id;
        END IF;

        SELECT price, stock_quantity, is_active, item_name
        INTO   v_price, v_stock, v_is_active, v_item_name
        FROM   Cafeteria_Items
        WHERE  item_id = v_item_id
        FOR UPDATE;   -- lock to prevent concurrent oversell

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ITEM_NOT_FOUND: cafeteria item_id=%', v_item_id;
        END IF;

        IF NOT v_is_active THEN
            RAISE EXCEPTION 'ITEM_INACTIVE: "%" is currently unavailable', v_item_name;
        END IF;

        IF v_stock < v_quantity THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK: "%" has % unit(s) left, requested %',
                v_item_name, v_stock, v_quantity;
        END IF;

        v_running := v_running + (v_price * v_quantity);
    END LOOP;

    p_total := v_running;

    -- ── Step 3: Wallet balance check ──────────────────────────
    IF v_balance < p_total THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE: wallet=%.2f required=%.2f',
            v_balance, p_total;
    END IF;

    -- ── Step 4: Create order header ───────────────────────────
    INSERT INTO Cafeteria_Orders (student_id, total_amount, status)
    VALUES (p_student_id, p_total, 'COMPLETED')
    RETURNING order_id INTO p_order_id;

    -- ── Step 5: Order details + stock deduction + inventory log
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_id  := (v_elem->>'item_id')::INT;
        v_quantity := (v_elem->>'quantity')::INT;

        -- Re-read price (already locked above; just need the value)
        SELECT price INTO v_price
        FROM   Cafeteria_Items WHERE item_id = v_item_id;

        INSERT INTO Cafeteria_Order_Details
            (order_id, item_id, quantity_purchased, unit_price_at_purchase)
        VALUES (p_order_id, v_item_id, v_quantity, v_price);

        UPDATE Cafeteria_Items
        SET    stock_quantity = stock_quantity - v_quantity
        WHERE  item_id = v_item_id;

        INSERT INTO Cafeteria_Inventory_Logs
            (item_id, change_amount, transaction_type, order_id)
        VALUES (v_item_id, -v_quantity, 'PURCHASE', p_order_id);
    END LOOP;

    -- ── Step 6: Deduct wallet ─────────────────────────────────
    UPDATE Students
    SET    current_balance = current_balance - p_total
    WHERE  student_id = p_student_id;

    -- ── Step 7: Ledger entry ──────────────────────────────────
    INSERT INTO Wallet_Ledger
        (student_id, transaction_type, amount, cafeteria_order_id)
    VALUES (p_student_id, 'CAFETERIA_SPEND', -p_total, p_order_id);

    RAISE NOTICE 'Cafeteria order % placed | student=% | total=%.2f',
        p_order_id, p_student_id, p_total;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 4C. Place a Bookshop Order  (ACID-safe)
--
--  p_items          JSONB array (same shape as cafeteria)
--  p_receipt_number Caller-supplied unique receipt string
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_place_bookshop_order(
    p_student_id     INT,
    p_items          JSONB,
    p_receipt_number VARCHAR(50),
    OUT p_order_id   INT,
    OUT p_total      DECIMAL(10,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_elem       JSONB;
    v_item_id    INT;
    v_quantity   INT;
    v_price      DECIMAL(10,2);
    v_stock      INT;
    v_is_active  BOOLEAN;
    v_item_name  VARCHAR(150);
    v_balance    DECIMAL(10,2);
    v_running    DECIMAL(10,2) := 0;
BEGIN
    -- ── Step 1: Receipt idempotency guard ─────────────────────
    IF EXISTS (SELECT 1 FROM Bookshop_Orders WHERE receipt_number = p_receipt_number) THEN
        RAISE EXCEPTION 'DUPLICATE_RECEIPT: % already exists', p_receipt_number;
    END IF;

    -- ── Step 2: Lock student row ──────────────────────────────
    SELECT current_balance
    INTO   v_balance
    FROM   Students
    WHERE  student_id = p_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND: id=%', p_student_id;
    END IF;

    IF jsonb_array_length(p_items) = 0 THEN
        RAISE EXCEPTION 'EMPTY_ORDER: cart cannot be empty';
    END IF;

    -- ── Step 3: Validate items & compute total ────────────────
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_id  := (v_elem->>'item_id')::INT;
        v_quantity := (v_elem->>'quantity')::INT;

        IF v_quantity <= 0 THEN
            RAISE EXCEPTION 'INVALID_QUANTITY: quantity must be > 0 (item_id=%)', v_item_id;
        END IF;

        SELECT price, stock_quantity, is_active, item_name
        INTO   v_price, v_stock, v_is_active, v_item_name
        FROM   Bookshop_Items
        WHERE  item_id = v_item_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ITEM_NOT_FOUND: bookshop item_id=%', v_item_id;
        END IF;

        IF NOT v_is_active THEN
            RAISE EXCEPTION 'ITEM_INACTIVE: "%" is currently unavailable', v_item_name;
        END IF;

        IF v_stock < v_quantity THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK: "%" has % unit(s) left, requested %',
                v_item_name, v_stock, v_quantity;
        END IF;

        v_running := v_running + (v_price * v_quantity);
    END LOOP;

    p_total := v_running;

    -- ── Step 4: Balance check ─────────────────────────────────
    IF v_balance < p_total THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE: wallet=%.2f required=%.2f',
            v_balance, p_total;
    END IF;

    -- ── Step 5: Order header ──────────────────────────────────
    INSERT INTO Bookshop_Orders (receipt_number, student_id, total_amount, status)
    VALUES (p_receipt_number, p_student_id, p_total, 'COMPLETED')
    RETURNING order_id INTO p_order_id;

    -- ── Step 6: Details + stock deduction ─────────────────────
    FOR v_elem IN SELECT * FROM jsonb_array_elements(p_items) LOOP
        v_item_id  := (v_elem->>'item_id')::INT;
        v_quantity := (v_elem->>'quantity')::INT;

        SELECT price INTO v_price
        FROM   Bookshop_Items WHERE item_id = v_item_id;

        INSERT INTO Bookshop_Order_Details
            (order_id, item_id, quantity_purchased, unit_price_at_purchase)
        VALUES (p_order_id, v_item_id, v_quantity, v_price);

        UPDATE Bookshop_Items
        SET    stock_quantity = stock_quantity - v_quantity
        WHERE  item_id = v_item_id;
    END LOOP;

    -- ── Step 7: Deduct wallet ─────────────────────────────────
    UPDATE Students
    SET    current_balance = current_balance - p_total
    WHERE  student_id = p_student_id;

    -- ── Step 8: Ledger ────────────────────────────────────────
    INSERT INTO Wallet_Ledger
        (student_id, transaction_type, amount, bookshop_order_id)
    VALUES (p_student_id, 'BOOKSHOP_SPEND', -p_total, p_order_id);

    RAISE NOTICE 'Bookshop order % (receipt=%) placed | student=% | total=%.2f',
        p_order_id, p_receipt_number, p_student_id, p_total;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 4D. Record a Game Session  (with built-in Fraud Detection)
--
--  Algorithm
--    If the student has prior sessions for this game and the
--    new score exceeds FRAUD_MULTIPLIER × their own average,
--    the session is saved as REJECTED_SUSPICIOUS and the wallet
--    is NOT credited. All flagged sessions are visible via 5E.
--
--  Idempotency
--    Supplying the same external_match_id twice raises an error
--    rather than double-crediting.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_record_game_session(
    p_student_id         INT,
    p_external_game_code VARCHAR(50),
    p_external_match_id  VARCHAR(100),   -- pass NULL if no external ID
    p_raw_score          INT,
    OUT p_session_id     INT,
    OUT p_cash_earned    DECIMAL(10,2),
    OUT p_status         VARCHAR(20)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_game_id    INT;
    v_ratio      DECIMAL(8,4);
    v_is_active  BOOLEAN;
    v_game_name  VARCHAR(100);
    v_avg_score  NUMERIC;
    v_suspicious BOOLEAN := FALSE;

    -- Tune this threshold via a config table in v2
    FRAUD_MULTIPLIER CONSTANT DECIMAL := 5.0;
BEGIN
    -- ── Step 1: Idempotency ───────────────────────────────────
    IF p_external_match_id IS NOT NULL AND
       EXISTS (SELECT 1 FROM Game_Sessions
               WHERE external_match_id = p_external_match_id)
    THEN
        RAISE EXCEPTION 'DUPLICATE_MATCH: external_match_id=% already processed',
            p_external_match_id;
    END IF;

    -- ── Step 2: Validate student ──────────────────────────────
    IF NOT EXISTS (SELECT 1 FROM Students WHERE student_id = p_student_id) THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND: id=%', p_student_id;
    END IF;

    -- ── Step 3: Validate game ─────────────────────────────────
    SELECT game_id, score_to_cash_ratio, is_active, game_name
    INTO   v_game_id, v_ratio, v_is_active, v_game_name
    FROM   E_Sports_Games
    WHERE  external_game_code = p_external_game_code;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'GAME_NOT_FOUND: code=%', p_external_game_code;
    END IF;

    IF NOT v_is_active THEN
        RAISE EXCEPTION 'GAME_INACTIVE: "%" is not accepting scores', v_game_name;
    END IF;

    IF p_raw_score < 0 THEN
        RAISE EXCEPTION 'INVALID_SCORE: raw_score cannot be negative';
    END IF;

    -- ── Step 4: Fraud heuristic ───────────────────────────────
    SELECT AVG(raw_score)
    INTO   v_avg_score
    FROM   Game_Sessions
    WHERE  student_id = p_student_id
      AND  game_id    = v_game_id
      AND  status     = 'PROCESSED';

    IF v_avg_score IS NOT NULL
       AND p_raw_score > (v_avg_score * FRAUD_MULTIPLIER)
    THEN
        v_suspicious := TRUE;
    END IF;

    -- ── Step 5: Compute earnings ──────────────────────────────
    p_cash_earned := ROUND(p_raw_score * v_ratio, 2);
    p_status      := CASE WHEN v_suspicious
                          THEN 'REJECTED_SUSPICIOUS'
                          ELSE 'PROCESSED' END;

    -- ── Step 6: Persist session ───────────────────────────────
    INSERT INTO Game_Sessions
        (student_id, game_id, external_match_id, raw_score, cash_earned, status)
    VALUES
        (p_student_id, v_game_id, p_external_match_id,
         p_raw_score,  p_cash_earned, p_status)
    RETURNING session_id INTO p_session_id;

    -- ── Step 7: Credit wallet only for clean sessions ─────────
    IF NOT v_suspicious THEN
        UPDATE Students
        SET    current_balance = current_balance + p_cash_earned
        WHERE  student_id = p_student_id;

        INSERT INTO Wallet_Ledger
            (student_id, transaction_type, amount, game_session_id)
        VALUES (p_student_id, 'GAME_EARNING', p_cash_earned, p_session_id);
    ELSE
        RAISE WARNING
            'FRAUD_FLAG: session_id=% student=% score=% vs avg=% — wallet NOT credited',
            p_session_id, p_student_id, p_raw_score, ROUND(v_avg_score, 0);
    END IF;

    RAISE NOTICE 'Game session recorded: id=% | status=% | earned=%.2f',
        p_session_id, p_status, p_cash_earned;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 4E. Restock a Cafeteria Item  (Admin)
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_restock_cafeteria_item(
    p_item_id      INT,
    p_add_quantity INT
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_item_name VARCHAR(100);
    v_new_stock INT;
BEGIN
    IF p_add_quantity <= 0 THEN
        RAISE EXCEPTION 'INVALID_QUANTITY: restock amount must be positive';
    END IF;

    SELECT item_name
    INTO   v_item_name
    FROM   Cafeteria_Items
    WHERE  item_id = p_item_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'ITEM_NOT_FOUND: item_id=%', p_item_id;
    END IF;

    UPDATE Cafeteria_Items
    SET    stock_quantity = stock_quantity + p_add_quantity
    WHERE  item_id = p_item_id
    RETURNING stock_quantity INTO v_new_stock;

    INSERT INTO Cafeteria_Inventory_Logs
        (item_id, change_amount, transaction_type)
    VALUES (p_item_id, p_add_quantity, 'RESTOCK');

    RAISE NOTICE 'Restocked "%": +% units → new total=%',
        v_item_name, p_add_quantity, v_new_stock;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 4F. Manual Wallet Adjustment  (Admin)
--     Pass positive amount to credit, negative to debit.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_manual_wallet_adjustment(
    p_student_id INT,
    p_amount     DECIMAL(10,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_balance    DECIMAL(10,2);
    v_new_balance DECIMAL(10,2);
BEGIN
    IF p_amount = 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: adjustment cannot be zero';
    END IF;

    SELECT current_balance
    INTO   v_balance
    FROM   Students
    WHERE  student_id = p_student_id
    FOR UPDATE;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND: id=%', p_student_id;
    END IF;

    v_new_balance := v_balance + p_amount;

    IF v_new_balance < 0 THEN
        RAISE EXCEPTION 'NEGATIVE_BALANCE: adjustment would result in balance of %.2f',
            v_new_balance;
    END IF;

    UPDATE Students
    SET    current_balance = v_new_balance
    WHERE  student_id = p_student_id;

    INSERT INTO Wallet_Ledger (student_id, transaction_type, amount)
    VALUES (p_student_id, 'MANUAL_ADJUSTMENT', p_amount);

    RAISE NOTICE 'Wallet adjusted for student %: delta=%.2f | new_balance=%.2f',
        p_student_id, p_amount, v_new_balance;
END;
$$;


-- ============================================================
-- SECTION 5 : COMPLEX ANALYTICAL QUERIES
-- (Ready to drop into reports, admin dashboards, or APIs)
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- 5A. Student 30-Day Spending Breakdown
--     Per student, per transaction type with running totals.
-- ─────────────────────────────────────────────────────────────
SELECT
    s.roll_number,
    s.full_name,
    wl.transaction_type,
    COUNT(*)                                            AS transaction_count,
    SUM(ABS(wl.amount))                                 AS total_spent,
    ROUND(AVG(ABS(wl.amount)), 2)                       AS avg_per_transaction,
    -- Running cumulative spend per student across types
    SUM(SUM(ABS(wl.amount))) OVER (
        PARTITION BY s.student_id
        ORDER BY wl.transaction_type
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )                                                   AS cumulative_spend
FROM Students s
JOIN Wallet_Ledger wl ON s.student_id = wl.student_id
WHERE wl.transaction_timestamp >= NOW() - INTERVAL '30 days'
  AND wl.transaction_type IN ('CAFETERIA_SPEND', 'BOOKSHOP_SPEND')
GROUP BY
    s.student_id, s.roll_number, s.full_name, wl.transaction_type
ORDER BY s.roll_number, wl.transaction_type;


-- ─────────────────────────────────────────────────────────────
-- 5B. Peak Cafeteria Hours  (hour × day-of-week heatmap data)
-- ─────────────────────────────────────────────────────────────
SELECT
    EXTRACT(DOW  FROM co.order_timestamp)::INT          AS day_of_week_num,  -- 0=Sun
    TO_CHAR(co.order_timestamp, 'Day')                  AS day_of_week,
    EXTRACT(HOUR FROM co.order_timestamp)::INT          AS hour_of_day,
    COUNT(co.order_id)                                  AS order_count,
    SUM(co.total_amount)                                AS revenue,
    ROUND(AVG(co.total_amount), 2)                      AS avg_order_value,
    RANK() OVER (ORDER BY COUNT(co.order_id) DESC)      AS busiest_rank
FROM Cafeteria_Orders co
WHERE co.status = 'COMPLETED'
GROUP BY
    EXTRACT(DOW  FROM co.order_timestamp),
    TO_CHAR(co.order_timestamp, 'Day'),
    EXTRACT(HOUR FROM co.order_timestamp)
ORDER BY busiest_rank;


-- ─────────────────────────────────────────────────────────────
-- 5C. Top 10 Students by Total Wallet Activity
-- ─────────────────────────────────────────────────────────────
SELECT
    s.roll_number,
    s.full_name,
    s.current_balance,
    SUM(CASE WHEN wl.amount > 0 THEN  wl.amount    ELSE 0 END) AS total_credited,
    SUM(CASE WHEN wl.amount < 0 THEN  ABS(wl.amount) ELSE 0 END) AS total_debited,
    COUNT(*)                                                      AS total_transactions,
    DENSE_RANK() OVER (
        ORDER BY SUM(ABS(wl.amount)) DESC
    )                                                             AS activity_rank
FROM Students s
JOIN Wallet_Ledger wl ON s.student_id = wl.student_id
GROUP BY s.student_id, s.roll_number, s.full_name, s.current_balance
ORDER BY activity_rank
LIMIT 10;


-- ─────────────────────────────────────────────────────────────
-- 5D. Most Popular Cafeteria Items with Revenue Share %
-- ─────────────────────────────────────────────────────────────
WITH item_stats AS (
    SELECT
        ci.item_id,
        ci.item_name,
        ci.category,
        ci.price                                                     AS current_price,
        SUM(cod.quantity_purchased)                                   AS units_sold,
        SUM(cod.quantity_purchased * cod.unit_price_at_purchase)      AS revenue
    FROM Cafeteria_Items ci
    JOIN Cafeteria_Order_Details cod ON ci.item_id   = cod.item_id
    JOIN Cafeteria_Orders        co  ON cod.order_id = co.order_id
                                    AND co.status = 'COMPLETED'
    GROUP BY ci.item_id, ci.item_name, ci.category, ci.price
),
grand_total AS (
    SELECT SUM(revenue) AS total FROM item_stats
)
SELECT
    ist.item_name,
    ist.category,
    ist.current_price,
    ist.units_sold,
    ROUND(ist.revenue, 2)                                             AS revenue,
    ROUND((ist.revenue / NULLIF(gt.total, 0)) * 100, 2)              AS revenue_share_pct,
    RANK() OVER (ORDER BY ist.units_sold DESC)                        AS popularity_rank,
    RANK() OVER (ORDER BY ist.revenue    DESC)                        AS revenue_rank
FROM item_stats ist
CROSS JOIN grand_total gt
ORDER BY popularity_rank;


-- ─────────────────────────────────────────────────────────────
-- 5E. Fraud Review Dashboard
--     Suspicious sessions enriched with the student's own avg
--     score to give admins the context to decide.
-- ─────────────────────────────────────────────────────────────
WITH per_student_game_stats AS (
    SELECT
        student_id,
        game_id,
        ROUND(AVG(raw_score), 0) AS avg_processed_score,
        MAX(raw_score)            AS max_processed_score,
        COUNT(*)                  AS total_clean_sessions
    FROM   Game_Sessions
    WHERE  status = 'PROCESSED'
    GROUP BY student_id, game_id
)
SELECT
    gs.session_id,
    s.roll_number,
    s.full_name,
    eg.game_name,
    gs.raw_score                                                            AS flagged_score,
    gs.cash_earned                                                          AS cash_that_would_have_been_credited,
    pss.avg_processed_score                                                 AS student_avg_score,
    pss.max_processed_score                                                 AS student_personal_best,
    pss.total_clean_sessions,
    ROUND(gs.raw_score / NULLIF(pss.avg_processed_score, 0), 2)             AS score_vs_avg_multiplier,
    gs.external_match_id,
    gs.played_at
FROM Game_Sessions            gs
JOIN Students                  s   ON gs.student_id = s.student_id
JOIN E_Sports_Games            eg  ON gs.game_id    = eg.game_id
LEFT JOIN per_student_game_stats pss
       ON pss.student_id = gs.student_id
      AND pss.game_id    = gs.game_id
WHERE gs.status = 'REJECTED_SUSPICIOUS'
ORDER BY gs.played_at DESC;


-- ─────────────────────────────────────────────────────────────
-- 5F. Per-Student Game Performance Trend
--     Rolling 7-session average + cumulative earnings.
--     Use as the data source for a performance graph on the
--     student's profile page.
-- ─────────────────────────────────────────────────────────────
SELECT
    s.roll_number,
    s.full_name,
    eg.game_name,
    gs.played_at::DATE                                       AS play_date,
    gs.raw_score,
    gs.cash_earned,

    -- Rolling 7-session average score (per student per game)
    ROUND(AVG(gs.raw_score) OVER (
        PARTITION BY gs.student_id, gs.game_id
        ORDER BY gs.played_at
        ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
    ), 0)                                                    AS rolling_7_session_avg,

    -- Cumulative earnings (per student per game)
    SUM(gs.cash_earned) OVER (
        PARTITION BY gs.student_id, gs.game_id
        ORDER BY gs.played_at
        ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
    )                                                        AS cumulative_earnings,

    -- Session number (for X-axis of charts)
    ROW_NUMBER() OVER (
        PARTITION BY gs.student_id, gs.game_id
        ORDER BY gs.played_at
    )                                                        AS session_number

FROM Game_Sessions  gs
JOIN Students        s  ON gs.student_id = s.student_id
JOIN E_Sports_Games  eg ON gs.game_id    = eg.game_id
WHERE gs.status = 'PROCESSED'
ORDER BY s.roll_number, eg.game_name, gs.played_at;


-- ─────────────────────────────────────────────────────────────
-- 5G. Bookshop Revenue by Category (with MoM comparison)
-- ─────────────────────────────────────────────────────────────
WITH monthly AS (
    SELECT
        bi.item_category,
        DATE_TRUNC('month', bo.order_timestamp)           AS month,
        SUM(bod.quantity_purchased * bod.unit_price_at_purchase) AS revenue,
        SUM(bod.quantity_purchased)                       AS units_sold
    FROM Bookshop_Items         bi
    JOIN Bookshop_Order_Details bod ON bi.item_id   = bod.item_id
    JOIN Bookshop_Orders        bo  ON bod.order_id = bo.order_id
                                   AND bo.status = 'COMPLETED'
    GROUP BY bi.item_category, DATE_TRUNC('month', bo.order_timestamp)
)
SELECT
    item_category,
    TO_CHAR(month, 'YYYY-MM')                             AS month,
    ROUND(revenue, 2)                                     AS revenue,
    units_sold,
    LAG(revenue) OVER (
        PARTITION BY item_category
        ORDER BY month
    )                                                     AS prev_month_revenue,
    ROUND(
        (revenue - LAG(revenue) OVER (
            PARTITION BY item_category ORDER BY month
        )) / NULLIF(LAG(revenue) OVER (
            PARTITION BY item_category ORDER BY month
        ), 0) * 100, 2
    )                                                     AS revenue_growth_pct
FROM monthly
ORDER BY item_category, month DESC;


-- ─────────────────────────────────────────────────────────────
-- 5H. Idle Students  (no wallet activity in last 30 days)
--     Use for re-engagement campaigns or balance expiry logic.
-- ─────────────────────────────────────────────────────────────
SELECT
    s.student_id,
    s.roll_number,
    s.full_name,
    s.current_balance,
    MAX(wl.transaction_timestamp)    AS last_activity,
    NOW() - MAX(wl.transaction_timestamp) AS idle_duration
FROM Students s
LEFT JOIN Wallet_Ledger wl ON s.student_id = wl.student_id
GROUP BY s.student_id, s.roll_number, s.full_name, s.current_balance
HAVING MAX(wl.transaction_timestamp) < NOW() - INTERVAL '30 days'
    OR MAX(wl.transaction_timestamp) IS NULL
ORDER BY last_activity ASC NULLS FIRST;


-- ============================================================
-- EXAMPLE USAGE
-- ============================================================


-- Register a student
CALL sp_register_student('23L-1234', 'Ali Hassan', 'bcrypt_hash_here', 500.00);

-- Place a cafeteria order (burger × 1, fries × 2)
DO $$
DECLARE v_order_id INT; v_total DECIMAL;
BEGIN
    CALL sp_place_cafeteria_order(
        1,
        '[{"item_id": 1, "quantity": 1}, {"item_id": 3, "quantity": 2}]'::JSONB,
        v_order_id,
        v_total
    );
    RAISE NOTICE 'Order ID: %, Total: %', v_order_id, v_total;
END;
$$;

-- Record a game session
DO $$
DECLARE v_sid INT; v_cash DECIMAL; v_status VARCHAR;
BEGIN
    CALL sp_record_game_session(
        1, 'VALORANT_FAST', 'MATCH_ABC123', 4500,
        v_sid, v_cash, v_status
    );
    RAISE NOTICE 'Session %, earned %, status %', v_sid, v_cash, v_status;
END;
$$;

-- Admin: restock samosas
CALL sp_restock_cafeteria_item(3, 50);

-- Admin: manual wallet top-up
CALL sp_manual_wallet_adjustment(1, 200.00);

-- Query a student's full transaction history
SELECT * FROM vw_wallet_transaction_history WHERE student_id = 1;

-- Check leaderboard
SELECT * FROM vw_esports_leaderboard ORDER BY game_rank LIMIT 10;





-- ============================================================
--  FAST-INFINITY  |  Transactions & Advanced Analytical Queries
--  PostgreSQL 14+
-- ============================================================
--
--  SECTIONS
--  ─────────────────────────────────────────────────────────
--  1. EXPLICIT TRANSACTIONS
--       T1. Atomic Cafeteria Order  (BEGIN / EXCEPTION / ROLLBACK)
--       T2. Batch Restock with SAVEPOINT per item (partial success)
--       T3. Wallet Transfer between two students
--       T4. End-of-Day Settlement Procedure  (explicit COMMIT)
--       T5. Concurrent Double-Spend Guard demo
--
--  2. ADVANCED ANALYTICAL QUERIES
--       Q1.  Consecutive-Day Play Streaks (island detection)
--       Q2.  ROLLUP — hierarchical revenue cube
--       Q3.  GROUPING SETS — multi-dimensional spend report
--       Q4.  Cohort Retention — week-0 earners who returned
--       Q5.  LATERAL JOIN — most recent order per student
--       Q6.  Score Percentiles per game (P50 / P75 / P90 / P99)
--       Q7.  FILTER clause — conditional multi-metric aggregation
--       Q8.  Top-3 items per cafeteria category (top-N per group)
--       Q9.  Student RFM Segmentation (Recency·Frequency·Monetary)
--       Q10. Zero-Activity Days — date-series gap analysis
--       Q11. Wallet Balance History (point-in-time reconstruction)
--       Q12. Session Heatmap  (student × game × hour-of-day)
-- ============================================================


-- ============================================================
-- SECTION 1 : EXPLICIT TRANSACTIONS
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- T1. Atomic Cafeteria Order
--
--  Demonstrates a raw BEGIN → validate → mutate → COMMIT block
--  with a structured EXCEPTION handler that always rolls back
--  on any error and logs the failure reason.
--  This is the pattern your backend (Node/Python/Java) should
--  wrap around every order call.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    v_student_id    INT     := 1;
    v_item_id       INT     := 2;
    v_quantity      INT     := 3;
    v_price         DECIMAL(10,2);
    v_stock         INT;
    v_balance       DECIMAL(10,2);
    v_total         DECIMAL(10,2);
    v_order_id      INT;
BEGIN
    -- ── All statements below are inside ONE transaction ───────
    BEGIN

        -- 1. Lock student; read balance
        SELECT current_balance
        INTO   v_balance
        FROM   Students
        WHERE  student_id = v_student_id
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'STUDENT_NOT_FOUND';
        END IF;

        -- 2. Lock item; validate stock and active status
        SELECT price, stock_quantity
        INTO   v_price, v_stock
        FROM   Cafeteria_Items
        WHERE  item_id  = v_item_id
          AND  is_active = TRUE
        FOR UPDATE;

        IF NOT FOUND THEN
            RAISE EXCEPTION 'ITEM_NOT_FOUND_OR_INACTIVE';
        END IF;

        IF v_stock < v_quantity THEN
            RAISE EXCEPTION 'INSUFFICIENT_STOCK: has=% needed=%', v_stock, v_quantity;
        END IF;

        v_total := v_price * v_quantity;

        IF v_balance < v_total THEN
            RAISE EXCEPTION 'INSUFFICIENT_BALANCE: wallet=% cost=%', v_balance, v_total;
        END IF;

        -- 3. Persist order
        INSERT INTO Cafeteria_Orders (student_id, total_amount, status)
        VALUES (v_student_id, v_total, 'COMPLETED')
        RETURNING order_id INTO v_order_id;

        INSERT INTO Cafeteria_Order_Details
            (order_id, item_id, quantity_purchased, unit_price_at_purchase)
        VALUES (v_order_id, v_item_id, v_quantity, v_price);

        -- 4. Deduct stock
        UPDATE Cafeteria_Items
        SET    stock_quantity = stock_quantity - v_quantity
        WHERE  item_id = v_item_id;

        INSERT INTO Cafeteria_Inventory_Logs
            (item_id, change_amount, transaction_type, order_id)
        VALUES (v_item_id, -v_quantity, 'PURCHASE', v_order_id);

        -- 5. Deduct wallet
        UPDATE Students
        SET    current_balance = current_balance - v_total
        WHERE  student_id = v_student_id;

        INSERT INTO Wallet_Ledger
            (student_id, transaction_type, amount, cafeteria_order_id)
        VALUES (v_student_id, 'CAFETERIA_SPEND', -v_total, v_order_id);

        RAISE NOTICE '[T1] Order % committed successfully. Total charged: %',
            v_order_id, v_total;

    EXCEPTION
        WHEN OTHERS THEN
            -- Any error inside the BEGIN…EXCEPTION block triggers
            -- an automatic rollback of everything above.
            RAISE WARNING '[T1] Transaction ROLLED BACK — %: %',
                SQLSTATE, SQLERRM;
            RAISE;          -- re-raise so the caller also sees the error
    END;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- T2. Batch Cafeteria Restock with per-item SAVEPOINTs
--
--  Partial-success pattern:
--    Each item gets its own SAVEPOINT. A bad item (e.g. invalid
--    id) is rolled back to its savepoint and skipped, while all
--    valid items are committed. The outer transaction commits at
--    the end even if some items failed.
--
--  This is the correct pattern for bulk admin operations where
--  you don't want one bad row to cancel everything.
-- ─────────────────────────────────────────────────────────────
DO $$
DECLARE
    -- (item_id, restock_qty) pairs to process
    v_items     INT[][] := ARRAY[[1,100],[2,50],[9999,30],[3,75]];
    v_pair      INT[];
    v_item_id   INT;
    v_qty       INT;
    v_item_name VARCHAR(100);
    v_new_stock INT;
    v_ok        INT := 0;
    v_skip      INT := 0;
BEGIN
    FOREACH v_pair SLICE 1 IN ARRAY v_items
    LOOP
        v_item_id := v_pair[1];
        v_qty     := v_pair[2];

        -- Create a savepoint before touching this item
        SAVEPOINT sp_item;

        BEGIN
            SELECT item_name INTO v_item_name
            FROM   Cafeteria_Items
            WHERE  item_id = v_item_id
            FOR UPDATE;

            IF NOT FOUND THEN
                RAISE EXCEPTION 'ITEM_NOT_FOUND: id=%', v_item_id;
            END IF;

            IF v_qty <= 0 THEN
                RAISE EXCEPTION 'INVALID_QTY: must be positive';
            END IF;

            UPDATE Cafeteria_Items
            SET    stock_quantity = stock_quantity + v_qty
            WHERE  item_id = v_item_id
            RETURNING stock_quantity INTO v_new_stock;

            INSERT INTO Cafeteria_Inventory_Logs
                (item_id, change_amount, transaction_type)
            VALUES (v_item_id, v_qty, 'RESTOCK');

            -- Success: release the savepoint (it's no longer needed)
            RELEASE SAVEPOINT sp_item;
            v_ok := v_ok + 1;
            RAISE NOTICE '[T2] ✓ Restocked item % ("%") → new stock=%',
                v_item_id, v_item_name, v_new_stock;

        EXCEPTION
            WHEN OTHERS THEN
                -- Roll back only this item; outer transaction continues
                ROLLBACK TO SAVEPOINT sp_item;
                RELEASE   SAVEPOINT sp_item;
                v_skip := v_skip + 1;
                RAISE WARNING '[T2] ✗ Skipped item_id=% — %: %',
                    v_item_id, SQLSTATE, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE '[T2] Batch complete: % restocked, % skipped.', v_ok, v_skip;
    -- Outer COMMIT happens implicitly when the DO block exits cleanly
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- T3. Wallet Transfer between two Students
--
--  A true double-entry transfer:
--    • Debit  source  student
--    • Credit target student
--    • Write  two ledger rows (MANUAL_ADJUSTMENT in both directions)
--    • Enforce consistent lock ordering (lower id first) to
--      prevent deadlocks when concurrent transfers cross paths.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_wallet_transfer(
    p_from_student_id INT,
    p_to_student_id   INT,
    p_amount          DECIMAL(10,2)
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_from_balance DECIMAL(10,2);
    v_lock_first   INT;
    v_lock_second  INT;
BEGIN
    IF p_amount <= 0 THEN
        RAISE EXCEPTION 'INVALID_AMOUNT: transfer must be positive';
    END IF;

    IF p_from_student_id = p_to_student_id THEN
        RAISE EXCEPTION 'SAME_STUDENT: cannot transfer to yourself';
    END IF;

    -- ── Deadlock prevention: always lock the lower ID first ───
    v_lock_first  := LEAST   (p_from_student_id, p_to_student_id);
    v_lock_second := GREATEST(p_from_student_id, p_to_student_id);

    PERFORM student_id FROM Students WHERE student_id = v_lock_first  FOR UPDATE;
    PERFORM student_id FROM Students WHERE student_id = v_lock_second FOR UPDATE;

    -- Validate source balance (rows already locked)
    SELECT current_balance INTO v_from_balance
    FROM   Students WHERE student_id = p_from_student_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND: from_id=%', p_from_student_id;
    END IF;

    IF NOT EXISTS (SELECT 1 FROM Students WHERE student_id = p_to_student_id) THEN
        RAISE EXCEPTION 'STUDENT_NOT_FOUND: to_id=%', p_to_student_id;
    END IF;

    IF v_from_balance < p_amount THEN
        RAISE EXCEPTION 'INSUFFICIENT_BALANCE: wallet=%.2f transfer=%.2f',
            v_from_balance, p_amount;
    END IF;

    -- ── Debit source ──────────────────────────────────────────
    UPDATE Students SET current_balance = current_balance - p_amount
    WHERE  student_id = p_from_student_id;

    INSERT INTO Wallet_Ledger (student_id, transaction_type, amount)
    VALUES (p_from_student_id, 'MANUAL_ADJUSTMENT', -p_amount);

    -- ── Credit target ─────────────────────────────────────────
    UPDATE Students SET current_balance = current_balance + p_amount
    WHERE  student_id = p_to_student_id;

    INSERT INTO Wallet_Ledger (student_id, transaction_type, amount)
    VALUES (p_to_student_id, 'MANUAL_ADJUSTMENT', p_amount);

    RAISE NOTICE '[T3] Transferred %.2f from student % → student %',
        p_amount, p_from_student_id, p_to_student_id;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- T4. End-of-Day Settlement Procedure
--
--  Uses explicit COMMIT inside the procedure body (PostgreSQL
--  11+ feature — only valid when called at top level, NOT inside
--  an existing transaction block).
--
--  Steps
--    1. Snapshot daily revenue into an audit log table
--       (uses a temp table here for portability).
--    2. Mark all PENDING orders older than 1 day as FAILED.
--    3. Commits after each phase so partial progress is saved
--       even if phase-2 or phase-3 fails.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE sp_end_of_day_settlement(
    p_settlement_date DATE DEFAULT CURRENT_DATE
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_caf_revenue   DECIMAL(10,2);
    v_bs_revenue    DECIMAL(10,2);
    v_pending_caf   INT;
    v_pending_bs    INT;
BEGIN
    RAISE NOTICE '[T4] === End-of-Day Settlement: % ===', p_settlement_date;

    -- ── Phase 1: Compute and snapshot daily revenue ───────────
    SELECT COALESCE(SUM(total_amount), 0) INTO v_caf_revenue
    FROM   Cafeteria_Orders
    WHERE  status = 'COMPLETED'
      AND  order_timestamp::DATE = p_settlement_date;

    SELECT COALESCE(SUM(total_amount), 0) INTO v_bs_revenue
    FROM   Bookshop_Orders
    WHERE  status = 'COMPLETED'
      AND  order_timestamp::DATE = p_settlement_date;

    RAISE NOTICE '[T4] Phase 1 — Cafeteria revenue: %.2f | Bookshop revenue: %.2f',
        v_caf_revenue, v_bs_revenue;

    COMMIT; -- ← Phase 1 permanently saved even if phase 2 fails

    -- ── Phase 2: Expire stale PENDING cafeteria orders ───────
    UPDATE Cafeteria_Orders
    SET    status = 'FAILED'
    WHERE  status = 'PENDING'
      AND  order_timestamp < NOW() - INTERVAL '1 day';

    GET DIAGNOSTICS v_pending_caf = ROW_COUNT;
    RAISE NOTICE '[T4] Phase 2 — Expired % stale cafeteria orders.', v_pending_caf;

    COMMIT; -- ← Phase 2 saved

    -- ── Phase 3: Expire stale PENDING bookshop orders ────────
    UPDATE Bookshop_Orders
    SET    status = 'FAILED'
    WHERE  status = 'PENDING'
      AND  order_timestamp < NOW() - INTERVAL '1 day';

    GET DIAGNOSTICS v_pending_bs = ROW_COUNT;
    RAISE NOTICE '[T4] Phase 3 — Expired % stale bookshop orders.', v_pending_bs;

    COMMIT; -- ← Phase 3 saved

    RAISE NOTICE '[T4] Settlement complete.';

EXCEPTION
    WHEN OTHERS THEN
        ROLLBACK;
        RAISE WARNING '[T4] Settlement FAILED at phase — %: %', SQLSTATE, SQLERRM;
        RAISE;
END;
$$;

-- Invoke at application shutdown / cron job:
-- CALL sp_end_of_day_settlement();


-- ─────────────────────────────────────────────────────────────
-- T5. Concurrent Double-Spend Guard  (illustrative demo)
--
--  Shows how SELECT ... FOR UPDATE prevents a student from
--  spending their balance twice in parallel sessions.
--  Run Session A and Session B simultaneously to see Session B
--  block until A commits, then correctly see the updated balance.
-- ─────────────────────────────────────────────────────────────

-- ── Session A (first connection) ──────────────────────────────
/*
BEGIN;
    SELECT current_balance FROM Students WHERE student_id = 1 FOR UPDATE;
    -- balance = 500.00
    -- ... Session B is now BLOCKED here because of the row lock ...
    UPDATE Students SET current_balance = current_balance - 300 WHERE student_id = 1;
COMMIT;
-- Session B unblocks and sees balance = 200.00 (not the original 500.00)
*/

-- ── Session B (second connection) ─────────────────────────────
/*
BEGIN;
    SELECT current_balance FROM Students WHERE student_id = 1 FOR UPDATE;
    -- Blocks until Session A commits, then reads 200.00
    -- This correctly prevents the double-spend
    UPDATE Students SET current_balance = current_balance - 300 WHERE student_id = 1;
    -- RAISES: CHECK constraint violation (200 - 300 = -100 < 0)
ROLLBACK;
*/


-- ============================================================
-- SECTION 2 : ADVANCED ANALYTICAL QUERIES
-- ============================================================

-- ─────────────────────────────────────────────────────────────
-- Q1. Consecutive-Day Play Streaks  (Island Detection)
--
--  Classic "gaps and islands" technique:
--    Subtract ROW_NUMBER from the date — consecutive dates
--    produce the same constant (the "island group").
--    RANK() on streak_length reveals the all-time leaders.
-- ─────────────────────────────────────────────────────────────
WITH daily_plays AS (
    -- One row per student per calendar day they played
    SELECT DISTINCT
        student_id,
        played_at::DATE AS play_date
    FROM  Game_Sessions
    WHERE status = 'PROCESSED'
),
island_groups AS (
    SELECT
        student_id,
        play_date,
        -- Subtracting a sequential integer from a date groups
        -- consecutive dates into the same "island" value
        play_date
            - (ROW_NUMBER() OVER (
                PARTITION BY student_id
                ORDER BY play_date
              ) * INTERVAL '1 day')::DATE      AS island_key
    FROM daily_plays
),
streaks AS (
    SELECT
        student_id,
        MIN(play_date)  AS streak_start,
        MAX(play_date)  AS streak_end,
        COUNT(*)        AS streak_length_days
    FROM  island_groups
    GROUP BY student_id, island_key
)
SELECT
    s.roll_number,
    s.full_name,
    st.streak_start,
    st.streak_end,
    st.streak_length_days,
    RANK() OVER (ORDER BY st.streak_length_days DESC) AS streak_rank,
    -- Is the streak still active today?
    CASE WHEN st.streak_end = CURRENT_DATE THEN 'ACTIVE' ELSE 'ENDED' END AS streak_status
FROM streaks   st
JOIN Students   s ON st.student_id = s.student_id
ORDER BY streak_rank, st.streak_start DESC;


-- ─────────────────────────────────────────────────────────────
-- Q2. ROLLUP — Hierarchical Revenue Cube
--
--  ROLLUP produces subtotals at every level:
--    (source, month) → subtotal per source → grand total
--  NULL in a column signals the rollup aggregation for that level.
-- ─────────────────────────────────────────────────────────────
SELECT
    COALESCE(source, 'ALL SOURCES')                         AS source,
    COALESCE(TO_CHAR(month, 'YYYY-MM'), 'ALL MONTHS')       AS month,
    SUM(revenue)                                            AS total_revenue,
    SUM(order_count)                                        AS total_orders,
    ROUND(SUM(revenue) / NULLIF(SUM(order_count), 0), 2)   AS avg_order_value,
    -- Distinguish real rows from ROLLUP-generated subtotal rows
    GROUPING(source)                                        AS is_source_subtotal,
    GROUPING(month)                                         AS is_month_subtotal
FROM (
    SELECT
        'CAFETERIA'                              AS source,
        DATE_TRUNC('month', order_timestamp)     AS month,
        SUM(total_amount)                        AS revenue,
        COUNT(*)                                 AS order_count
    FROM Cafeteria_Orders WHERE status = 'COMPLETED'
    GROUP BY DATE_TRUNC('month', order_timestamp)

    UNION ALL

    SELECT
        'BOOKSHOP',
        DATE_TRUNC('month', order_timestamp),
        SUM(total_amount),
        COUNT(*)
    FROM Bookshop_Orders WHERE status = 'COMPLETED'
    GROUP BY DATE_TRUNC('month', order_timestamp)
) revenue_base
GROUP BY ROLLUP(source, month)
ORDER BY
    GROUPING(source),
    GROUPING(month),
    source,
    month;


-- ─────────────────────────────────────────────────────────────
-- Q3. GROUPING SETS — Multi-Dimensional Spend Analysis
--
--  Produces three independent aggregation perspectives in a
--  single pass over the data — far more efficient than three
--  separate GROUP BY queries.
--    Set 1: Total spend by transaction type  (type, -)
--    Set 2: Total spend by month             (-, month)
--    Set 3: Grand total                      (-, -)
-- ─────────────────────────────────────────────────────────────
SELECT
    COALESCE(wl.transaction_type, 'GRAND TOTAL')       AS dimension,
    COALESCE(TO_CHAR(DATE_TRUNC('month',
        wl.transaction_timestamp), 'YYYY-MM'), '—')    AS month,
    COUNT(*)                                           AS transactions,
    ROUND(SUM(ABS(wl.amount)), 2)                      AS total_amount,
    ROUND(AVG(ABS(wl.amount)), 2)                      AS avg_amount
FROM Wallet_Ledger wl
WHERE wl.transaction_type IN ('CAFETERIA_SPEND', 'BOOKSHOP_SPEND')
GROUP BY GROUPING SETS (
    (wl.transaction_type),
    (DATE_TRUNC('month', wl.transaction_timestamp)),
    ()                                  -- grand total row
)
ORDER BY
    GROUPING(wl.transaction_type),
    GROUPING(DATE_TRUNC('month', wl.transaction_timestamp)),
    wl.transaction_type,
    month;


-- ─────────────────────────────────────────────────────────────
-- Q4. Cohort Retention Analysis
--
--  Groups students by their registration week (cohort).
--  For each cohort, counts how many students were active
--  in week 0, week 1, week 2 … after joining.
--  This is the standard SaaS retention table, applied to
--  the game-earning behaviour of students.
-- ─────────────────────────────────────────────────────────────
WITH student_cohorts AS (
    -- Week a student first appeared in the wallet (proxy for join date)
    SELECT
        student_id,
        DATE_TRUNC('week', MIN(transaction_timestamp)) AS cohort_week
    FROM Wallet_Ledger
    GROUP BY student_id
),
student_activity AS (
    SELECT DISTINCT
        wl.student_id,
        DATE_TRUNC('week', wl.transaction_timestamp) AS activity_week
    FROM Wallet_Ledger wl
    WHERE wl.transaction_type = 'GAME_EARNING'
),
cohort_activity AS (
    SELECT
        sc.cohort_week,
        (sa.activity_week - sc.cohort_week) / 7          AS weeks_since_join,
        COUNT(DISTINCT sa.student_id)                     AS active_students
    FROM student_cohorts  sc
    JOIN student_activity sa ON sc.student_id = sa.student_id
    GROUP BY sc.cohort_week, weeks_since_join
),
cohort_sizes AS (
    SELECT cohort_week, COUNT(*) AS cohort_size
    FROM   student_cohorts
    GROUP BY cohort_week
)
SELECT
    TO_CHAR(ca.cohort_week, 'YYYY-MM-DD')               AS cohort_week,
    cs.cohort_size,
    ca.weeks_since_join,
    ca.active_students,
    ROUND(ca.active_students::NUMERIC / cs.cohort_size * 100, 1) AS retention_pct
FROM cohort_activity ca
JOIN cohort_sizes    cs ON ca.cohort_week = cs.cohort_week
ORDER BY ca.cohort_week, ca.weeks_since_join;


-- ─────────────────────────────────────────────────────────────
-- Q5. LATERAL JOIN — Most Recent Order per Student
--
--  LATERAL allows the subquery to reference the outer row.
--  Here it efficiently fetches exactly one (most recent)
--  cafeteria order per student without a correlated subquery
--  or window function overhead on the full table.
-- ─────────────────────────────────────────────────────────────
SELECT
    s.roll_number,
    s.full_name,
    s.current_balance,
    last_caf.order_id          AS last_cafeteria_order_id,
    last_caf.total_amount      AS last_cafeteria_spend,
    last_caf.order_timestamp   AS last_cafeteria_date,
    last_bs.receipt_number     AS last_bookshop_receipt,
    last_bs.total_amount       AS last_bookshop_spend,
    last_bs.order_timestamp    AS last_bookshop_date
FROM Students s

LEFT JOIN LATERAL (
    SELECT order_id, total_amount, order_timestamp
    FROM   Cafeteria_Orders
    WHERE  student_id = s.student_id
      AND  status = 'COMPLETED'
    ORDER BY order_timestamp DESC
    LIMIT 1
) last_caf ON TRUE

LEFT JOIN LATERAL (
    SELECT receipt_number, total_amount, order_timestamp
    FROM   Bookshop_Orders
    WHERE  student_id = s.student_id
      AND  status = 'COMPLETED'
    ORDER BY order_timestamp DESC
    LIMIT 1
) last_bs ON TRUE

ORDER BY s.roll_number;


-- ─────────────────────────────────────────────────────────────
-- Q6. Score Percentiles per Game
--     PERCENTILE_CONT (continuous / interpolated)
--     Shows P50, P75, P90, P99 — useful for difficulty tuning
--     and fair leaderboard cutoffs.
-- ─────────────────────────────────────────────────────────────
SELECT
    eg.game_name,
    COUNT(gs.session_id)                                                AS total_sessions,
    MIN(gs.raw_score)                                                   AS min_score,
    ROUND(AVG(gs.raw_score), 0)                                        AS mean_score,
    PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY gs.raw_score)::INT    AS p50_median,
    PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY gs.raw_score)::INT    AS p75,
    PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY gs.raw_score)::INT    AS p90,
    PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY gs.raw_score)::INT    AS p99,
    MAX(gs.raw_score)                                                   AS max_score,
    -- Coefficient of variation: how spread out are scores?
    ROUND(STDDEV(gs.raw_score) / NULLIF(AVG(gs.raw_score), 0) * 100, 1) AS score_cv_pct
FROM Game_Sessions  gs
JOIN E_Sports_Games eg ON gs.game_id = eg.game_id
WHERE gs.status = 'PROCESSED'
GROUP BY eg.game_id, eg.game_name
ORDER BY eg.game_name;


-- ─────────────────────────────────────────────────────────────
-- Q7. FILTER Clause — Conditional Multi-Metric Aggregation
--
--  The FILTER clause is cleaner and faster than CASE WHEN
--  inside aggregate functions. Produces a rich pivot-style
--  summary in a single scan of Wallet_Ledger.
-- ─────────────────────────────────────────────────────────────
SELECT
    s.roll_number,
    s.full_name,
    s.current_balance,

    -- Earnings
    COUNT(*)  FILTER (WHERE wl.transaction_type = 'GAME_EARNING')         AS game_txn_count,
    SUM(wl.amount) FILTER (WHERE wl.transaction_type = 'GAME_EARNING')    AS total_earned,

    -- Cafeteria
    COUNT(*)  FILTER (WHERE wl.transaction_type = 'CAFETERIA_SPEND')      AS caf_txn_count,
    SUM(ABS(wl.amount)) FILTER (WHERE wl.transaction_type = 'CAFETERIA_SPEND') AS caf_total_spend,

    -- Bookshop
    COUNT(*)  FILTER (WHERE wl.transaction_type = 'BOOKSHOP_SPEND')       AS bs_txn_count,
    SUM(ABS(wl.amount)) FILTER (WHERE wl.transaction_type = 'BOOKSHOP_SPEND')  AS bs_total_spend,

    -- Spend vs. Earn ratio (1.0 = broke even, >1 = spending more than earning)
    ROUND(
        COALESCE(SUM(ABS(wl.amount)) FILTER (WHERE wl.amount < 0), 0)
        /
        NULLIF(SUM(wl.amount) FILTER (WHERE wl.amount > 0), 0),
    2)                                                                     AS spend_to_earn_ratio,

    -- Last activity timestamp
    MAX(wl.transaction_timestamp)                                          AS last_active_at

FROM Students      s
LEFT JOIN Wallet_Ledger wl ON s.student_id = wl.student_id
GROUP BY s.student_id, s.roll_number, s.full_name, s.current_balance
ORDER BY total_earned DESC NULLS LAST;


-- ─────────────────────────────────────────────────────────────
-- Q8. Top-3 Items per Cafeteria Category  (Top-N per Group)
--
--  Uses DENSE_RANK() partitioned by category so each category
--  independently shows its top 3 sellers by revenue.
-- ─────────────────────────────────────────────────────────────
WITH ranked_items AS (
    SELECT
        ci.category,
        ci.item_name,
        ci.price                                                        AS current_price,
        SUM(cod.quantity_purchased)                                     AS units_sold,
        SUM(cod.quantity_purchased * cod.unit_price_at_purchase)        AS revenue,
        DENSE_RANK() OVER (
            PARTITION BY ci.category
            ORDER BY SUM(cod.quantity_purchased * cod.unit_price_at_purchase) DESC
        )                                                               AS category_revenue_rank
    FROM  Cafeteria_Items        ci
    JOIN  Cafeteria_Order_Details cod ON ci.item_id   = cod.item_id
    JOIN  Cafeteria_Orders        co  ON cod.order_id = co.order_id
                                     AND co.status = 'COMPLETED'
    GROUP BY ci.item_id, ci.category, ci.item_name, ci.price
)
SELECT
    category,
    category_revenue_rank,
    item_name,
    current_price,
    units_sold,
    ROUND(revenue, 2)     AS revenue
FROM  ranked_items
WHERE category_revenue_rank <= 3
ORDER BY category, category_revenue_rank;


-- ─────────────────────────────────────────────────────────────
-- Q9. Student RFM Segmentation
--     (Recency · Frequency · Monetary)
--
--  Classic marketing model applied to student wallet data.
--    R = days since last transaction (lower = better)
--    F = total number of transactions
--    M = total amount spent
--
--  NTILE(4) splits students into quartiles for each dimension.
--  Combined RFM score (1=worst 4=best per dimension) segments
--  students into actionable tiers.
-- ─────────────────────────────────────────────────────────────
WITH rfm_raw AS (
    SELECT
        s.student_id,
        s.roll_number,
        s.full_name,
        CURRENT_DATE - MAX(wl.transaction_timestamp)::DATE              AS recency_days,
        COUNT(*)                                                         AS frequency,
        SUM(ABS(wl.amount)) FILTER (WHERE wl.amount < 0)                AS monetary_spend
    FROM Students      s
    LEFT JOIN Wallet_Ledger wl ON s.student_id = wl.student_id
                               AND wl.transaction_type IN ('CAFETERIA_SPEND','BOOKSHOP_SPEND')
    GROUP BY s.student_id, s.roll_number, s.full_name
),
rfm_scored AS (
    SELECT *,
        -- Lower recency = more recent = better → invert with 5 - NTILE
        5 - NTILE(4) OVER (ORDER BY recency_days DESC)  AS r_score,
        NTILE(4)     OVER (ORDER BY frequency    ASC)   AS f_score,
        NTILE(4)     OVER (ORDER BY monetary_spend ASC) AS m_score
    FROM rfm_raw
)
SELECT
    roll_number,
    full_name,
    recency_days,
    frequency,
    ROUND(COALESCE(monetary_spend, 0), 2)          AS total_spend,
    r_score,
    f_score,
    m_score,
    (r_score + f_score + m_score)                  AS rfm_total,
    CASE
        WHEN (r_score + f_score + m_score) >= 10 THEN 'CHAMPION'
        WHEN (r_score + f_score + m_score) >=  7 THEN 'LOYAL'
        WHEN (r_score + f_score + m_score) >=  5 THEN 'POTENTIAL'
        WHEN r_score >= 3                         THEN 'NEW / RETURNING'
        ELSE                                           'AT RISK'
    END AS segment
FROM rfm_scored
ORDER BY rfm_total DESC;


-- ─────────────────────────────────────────────────────────────
-- Q10. Zero-Activity Days  (Date-Series Gap Analysis)
--
--  Generates a complete calendar between the first and last
--  order date, then LEFT JOINs actual orders to expose every
--  day the cafeteria had zero transactions.
--  Requires: generate_series() (built into PostgreSQL).
-- ─────────────────────────────────────────────────────────────
WITH date_spine AS (
    SELECT generate_series(
        (SELECT MIN(order_timestamp)::DATE FROM Cafeteria_Orders),
        CURRENT_DATE,
        INTERVAL '1 day'
    )::DATE AS calendar_date
),
daily_orders AS (
    SELECT
        order_timestamp::DATE   AS order_date,
        COUNT(*)                AS order_count,
        SUM(total_amount)       AS daily_revenue
    FROM  Cafeteria_Orders
    WHERE status = 'COMPLETED'
    GROUP BY order_timestamp::DATE
)
SELECT
    ds.calendar_date,
    COALESCE(do_.order_count,    0) AS order_count,
    COALESCE(do_.daily_revenue,  0) AS daily_revenue,
    CASE
        WHEN do_.order_date IS NULL THEN 'ZERO ACTIVITY'
        WHEN do_.order_count < 5   THEN 'LOW'
        WHEN do_.order_count < 20  THEN 'MODERATE'
        ELSE                            'HIGH'
    END AS activity_level
FROM date_spine          ds
LEFT JOIN daily_orders   do_ ON ds.calendar_date = do_.order_date
ORDER BY ds.calendar_date;


-- ─────────────────────────────────────────────────────────────
-- Q11. Point-in-Time Wallet Balance Reconstruction
--
--  For any given student, reconstructs their balance at every
--  moment in time by running a cumulative sum over the ledger.
--  This is the "account statement" view used in fintech systems.
-- ─────────────────────────────────────────────────────────────
WITH ordered_ledger AS (
    SELECT
        wl.transaction_id,
        wl.transaction_type,
        wl.amount,
        wl.transaction_timestamp,
        -- Balance after each transaction
        SUM(wl.amount) OVER (
            PARTITION BY wl.student_id
            ORDER BY wl.transaction_timestamp, wl.transaction_id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )  AS running_balance,
        -- Previous balance (for display in bank-statement style)
        LAG(SUM(wl.amount) OVER (
            PARTITION BY wl.student_id
            ORDER BY wl.transaction_timestamp, wl.transaction_id
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        )) OVER (
            PARTITION BY wl.student_id
            ORDER BY wl.transaction_timestamp, wl.transaction_id
        )  AS balance_before
    FROM Wallet_Ledger wl
    WHERE wl.student_id = 1  -- ← parameterise for your API
)
SELECT
    transaction_id,
    transaction_timestamp,
    transaction_type,
    CASE WHEN amount > 0 THEN amount  ELSE NULL END  AS credit,
    CASE WHEN amount < 0 THEN ABS(amount) ELSE NULL END AS debit,
    COALESCE(balance_before, 0)                       AS balance_before,
    running_balance                                   AS balance_after
FROM ordered_ledger
ORDER BY transaction_timestamp, transaction_id;


-- ─────────────────────────────────────────────────────────────
-- Q12. Session Heatmap  (Student × Game × Hour-of-Day)
--
--  Reveals when each student plays each game.
--  A frontend can render this as a colour-coded heatmap.
-- ─────────────────────────────────────────────────────────────
SELECT
    s.roll_number,
    eg.game_name,
    EXTRACT(HOUR FROM gs.played_at)::INT                AS hour_of_day,
    EXTRACT(DOW  FROM gs.played_at)::INT                AS day_of_week,  -- 0=Sun
    TO_CHAR(gs.played_at, 'Day')                        AS day_name,
    COUNT(*)                                            AS session_count,
    SUM(gs.cash_earned)                                 AS total_earned,
    ROUND(AVG(gs.raw_score), 0)                         AS avg_score,
    -- Proportion of this student-game's total sessions in this slot
    ROUND(
        COUNT(*)::NUMERIC
        / SUM(COUNT(*)) OVER (PARTITION BY gs.student_id, gs.game_id)
        * 100, 1
    )                                                   AS pct_of_student_game_sessions
FROM Game_Sessions  gs
JOIN Students        s  ON gs.student_id = s.student_id
JOIN E_Sports_Games  eg ON gs.game_id    = eg.game_id
WHERE gs.status = 'PROCESSED'
GROUP BY
    s.student_id, s.roll_number,
    eg.game_id,   eg.game_name,
    EXTRACT(HOUR FROM gs.played_at),
    EXTRACT(DOW  FROM gs.played_at),
    TO_CHAR(gs.played_at, 'Day')
ORDER BY s.roll_number, eg.game_name, day_of_week, hour_of_day;







-- ================================================================
--  FAST-INFINITY  |  Seed / Mock Data
--  Run order: 1_ddl.sql → 2_db_layer.sql → 3_transactions.sql → THIS
--
--  10 Students · 10 Cafeteria Items · 8 Bookshop Items · 4 Games
--  20 Game Sessions (1 fraud-flagged) · 15 Cafeteria Orders
--  8 Bookshop Orders · Full Wallet Ledger (52 entries)
--
--  GUARANTEED CONSISTENCY
--    ✓ Every student's current_balance = SUM(wallet_ledger.amount)
--    ✓ Every item's stock_quantity = initial - sold + restocked
--    ✓ Every order's total_amount = SUM(qty × unit_price) in details
--    ✓ REJECTED session has NO matching wallet ledger entry
--    ✓ FK insert order respects all constraints
-- ================================================================

BEGIN;

-- ────────────────────────────────────────────────────────────────
-- 1. STUDENTS
--    Balances are pre-computed to match Section 11 (Wallet Ledger)
--    Formula per student:  initial + game_earnings - cafeteria - bookshop
-- ────────────────────────────────────────────────────────────────
--  Ali Hassan    :  2000 + 250 + 320 - 260 - 200 - 220 - 320 = 1570
--  Fatima Malik  :  1500 + 175 + 240 - 270 - 180 - 1200      =  265
--  Omar Sheikh   :  1800 + 480 + 360 - 220 - 170 - 1650      =  600
--  Ayesha Khan   :  1200 + 150 - 170 - 300                   =  880
--  Bilal Ahmed   :  3000 + 150 + 120 - 520 - 1800            =  950  (fraud session NOT credited)
--  Sana Tariq    :  1000 + 288 - 340 - 750                   =  198  (idle > 30 days)
--  Usman Raza    :  2500 + 390 + 480 - 400 - 1210            = 1760
--  Hira Baig     :   800 +  90 + 120 - 340                   =  670
--  Hamza Qureshi :  5000 + 800 + 640 + 540 - 400 - 2850      = 3730  (3-day streak)
--  Zara Hussain  :  1500 + 200 + 360 - 400 - 200             = 1460
INSERT INTO Students (student_id, roll_number, password_hash, full_name, current_balance) VALUES
( 1, '23L-0001', '$2b$12$Ali.HashedPwd.MockOnly.000001', 'Ali Hassan',      1570.00),
( 2, '23L-0002', '$2b$12$Fat.HashedPwd.MockOnly.000002', 'Fatima Malik',     265.00),
( 3, '23L-0003', '$2b$12$Oma.HashedPwd.MockOnly.000003', 'Omar Sheikh',      600.00),
( 4, '23L-0004', '$2b$12$Aye.HashedPwd.MockOnly.000004', 'Ayesha Khan',      880.00),
( 5, '23L-0005', '$2b$12$Bil.HashedPwd.MockOnly.000005', 'Bilal Ahmed',      950.00),
( 6, '22L-0101', '$2b$12$San.HashedPwd.MockOnly.000006', 'Sana Tariq',       198.00),
( 7, '22L-0102', '$2b$12$Usm.HashedPwd.MockOnly.000007', 'Usman Raza',      1760.00),
( 8, '22L-0103', '$2b$12$Hir.HashedPwd.MockOnly.000008', 'Hira Baig',        670.00),
( 9, '21L-0201', '$2b$12$Ham.HashedPwd.MockOnly.000009', 'Hamza Qureshi',   3730.00),
(10, '21L-0202', '$2b$12$Zar.HashedPwd.MockOnly.000010', 'Zara Hussain',    1460.00);


-- ────────────────────────────────────────────────────────────────
-- 2. E-SPORTS GAMES
-- ────────────────────────────────────────────────────────────────
INSERT INTO E_Sports_Games (game_id, external_game_code, game_name, score_to_cash_ratio, is_active) VALUES
(1, 'VALORANT', 'Valorant',          0.1000, TRUE),
(2, 'FIFA24',   'FIFA 24',           0.0500, TRUE),
(3, 'CS2',      'Counter-Strike 2',  0.0800, TRUE),
(4, 'PUBGM',    'PUBG Mobile',       0.0600, TRUE);


-- ────────────────────────────────────────────────────────────────
-- 3. CAFETERIA ITEMS
--    stock_quantity = CURRENT state after all purchases + restocks
--    Derivation:
--      Chicken Burger  : 50 initial − 5 sold                = 45
--      Masala Fries    : 60 initial − 4 sold                = 56
--      Samosa (2 pcs)  : 80 initial − 7 sold                = 73
--      Chai            :100 initial − 7 sold                = 93
--      Cold Coffee     : 20 initial +15 restocked − 5 sold  = 30
--      Biryani Plate   :  5 initial +20 restocked − 4 sold  = 21  ← restocked from critical low
--      Club Sandwich   : 30 initial − 4 sold                = 26
--      Mineral Water   :150 initial − 1 sold                =149
--      Mango Shake     : 40 initial − 3 sold                = 37
--      Chocolate Muffin: 50 initial − 3 sold                = 47
-- ────────────────────────────────────────────────────────────────
INSERT INTO Cafeteria_Items (item_id, item_name, description, price, stock_quantity, category, is_active) VALUES
( 1, 'Chicken Burger',    'Crispy chicken fillet, lettuce, mayo on a sesame bun',  180.00,  45, 'FOOD',     TRUE),
( 2, 'Masala Fries',      'Shoestring fries tossed in desi spice blend',            80.00,  56, 'SNACK',    TRUE),
( 3, 'Samosa (2 pcs)',    'Flaky pastry stuffed with spiced potatoes & meat',       40.00,  73, 'SNACK',    TRUE),
( 4, 'Chai',              'Strong doodh patti — the FAST standard',                 30.00,  93, 'BEVERAGE', TRUE),
( 5, 'Cold Coffee',       'Iced blended coffee with full-cream milk',              120.00,  30, 'BEVERAGE', TRUE),
( 6, 'Biryani Plate',     'Chicken biryani with raita and garden salad',           220.00,  21, 'FOOD',     TRUE),
( 7, 'Club Sandwich',     'Triple-decker chicken & veggie on toasted bread',       160.00,  26, 'FOOD',     TRUE),
( 8, 'Mineral Water',     'Nestle 500 ml chilled bottle',                           50.00, 149, 'BEVERAGE', TRUE),
( 9, 'Mango Shake',       'Thick Chaunsa mango milkshake',                         100.00,  37, 'BEVERAGE', TRUE),
(10, 'Chocolate Muffin',  'Double-chocolate chip muffin, freshly baked',            70.00,  47, 'SNACK',    TRUE);


-- ────────────────────────────────────────────────────────────────
-- 4. BOOKSHOP ITEMS
--    stock_quantity = CURRENT state after all purchases
--      Data Structures      : 15 − 1 = 14
--      Calculus             : 10 − 2 =  8
--      A4 Notebook          : 50 − 6 = 44
--      Ball Pen Set         : 40 − 2 = 38
--      USB Flash Drive 32GB : 20 − 2 = 18
--      FAST Hoodie          : 30 − 1 = 29
--      Intro to OOP         : 12 − 1 = 11
--      Scientific Calculator: 15 − 2 = 13
-- ────────────────────────────────────────────────────────────────
INSERT INTO Bookshop_Items (item_id, item_name, item_category, isbn, author, price, stock_quantity, is_active) VALUES
(1, 'Data Structures & Algorithms in C++', 'TEXTBOOK',    '978-0132847377', 'Michael Goodrich',   850.00,  14, TRUE),
(2, 'Calculus: Early Transcendentals',     'TEXTBOOK',    '978-1285741550', 'James Stewart',     1200.00,   8, TRUE),
(3, 'A4 Spiral Notebook (200 pages)',      'STATIONERY',  NULL,              NULL,                120.00,  44, TRUE),
(4, 'Ball Pen Set (10 pcs)',               'STATIONERY',  NULL,              NULL,                 80.00,  38, TRUE),
(5, 'USB Flash Drive 32GB',                'ELECTRONICS', NULL,              NULL,                450.00,  18, TRUE),
(6, 'FAST-NUCES Hoodie (Navy Blue)',       'MERCHANDISE', NULL,              NULL,               1800.00,  29, TRUE),
(7, 'Introduction to OOP with Java',       'TEXTBOOK',    '978-0132575669', 'Harvey M. Deitel',   750.00,  11, TRUE),
(8, 'Casio FX-991EX Scientific Calculator','ELECTRONICS', NULL,              NULL,               1200.00,  13, TRUE);


-- ────────────────────────────────────────────────────────────────
-- 5. GAME SESSIONS
--    Session 10 (Bilal, Valorant) is REJECTED_SUSPICIOUS
--    His prior avg = (1500+1200)/2 = 1350
--    Score 15000 > 5 × 1350 = 6750  → fraud flag triggered
--    → No Wallet_Ledger entry exists for session 10
--
--    Sessions 16-17-18 are Hamza on 3 consecutive days
--    → Detected by the Island-Detection streak query (Q1)
-- ────────────────────────────────────────────────────────────────
INSERT INTO Game_Sessions (session_id, student_id, game_id, external_match_id, raw_score, cash_earned, played_at, status) VALUES
-- Ali Hassan — Valorant then CS2 (consecutive days, 2-day streak)
( 1,  1, 1, 'MATCH-VAL-00001', 2500,  250.00, NOW() - INTERVAL '45 days' + INTERVAL '19 hours', 'PROCESSED'),
( 2,  1, 3, 'MATCH-CS2-00001', 4000,  320.00, NOW() - INTERVAL '44 days' + INTERVAL '20 hours', 'PROCESSED'),
-- Fatima Malik — FIFA then Valorant
( 3,  2, 2, 'MATCH-FIFA-00001',3500,  175.00, NOW() - INTERVAL '42 days' + INTERVAL '18 hours', 'PROCESSED'),
( 4,  2, 1, 'MATCH-VAL-00002', 2400,  240.00, NOW() - INTERVAL '35 days' + INTERVAL '21 hours', 'PROCESSED'),
-- Omar Sheikh — CS2 then PUBG (consecutive days)
( 5,  3, 3, 'MATCH-CS2-00002', 6000,  480.00, NOW() - INTERVAL '38 days' + INTERVAL '17 hours', 'PROCESSED'),
( 6,  3, 4, 'MATCH-PUBG-00001',6000,  360.00, NOW() - INTERVAL '37 days' + INTERVAL '20 hours', 'PROCESSED'),
-- Ayesha Khan — FIFA
( 7,  4, 2, 'MATCH-FIFA-00002',3000,  150.00, NOW() - INTERVAL '30 days' + INTERVAL '16 hours', 'PROCESSED'),
-- Bilal Ahmed — two clean Valorant sessions, then one ANOMALOUS
( 8,  5, 1, 'MATCH-VAL-00003', 1500,  150.00, NOW() - INTERVAL '20 days' + INTERVAL '22 hours', 'PROCESSED'),
( 9,  5, 1, 'MATCH-VAL-00004', 1200,  120.00, NOW() - INTERVAL '15 days' + INTERVAL '21 hours', 'PROCESSED'),
(10,  5, 1, 'MATCH-VAL-00005',15000, 1500.00, NOW() - INTERVAL '10 days' + INTERVAL '23 hours', 'REJECTED_SUSPICIOUS'),
-- Sana Tariq — CS2 (happened 40 days ago; she's now idle)
(11,  6, 3, 'MATCH-CS2-00003', 3600,  288.00, NOW() - INTERVAL '40 days' + INTERVAL '18 hours', 'PROCESSED'),
-- Usman Raza — Valorant + CS2
(12,  7, 1, 'MATCH-VAL-00006', 3900,  390.00, NOW() - INTERVAL '28 days' + INTERVAL '19 hours', 'PROCESSED'),
(13,  7, 3, 'MATCH-CS2-00004', 6000,  480.00, NOW() - INTERVAL '22 days' + INTERVAL '20 hours', 'PROCESSED'),
-- Hira Baig — FIFA + PUBG
(14,  8, 2, 'MATCH-FIFA-00003',1800,   90.00, NOW() - INTERVAL '33 days' + INTERVAL '17 hours', 'PROCESSED'),
(15,  8, 4, 'MATCH-PUBG-00002',2000,  120.00, NOW() - INTERVAL '32 days' + INTERVAL '19 hours', 'PROCESSED'),
-- Hamza Qureshi — 3 CONSECUTIVE DAYS across 3 different games (streak = 3)
(16,  9, 1, 'MATCH-VAL-00007', 8000,  800.00, NOW() - INTERVAL '5 days'  + INTERVAL '19 hours', 'PROCESSED'),
(17,  9, 3, 'MATCH-CS2-00005', 8000,  640.00, NOW() - INTERVAL '4 days'  + INTERVAL '20 hours', 'PROCESSED'),
(18,  9, 4, 'MATCH-PUBG-00003',9000,  540.00, NOW() - INTERVAL '3 days'  + INTERVAL '21 hours', 'PROCESSED'),
-- Zara Hussain — FIFA (old) + Valorant (recent)
(19, 10, 2, 'MATCH-FIFA-00004',4000,  200.00, NOW() - INTERVAL '50 days' + INTERVAL '16 hours', 'PROCESSED'),
(20, 10, 1, 'MATCH-VAL-00008', 3600,  360.00, NOW() - INTERVAL '8 days'  + INTERVAL '20 hours', 'PROCESSED');


-- ────────────────────────────────────────────────────────────────
-- 6. CAFETERIA ORDERS
--    Timestamps spread across different hours for peak-hour query
--    and different days for date-gap analysis
-- ────────────────────────────────────────────────────────────────
INSERT INTO Cafeteria_Orders (order_id, student_id, order_timestamp, total_amount, status) VALUES
-- Two orders each on different parts of the day for heatmap variety
( 1,  1, NOW() - INTERVAL '30 days' + INTERVAL '12 hours 30 minutes', 260.00, 'COMPLETED'),
( 2,  1, NOW() - INTERVAL '28 days' + INTERVAL '10 hours 15 minutes', 200.00, 'COMPLETED'),
( 3,  2, NOW() - INTERVAL '25 days' + INTERVAL '13 hours 00 minutes', 270.00, 'COMPLETED'),
( 4,  3, NOW() - INTERVAL '22 days' + INTERVAL '12 hours 00 minutes', 220.00, 'COMPLETED'),
( 5,  4, NOW() - INTERVAL '20 days' + INTERVAL '14 hours 30 minutes', 170.00, 'COMPLETED'),
( 6,  5, NOW() - INTERVAL '18 days' + INTERVAL '13 hours 30 minutes', 520.00, 'COMPLETED'),  -- biggest single order
( 7,  2, NOW() - INTERVAL '15 days' + INTERVAL '11 hours 00 minutes', 180.00, 'COMPLETED'),
( 8,  6, NOW() - INTERVAL '38 days' + INTERVAL '12 hours 45 minutes', 340.00, 'COMPLETED'),  -- Sana's only order (idle)
( 9,  7, NOW() - INTERVAL '10 days' + INTERVAL '13 hours 15 minutes', 400.00, 'COMPLETED'),
(10,  3, NOW() - INTERVAL '8 days'  + INTERVAL '10 hours 30 minutes', 170.00, 'COMPLETED'),
(11,  8, NOW() - INTERVAL '6 days'  + INTERVAL '15 hours 00 minutes', 340.00, 'COMPLETED'),
(12,  9, NOW() - INTERVAL '5 days'  + INTERVAL '12 hours 30 minutes', 400.00, 'COMPLETED'),
(13, 10, NOW() - INTERVAL '4 days'  + INTERVAL '14 hours 00 minutes', 400.00, 'COMPLETED'),
(14,  1, NOW() - INTERVAL '3 days'  + INTERVAL '13 hours 00 minutes', 220.00, 'COMPLETED'),
(15,  4, NOW() - INTERVAL '2 days'  + INTERVAL '11 hours 30 minutes', 300.00, 'COMPLETED');


-- ────────────────────────────────────────────────────────────────
-- 7. CAFETERIA ORDER DETAILS
--    Each row's qty × unit_price contributes to the order total
-- ────────────────────────────────────────────────────────────────
INSERT INTO Cafeteria_Order_Details (order_id, item_id, quantity_purchased, unit_price_at_purchase) VALUES
-- Order  1: Ali      — Chicken Burger(180×1) + Masala Fries(80×1)   = 260
( 1, 1, 1, 180.00),
( 1, 2, 1,  80.00),
-- Order  2: Ali      — Cold Coffee(120×1) + Samosa(40×2)            = 200
( 2, 5, 1, 120.00),
( 2, 3, 2,  40.00),
-- Order  3: Fatima   — Biryani(220×1) + Mineral Water(50×1)         = 270
( 3, 6, 1, 220.00),
( 3, 8, 1,  50.00),
-- Order  4: Omar     — Club Sandwich(160×1) + Chai(30×2)            = 220
( 4, 7, 1, 160.00),
( 4, 4, 2,  30.00),
-- Order  5: Ayesha   — Mango Shake(100×1) + Choc Muffin(70×1)       = 170
( 5, 9, 1, 100.00),
( 5,10, 1,  70.00),
-- Order  6: Bilal    — Chicken Burger(180×2) + Masala Fries(80×2)   = 520
( 6, 1, 2, 180.00),
( 6, 2, 2,  80.00),
-- Order  7: Fatima   — Samosa(40×3) + Chai(30×2)                    = 180
( 7, 3, 3,  40.00),
( 7, 4, 2,  30.00),
-- Order  8: Sana     — Biryani(220×1) + Cold Coffee(120×1)          = 340
( 8, 6, 1, 220.00),
( 8, 5, 1, 120.00),
-- Order  9: Usman    — Club Sandwich(160×2) + Masala Fries(80×1)    = 400
( 9, 7, 2, 160.00),
( 9, 2, 1,  80.00),
-- Order 10: Omar     — Chai(30×3) + Samosa(40×2)                    = 170
(10, 4, 3,  30.00),
(10, 3, 2,  40.00),
-- Order 11: Hira     — Mango Shake(100×2) + Choc Muffin(70×2)       = 340
(11, 9, 2, 100.00),
(11,10, 2,  70.00),
-- Order 12: Hamza    — Chicken Burger(180×1) + Biryani(220×1)        = 400
(12, 1, 1, 180.00),
(12, 6, 1, 220.00),
-- Order 13: Zara     — Cold Coffee(120×2) + Club Sandwich(160×1)    = 400
(13, 5, 2, 120.00),
(13, 7, 1, 160.00),
-- Order 14: Ali      — Biryani(220×1)                               = 220
(14, 6, 1, 220.00),
-- Order 15: Ayesha   — Chicken Burger(180×1) + Cold Coffee(120×1)   = 300
(15, 1, 1, 180.00),
(15, 5, 1, 120.00);


-- ────────────────────────────────────────────────────────────────
-- 8. CAFETERIA INVENTORY LOGS
--    2 restocks (Cold Coffee + Biryani) + 1 PURCHASE log per item
--    per order (mirrors what sp_place_cafeteria_order would write)
-- ────────────────────────────────────────────────────────────────
INSERT INTO Cafeteria_Inventory_Logs (item_id, change_amount, transaction_type, order_id, log_timestamp) VALUES
-- RESTOCKs (happened before purchases; restored critically low items)
( 6, +20, 'RESTOCK', NULL, NOW() - INTERVAL '50 days'),   -- Biryani:     5 → 25
( 5, +15, 'RESTOCK', NULL, NOW() - INTERVAL '45 days'),   -- Cold Coffee: 20 → 35

-- PURCHASE logs (negative = stock going out)
( 1, -1, 'PURCHASE',  1, NOW() - INTERVAL '30 days' + INTERVAL '12 hours 30 minutes'),
( 2, -1, 'PURCHASE',  1, NOW() - INTERVAL '30 days' + INTERVAL '12 hours 30 minutes'),
( 5, -1, 'PURCHASE',  2, NOW() - INTERVAL '28 days' + INTERVAL '10 hours 15 minutes'),
( 3, -2, 'PURCHASE',  2, NOW() - INTERVAL '28 days' + INTERVAL '10 hours 15 minutes'),
( 6, -1, 'PURCHASE',  3, NOW() - INTERVAL '25 days' + INTERVAL '13 hours 00 minutes'),
( 8, -1, 'PURCHASE',  3, NOW() - INTERVAL '25 days' + INTERVAL '13 hours 00 minutes'),
( 7, -1, 'PURCHASE',  4, NOW() - INTERVAL '22 days' + INTERVAL '12 hours 00 minutes'),
( 4, -2, 'PURCHASE',  4, NOW() - INTERVAL '22 days' + INTERVAL '12 hours 00 minutes'),
( 9, -1, 'PURCHASE',  5, NOW() - INTERVAL '20 days' + INTERVAL '14 hours 30 minutes'),
(10, -1, 'PURCHASE',  5, NOW() - INTERVAL '20 days' + INTERVAL '14 hours 30 minutes'),
( 1, -2, 'PURCHASE',  6, NOW() - INTERVAL '18 days' + INTERVAL '13 hours 30 minutes'),
( 2, -2, 'PURCHASE',  6, NOW() - INTERVAL '18 days' + INTERVAL '13 hours 30 minutes'),
( 3, -3, 'PURCHASE',  7, NOW() - INTERVAL '15 days' + INTERVAL '11 hours 00 minutes'),
( 4, -2, 'PURCHASE',  7, NOW() - INTERVAL '15 days' + INTERVAL '11 hours 00 minutes'),
( 6, -1, 'PURCHASE',  8, NOW() - INTERVAL '38 days' + INTERVAL '12 hours 45 minutes'),
( 5, -1, 'PURCHASE',  8, NOW() - INTERVAL '38 days' + INTERVAL '12 hours 45 minutes'),
( 7, -2, 'PURCHASE',  9, NOW() - INTERVAL '10 days' + INTERVAL '13 hours 15 minutes'),
( 2, -1, 'PURCHASE',  9, NOW() - INTERVAL '10 days' + INTERVAL '13 hours 15 minutes'),
( 4, -3, 'PURCHASE', 10, NOW() - INTERVAL '8 days'  + INTERVAL '10 hours 30 minutes'),
( 3, -2, 'PURCHASE', 10, NOW() - INTERVAL '8 days'  + INTERVAL '10 hours 30 minutes'),
( 9, -2, 'PURCHASE', 11, NOW() - INTERVAL '6 days'  + INTERVAL '15 hours 00 minutes'),
(10, -2, 'PURCHASE', 11, NOW() - INTERVAL '6 days'  + INTERVAL '15 hours 00 minutes'),
( 1, -1, 'PURCHASE', 12, NOW() - INTERVAL '5 days'  + INTERVAL '12 hours 30 minutes'),
( 6, -1, 'PURCHASE', 12, NOW() - INTERVAL '5 days'  + INTERVAL '12 hours 30 minutes'),
( 5, -2, 'PURCHASE', 13, NOW() - INTERVAL '4 days'  + INTERVAL '14 hours 00 minutes'),
( 7, -1, 'PURCHASE', 13, NOW() - INTERVAL '4 days'  + INTERVAL '14 hours 00 minutes'),
( 6, -1, 'PURCHASE', 14, NOW() - INTERVAL '3 days'  + INTERVAL '13 hours 00 minutes'),
( 1, -1, 'PURCHASE', 15, NOW() - INTERVAL '2 days'  + INTERVAL '11 hours 30 minutes'),
( 5, -1, 'PURCHASE', 15, NOW() - INTERVAL '2 days'  + INTERVAL '11 hours 30 minutes');


-- ────────────────────────────────────────────────────────────────
-- 9. BOOKSHOP ORDERS
-- ────────────────────────────────────────────────────────────────
INSERT INTO Bookshop_Orders (order_id, receipt_number, student_id, order_timestamp, total_amount, status) VALUES
(1, 'BSP-202503-0001',  1, NOW() - INTERVAL '25 days',  320.00, 'COMPLETED'),  -- Ali
(2, 'BSP-202503-0002',  2, NOW() - INTERVAL '20 days', 1200.00, 'COMPLETED'),  -- Fatima
(3, 'BSP-202503-0003',  3, NOW() - INTERVAL '18 days', 1650.00, 'COMPLETED'),  -- Omar
(4, 'BSP-202504-0001',  5, NOW() - INTERVAL '12 days', 1800.00, 'COMPLETED'),  -- Bilal (hoodie)
(5, 'BSP-202503-0004',  6, NOW() - INTERVAL '36 days',  750.00, 'COMPLETED'),  -- Sana  (idle period)
(6, 'BSP-202504-0002',  7, NOW() - INTERVAL '8 days',  1210.00, 'COMPLETED'),  -- Usman
(7, 'BSP-202504-0003',  9, NOW() - INTERVAL '7 days',  2850.00, 'COMPLETED'),  -- Hamza (biggest order)
(8, 'BSP-202503-0005', 10, NOW() - INTERVAL '40 days',  200.00, 'COMPLETED');  -- Zara  (old order)


-- ────────────────────────────────────────────────────────────────
-- 10. BOOKSHOP ORDER DETAILS
-- ────────────────────────────────────────────────────────────────
INSERT INTO Bookshop_Order_Details (order_id, item_id, quantity_purchased, unit_price_at_purchase) VALUES
-- BO1: Ali     — A4 Notebook(120×2) + Pen Set(80×1)                 = 320
(1, 3, 2, 120.00),
(1, 4, 1,  80.00),
-- BO2: Fatima  — Calculus(1200×1)                                   = 1200
(2, 2, 1, 1200.00),
-- BO3: Omar    — USB(450×1) + Scientific Calc(1200×1)               = 1650
(3, 5, 1,  450.00),
(3, 8, 1, 1200.00),
-- BO4: Bilal   — FAST Hoodie(1800×1)                                = 1800
(4, 6, 1, 1800.00),
-- BO5: Sana    — OOP Textbook(750×1)                                = 750
(5, 7, 1,  750.00),
-- BO6: Usman   — Data Structures(850×1) + A4 Notebook(120×3)        = 1210
(6, 1, 1,  850.00),
(6, 3, 3,  120.00),
-- BO7: Hamza   — Calculus(1200×1) + Sci Calc(1200×1) + USB(450×1)  = 2850
(7, 2, 1, 1200.00),
(7, 8, 1, 1200.00),
(7, 5, 1,  450.00),
-- BO8: Zara    — A4 Notebook(120×1) + Pen Set(80×1)                 = 200
(8, 3, 1, 120.00),
(8, 4, 1,  80.00);


-- ────────────────────────────────────────────────────────────────
-- 11. WALLET LEDGER  (52 entries)
--     One entry per financial event, in chronological order
--     GAME_EARNING  → amount is POSITIVE (credit)
--     CAFETERIA_SPEND / BOOKSHOP_SPEND → amount is NEGATIVE (debit)
--     MANUAL_ADJUSTMENT → positive for top-up, negative for deduction
-- ────────────────────────────────────────────────────────────────
INSERT INTO Wallet_Ledger
    (student_id, transaction_type, amount, game_session_id, cafeteria_order_id, bookshop_order_id, transaction_timestamp)
VALUES

-- ══ Student 1: Ali Hassan ═══════════════════════════════════════
--   Net: +2000 +250 +320 −260 −200 −320 −220 = 1570 ✓
( 1, 'MANUAL_ADJUSTMENT',  2000.00, NULL, NULL, NULL, NOW() - INTERVAL '60 days'),
( 1, 'GAME_EARNING',        250.00,    1, NULL, NULL, NOW() - INTERVAL '45 days' + INTERVAL '19 hours'),
( 1, 'GAME_EARNING',        320.00,    2, NULL, NULL, NOW() - INTERVAL '44 days' + INTERVAL '20 hours'),
( 1, 'CAFETERIA_SPEND',    -260.00, NULL,    1, NULL, NOW() - INTERVAL '30 days' + INTERVAL '12 hours 30 minutes'),
( 1, 'CAFETERIA_SPEND',    -200.00, NULL,    2, NULL, NOW() - INTERVAL '28 days' + INTERVAL '10 hours 15 minutes'),
( 1, 'BOOKSHOP_SPEND',     -320.00, NULL, NULL,    1, NOW() - INTERVAL '25 days'),
( 1, 'CAFETERIA_SPEND',    -220.00, NULL,   14, NULL, NOW() - INTERVAL '3 days'  + INTERVAL '13 hours'),

-- ══ Student 2: Fatima Malik ══════════════════════════════════════
--   Net: +1500 +175 +240 −270 −180 −1200 = 265 ✓
( 2, 'MANUAL_ADJUSTMENT',  1500.00, NULL, NULL, NULL, NOW() - INTERVAL '60 days'),
( 2, 'GAME_EARNING',        175.00,    3, NULL, NULL, NOW() - INTERVAL '42 days' + INTERVAL '18 hours'),
( 2, 'GAME_EARNING',        240.00,    4, NULL, NULL, NOW() - INTERVAL '35 days' + INTERVAL '21 hours'),
( 2, 'CAFETERIA_SPEND',    -270.00, NULL,    3, NULL, NOW() - INTERVAL '25 days' + INTERVAL '13 hours'),
( 2, 'BOOKSHOP_SPEND',    -1200.00, NULL, NULL,    2, NOW() - INTERVAL '20 days'),
( 2, 'CAFETERIA_SPEND',    -180.00, NULL,    7, NULL, NOW() - INTERVAL '15 days' + INTERVAL '11 hours'),

-- ══ Student 3: Omar Sheikh ═══════════════════════════════════════
--   Net: +1800 +480 +360 −220 −1650 −170 = 600 ✓
( 3, 'MANUAL_ADJUSTMENT',  1800.00, NULL, NULL, NULL, NOW() - INTERVAL '60 days'),
( 3, 'GAME_EARNING',        480.00,    5, NULL, NULL, NOW() - INTERVAL '38 days' + INTERVAL '17 hours'),
( 3, 'GAME_EARNING',        360.00,    6, NULL, NULL, NOW() - INTERVAL '37 days' + INTERVAL '20 hours'),
( 3, 'CAFETERIA_SPEND',    -220.00, NULL,    4, NULL, NOW() - INTERVAL '22 days' + INTERVAL '12 hours'),
( 3, 'BOOKSHOP_SPEND',    -1650.00, NULL, NULL,    3, NOW() - INTERVAL '18 days'),
( 3, 'CAFETERIA_SPEND',    -170.00, NULL,   10, NULL, NOW() - INTERVAL '8 days'  + INTERVAL '10 hours 30 minutes'),

-- ══ Student 4: Ayesha Khan ═══════════════════════════════════════
--   Net: +1200 +150 −170 −300 = 880 ✓
( 4, 'MANUAL_ADJUSTMENT',  1200.00, NULL, NULL, NULL, NOW() - INTERVAL '60 days'),
( 4, 'GAME_EARNING',        150.00,    7, NULL, NULL, NOW() - INTERVAL '30 days' + INTERVAL '16 hours'),
( 4, 'CAFETERIA_SPEND',    -170.00, NULL,    5, NULL, NOW() - INTERVAL '20 days' + INTERVAL '14 hours 30 minutes'),
( 4, 'CAFETERIA_SPEND',    -300.00, NULL,   15, NULL, NOW() - INTERVAL '2 days'  + INTERVAL '11 hours 30 minutes'),

-- ══ Student 5: Bilal Ahmed ═══════════════════════════════════════
--   Net: +3000 +150 +120 −520 −1800 = 950 ✓
--   NOTE: Session 10 (REJECTED_SUSPICIOUS) has NO ledger entry
( 5, 'MANUAL_ADJUSTMENT',  3000.00, NULL, NULL, NULL, NOW() - INTERVAL '60 days'),
( 5, 'GAME_EARNING',        150.00,    8, NULL, NULL, NOW() - INTERVAL '20 days' + INTERVAL '22 hours'),
( 5, 'CAFETERIA_SPEND',    -520.00, NULL,    6, NULL, NOW() - INTERVAL '18 days' + INTERVAL '13 hours 30 minutes'),
( 5, 'GAME_EARNING',        120.00,    9, NULL, NULL, NOW() - INTERVAL '15 days' + INTERVAL '21 hours'),
( 5, 'BOOKSHOP_SPEND',    -1800.00, NULL, NULL,    4, NOW() - INTERVAL '12 days'),

-- ══ Student 6: Sana Tariq ════════════════════════════════════════
--   Net: +1000 +288 −340 −750 = 198 ✓
--   Last activity 36 days ago → appears in IDLE student query (Q5H)
( 6, 'MANUAL_ADJUSTMENT',  1000.00, NULL, NULL, NULL, NOW() - INTERVAL '90 days'),
( 6, 'GAME_EARNING',        288.00,   11, NULL, NULL, NOW() - INTERVAL '40 days' + INTERVAL '18 hours'),
( 6, 'CAFETERIA_SPEND',    -340.00, NULL,    8, NULL, NOW() - INTERVAL '38 days' + INTERVAL '12 hours 45 minutes'),
( 6, 'BOOKSHOP_SPEND',     -750.00, NULL, NULL,    5, NOW() - INTERVAL '36 days'),

-- ══ Student 7: Usman Raza ════════════════════════════════════════
--   Net: +2500 +390 +480 −400 −1210 = 1760 ✓
( 7, 'MANUAL_ADJUSTMENT',  2500.00, NULL, NULL, NULL, NOW() - INTERVAL '90 days'),
( 7, 'GAME_EARNING',        390.00,   12, NULL, NULL, NOW() - INTERVAL '28 days' + INTERVAL '19 hours'),
( 7, 'GAME_EARNING',        480.00,   13, NULL, NULL, NOW() - INTERVAL '22 days' + INTERVAL '20 hours'),
( 7, 'CAFETERIA_SPEND',    -400.00, NULL,    9, NULL, NOW() - INTERVAL '10 days' + INTERVAL '13 hours 15 minutes'),
( 7, 'BOOKSHOP_SPEND',    -1210.00, NULL, NULL,    6, NOW() - INTERVAL '8 days'),

-- ══ Student 8: Hira Baig ═════════════════════════════════════════
--   Net: +800 +90 +120 −340 = 670 ✓
( 8, 'MANUAL_ADJUSTMENT',   800.00, NULL, NULL, NULL, NOW() - INTERVAL '90 days'),
( 8, 'GAME_EARNING',         90.00,   14, NULL, NULL, NOW() - INTERVAL '33 days' + INTERVAL '17 hours'),
( 8, 'GAME_EARNING',        120.00,   15, NULL, NULL, NOW() - INTERVAL '32 days' + INTERVAL '19 hours'),
( 8, 'CAFETERIA_SPEND',    -340.00, NULL,   11, NULL, NOW() - INTERVAL '6 days'  + INTERVAL '15 hours'),

-- ══ Student 9: Hamza Qureshi ══════════════════════════════════════
--   Net: +5000 +800 +640 +540 −400 −2850 = 3730 ✓
--   Sessions 16,17,18 on 3 consecutive days → streak query returns 3
( 9, 'MANUAL_ADJUSTMENT',  5000.00, NULL, NULL, NULL, NOW() - INTERVAL '180 days'),
( 9, 'BOOKSHOP_SPEND',    -2850.00, NULL, NULL,    7, NOW() - INTERVAL '7 days'),
( 9, 'CAFETERIA_SPEND',    -400.00, NULL,   12, NULL, NOW() - INTERVAL '5 days'  + INTERVAL '12 hours 30 minutes'),
( 9, 'GAME_EARNING',        800.00,   16, NULL, NULL, NOW() - INTERVAL '5 days'  + INTERVAL '19 hours'),
( 9, 'GAME_EARNING',        640.00,   17, NULL, NULL, NOW() - INTERVAL '4 days'  + INTERVAL '20 hours'),
( 9, 'GAME_EARNING',        540.00,   18, NULL, NULL, NOW() - INTERVAL '3 days'  + INTERVAL '21 hours'),

-- ══ Student 10: Zara Hussain ══════════════════════════════════════
--   Net: +1500 +200 −200 +360 −400 = 1460 ✓
(10, 'MANUAL_ADJUSTMENT',  1500.00, NULL, NULL, NULL, NOW() - INTERVAL '180 days'),
(10, 'GAME_EARNING',        200.00,   19, NULL, NULL, NOW() - INTERVAL '50 days' + INTERVAL '16 hours'),
(10, 'BOOKSHOP_SPEND',     -200.00, NULL, NULL,    8, NOW() - INTERVAL '40 days'),
(10, 'GAME_EARNING',        360.00,   20, NULL, NULL, NOW() - INTERVAL '8 days'  + INTERVAL '20 hours'),
(10, 'CAFETERIA_SPEND',    -400.00, NULL,   13, NULL, NOW() - INTERVAL '4 days'  + INTERVAL '14 hours');


-- ────────────────────────────────────────────────────────────────
-- 12. RESET SEQUENCES
--     So the next INSERT after this seed uses the correct next ID
-- ────────────────────────────────────────────────────────────────
SELECT setval(pg_get_serial_sequence('Students',               'student_id'),  10);
SELECT setval(pg_get_serial_sequence('E_Sports_Games',         'game_id'),      4);
SELECT setval(pg_get_serial_sequence('Cafeteria_Items',        'item_id'),     10);
SELECT setval(pg_get_serial_sequence('Bookshop_Items',         'item_id'),      8);
SELECT setval(pg_get_serial_sequence('Game_Sessions',          'session_id'),  20);
SELECT setval(pg_get_serial_sequence('Cafeteria_Orders',       'order_id'),    15);
SELECT setval(pg_get_serial_sequence('Bookshop_Orders',        'order_id'),     8);
SELECT setval(pg_get_serial_sequence('Wallet_Ledger',          'transaction_id'),
              (SELECT COUNT(*) FROM Wallet_Ledger));
SELECT setval(pg_get_serial_sequence('Cafeteria_Inventory_Logs','log_id'),
              (SELECT COUNT(*) FROM Cafeteria_Inventory_Logs));

COMMIT;


-- ================================================================
-- VERIFICATION QUERIES
-- Run these after seeding to confirm everything is consistent
-- ================================================================

-- ① Wallet ledger must sum to current_balance for every student
--   Expected: discrepancy = 0.00 for all 10 rows
SELECT
    s.roll_number,
    s.full_name,
    s.current_balance                  AS stored_balance,
    SUM(wl.amount)                     AS ledger_sum,
    s.current_balance - SUM(wl.amount) AS discrepancy
FROM Students s
JOIN Wallet_Ledger wl ON s.student_id = wl.student_id
GROUP BY s.student_id, s.roll_number, s.full_name, s.current_balance
ORDER BY s.roll_number;

-- ② Every cafeteria order total must match sum of its detail lines
--   Expected: difference = 0.00 for all 15 rows
SELECT
    co.order_id,
    co.total_amount                                              AS order_total,
    SUM(cod.quantity_purchased * cod.unit_price_at_purchase)     AS detail_sum,
    co.total_amount
      - SUM(cod.quantity_purchased * cod.unit_price_at_purchase) AS difference
FROM Cafeteria_Orders       co
JOIN Cafeteria_Order_Details cod ON co.order_id = cod.order_id
GROUP BY co.order_id, co.total_amount
ORDER BY co.order_id;

-- ③ Every bookshop order total must match sum of its detail lines
--   Expected: difference = 0.00 for all 8 rows
SELECT
    bo.order_id,
    bo.receipt_number,
    bo.total_amount                                              AS order_total,
    SUM(bod.quantity_purchased * bod.unit_price_at_purchase)     AS detail_sum,
    bo.total_amount
      - SUM(bod.quantity_purchased * bod.unit_price_at_purchase) AS difference
FROM Bookshop_Orders       bo
JOIN Bookshop_Order_Details bod ON bo.order_id = bod.order_id
GROUP BY bo.order_id, bo.receipt_number, bo.total_amount
ORDER BY bo.order_id;

-- ④ Confirm the fraud-flagged session has no wallet credit
--   Expected: 0 rows (no GAME_EARNING for session_id = 10)
SELECT * FROM Wallet_Ledger WHERE game_session_id = 10;

-- ⑤ Quick dashboard — should show all 10 students with correct balances
SELECT roll_number, full_name, current_balance,
       total_game_earnings, total_cafeteria_spend, total_bookshop_spend
FROM vw_student_dashboard
ORDER BY roll_number;

-- ⑥ Leaderboard preview
SELECT roll_number, full_name, game_name, total_score, total_cash_earned, game_rank
FROM vw_esports_leaderboard
ORDER BY game_name, game_rank
LIMIT 15;

-- ⑦ Fraud review — should show 1 row (Bilal, session 10, ×11.1 avg)
SELECT roll_number, full_name, game_name, flagged_score,
       student_avg_score, score_vs_avg_multiplier
FROM (
    WITH per_student_game_stats AS (
        SELECT student_id, game_id,
               ROUND(AVG(raw_score), 0) AS avg_processed_score,
               MAX(raw_score)            AS max_processed_score,
               COUNT(*)                  AS total_clean_sessions
        FROM   Game_Sessions WHERE status = 'PROCESSED'
        GROUP BY student_id, game_id
    )
    SELECT gs.session_id, s.roll_number, s.full_name, eg.game_name,
           gs.raw_score AS flagged_score,
           pss.avg_processed_score AS student_avg_score,
           ROUND(gs.raw_score / NULLIF(pss.avg_processed_score, 0), 2) AS score_vs_avg_multiplier
    FROM Game_Sessions gs
    JOIN Students s ON gs.student_id = s.student_id
    JOIN E_Sports_Games eg ON gs.game_id = eg.game_id
    LEFT JOIN per_student_game_stats pss
           ON pss.student_id = gs.student_id AND pss.game_id = gs.game_id
    WHERE gs.status = 'REJECTED_SUSPICIOUS'
) fraud_check;

-- ⑧ Hamza's consecutive streak — should show streak_length_days = 3
WITH daily_plays AS (
    SELECT DISTINCT student_id, played_at::DATE AS play_date
    FROM Game_Sessions WHERE status = 'PROCESSED'
),
island_groups AS (
    SELECT student_id, play_date,
           play_date - (ROW_NUMBER() OVER (PARTITION BY student_id ORDER BY play_date)
                       * INTERVAL '1 day')::DATE AS island_key
    FROM daily_plays
),
streaks AS (
    SELECT student_id, MIN(play_date) AS streak_start, MAX(play_date) AS streak_end,
           COUNT(*) AS streak_length_days
    FROM island_groups GROUP BY student_id, island_key
)
SELECT s.roll_number, s.full_name, st.streak_start, st.streak_end, st.streak_length_days
FROM streaks st JOIN Students s ON st.student_id = s.student_id
ORDER BY streak_length_days DESC;
