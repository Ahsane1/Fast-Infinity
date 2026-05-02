
-- ============================================================
--  FAST-INFINITY  |  Database Layer
--  PostgreSQL 14+
-- ============================================================
--
--  SECTIONS
--  ─────────────────────────────────────────────────────────
--  0. TABLE CREATION (Storage Layer)
--  1. Performance Indexes
--  2. Helper / Utility Functions
--  	1.Student Balance
--		2.Student 30-Day Spending Breakdown 
--		3.Per-Student Game Performance Trend 
--  3. Views
--       3A. vw_student_dashboard
--       3B. vw_esports_leaderboard
--       3C. vw_wallet_transaction_history
--       3D. vw_cafeteria_inventory
--       3E. vw_bookshop_inventory
--       3F. vw_admin_revenue_dashboard
--		 3G. Detailed Item History 
--       3H. Game Session History
-- 		 3I. Peak Cafeteria Hours 
--		 3J. Top 10 Students by Total Wallet Activity 
-- 		 3K. Most Popular Cafeteria Items with Revenue Share % 
--		 3L. Fraud Review Dashboard 
--		 3M. Bookshop Revenue by Category with MoM comparison 
--		 3N. Idle Students

--  4. Stored Procedures
--       4A. sp_register_student
--       4B. sp_place_cafeteria_order
--       4C. sp_place_bookshop_order
--       4D. sp_record_game_session        (with fraud detection)
--		 4E. Process a Refund 
--       4F. sp_restock_cafeteria_item
--       4G. sp_manual_wallet_adjustment
--	5. ADVANCED ANALYTICAL QUERIES
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


-- ============================================================================

DROP TABLE IF EXISTS Cafeteria_Inventory_Logs CASCADE;
DROP TABLE IF EXISTS Cafeteria_Order_Details CASCADE;
DROP TABLE IF EXISTS Cafeteria_Items CASCADE;
DROP TABLE IF EXISTS Wallet_Ledger CASCADE;
DROP TABLE IF EXISTS Cafeteria_Orders CASCADE;
DROP TABLE IF EXISTS Game_Sessions CASCADE;
DROP TABLE IF EXISTS E_Sports_Games CASCADE;
DROP TABLE IF EXISTS Bookshop_Order_Details CASCADE;
DROP TABLE IF EXISTS Bookshop_Orders CASCADE;
DROP TABLE IF EXISTS Bookshop_Items CASCADE;
DROP TABLE IF EXISTS Students CASCADE;

-- ============================================================================
-- SECTION 0: TABLE CREATION (Storage Layer)
-- ============================================================================

CREATE TABLE Students (
    student_id SERIAL PRIMARY KEY,
    roll_number VARCHAR(15) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    current_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT CHK_Students_Balance CHECK (current_balance >= 0)
);

CREATE TABLE Cafeteria_Items (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL UNIQUE,
    description TEXT NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    category VARCHAR(50) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT CHK_Cafeteria_Price CHECK (price > 0),
    CONSTRAINT CHK_Cafeteria_Stock CHECK (stock_quantity >= 0)
);

CREATE TABLE Cafeteria_Orders (
    order_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL,
    order_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    CONSTRAINT FK_CafeteriaOrders_Students FOREIGN KEY (student_id) REFERENCES Students(student_id),
    CONSTRAINT CHK_Cafeteria_TotalAmount CHECK (total_amount >= 0),
    CONSTRAINT CHK_Cafeteria_Status CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'))
);

CREATE TABLE Cafeteria_Order_Details (
    order_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity_purchased INT NOT NULL,
    unit_price_at_purchase DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (order_id, item_id),
    CONSTRAINT FK_OrderDetails_Orders FOREIGN KEY (order_id) REFERENCES Cafeteria_Orders(order_id),
    CONSTRAINT FK_OrderDetails_Items FOREIGN KEY (item_id) REFERENCES Cafeteria_Items(item_id),
    CONSTRAINT CHK_OrderDetails_Quantity CHECK (quantity_purchased > 0)
);

CREATE TABLE Cafeteria_Inventory_Logs (
    log_id SERIAL PRIMARY KEY,
    item_id INT NOT NULL,
    change_amount INT NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    log_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    order_id INT NULL,
    CONSTRAINT FK_InventoryLogs_Items FOREIGN KEY (item_id) REFERENCES Cafeteria_Items(item_id),
    CONSTRAINT FK_InventoryLogs_Orders FOREIGN KEY (order_id) REFERENCES Cafeteria_Orders(order_id),
    CONSTRAINT CHK_InventoryLogs_Type CHECK (transaction_type IN ('PURCHASE', 'RESTOCK', 'ADJUSTMENT'))
);

CREATE TABLE E_Sports_Games (
    game_id SERIAL PRIMARY KEY,
    external_game_code VARCHAR(50) NOT NULL UNIQUE, 
    game_name VARCHAR(100) NOT NULL,
    score_to_cash_ratio DECIMAL(8,4) NOT NULL,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT CHK_Games_Ratio CHECK (score_to_cash_ratio > 0)
);

CREATE TABLE Game_Sessions (
    session_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL,
    game_id INT NOT NULL,
    external_match_id VARCHAR(100) UNIQUE NULL,
    raw_score INT NOT NULL,
    cash_earned DECIMAL(10,2) NOT NULL,
    played_at TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSED',
    CONSTRAINT FK_GameSessions_Students FOREIGN KEY (student_id) REFERENCES Students(student_id),
    CONSTRAINT FK_GameSessions_Games FOREIGN KEY (game_id) REFERENCES E_Sports_Games(game_id),
    CONSTRAINT CHK_GameSessions_Score CHECK (raw_score >= 0),
    CONSTRAINT CHK_GameSessions_Status CHECK (status IN ('PROCESSED', 'REJECTED_SUSPICIOUS'))
);

CREATE TABLE Bookshop_Items (
    item_id SERIAL PRIMARY KEY,
    item_name VARCHAR(150) NOT NULL,
    item_category VARCHAR(50) NOT NULL,
    isbn VARCHAR(20) NULL,
    author VARCHAR(100) NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    is_active BOOLEAN NOT NULL DEFAULT TRUE,
    CONSTRAINT CHK_Bookshop_Category CHECK (item_category IN ('TEXTBOOK', 'STATIONERY', 'ELECTRONICS', 'MERCHANDISE', 'OTHER')),
    CONSTRAINT CHK_Bookshop_Price CHECK (price > 0),
    CONSTRAINT CHK_Bookshop_Stock CHECK (stock_quantity >= 0)
);

CREATE TABLE Bookshop_Orders (
    order_id SERIAL PRIMARY KEY,
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    student_id INT NOT NULL,
    order_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    CONSTRAINT FK_BookshopOrders_Students FOREIGN KEY (student_id) REFERENCES Students(student_id),
    CONSTRAINT CHK_Bookshop_TotalAmount CHECK (total_amount >= 0),
    CONSTRAINT CHK_Bookshop_Status CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED', 'REFUNDED'))
);

CREATE TABLE Bookshop_Order_Details (
    order_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity_purchased INT NOT NULL,
    unit_price_at_purchase DECIMAL(10,2) NOT NULL,
    PRIMARY KEY (order_id, item_id),
    CONSTRAINT FK_BookshopOrderDetails_Orders FOREIGN KEY (order_id) REFERENCES Bookshop_Orders(order_id),
    CONSTRAINT FK_BookshopOrderDetails_Items FOREIGN KEY (item_id) REFERENCES Bookshop_Items(item_id),
    CONSTRAINT CHK_Bookshop_Quantity CHECK (quantity_purchased > 0)
);

CREATE TABLE Wallet_Ledger (
    transaction_id SERIAL PRIMARY KEY,
    student_id INT NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    amount DECIMAL(10,2) NOT NULL, 
    transaction_timestamp TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    game_session_id INT NULL,
    cafeteria_order_id INT NULL,
    bookshop_order_id INT NULL,
    CONSTRAINT FK_WalletLedger_Students FOREIGN KEY (student_id) REFERENCES Students(student_id),
    CONSTRAINT FK_WalletLedger_GameSessions FOREIGN KEY (game_session_id) REFERENCES Game_Sessions(session_id),
    CONSTRAINT FK_WalletLedger_Cafeteria FOREIGN KEY (cafeteria_order_id) REFERENCES Cafeteria_Orders(order_id),
    CONSTRAINT FK_WalletLedger_Bookshop FOREIGN KEY (bookshop_order_id) REFERENCES Bookshop_Orders(order_id),
    CONSTRAINT CHK_WalletLedger_Amount CHECK (amount <> 0), 
    CONSTRAINT CHK_WalletLedger_Type CHECK (transaction_type IN ('GAME_EARNING', 'CAFETERIA_SPEND', 'BOOKSHOP_SPEND', 'MANUAL_ADJUSTMENT'))
);


-- ================================================================
--  Seed / Mock Data
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
( 11, '23L-0001', '$2b$12$Ali.HashedPwd.MockOnly.000001', 'Ali Hassan',      1570.00),
( 2, '23L-0002', '$2b$12$Fat.HashedPwd.MockOnly.000002', 'Fatima Malik',     265.00),
( 3, '23L-0003', '$2b$12$Oma.HashedPwd.MockOnly.000003', 'Omar Sheikh',      600.00),
( 4, '23L-0004', '$2b$12$Aye.HashedPwd.MockOnly.000004', 'Ayesha Khan',      880.00),
( 5, '23L-0005', '$2b$12$Bil.HashedPwd.MockOnly.000005', 'Bilal Ahmed',      950.00),
( 6, '22L-0101', '$2b$12$San.HashedPwd.MockOnly.000006', 'Sana Tariq',       198.00),
( 7, '22L-0102', '$2b$12$Usm.HashedPwd.MockOnly.000007', 'Usman Raza',      1760.00),
( 8, '22L-0103', '$2b$12$Hir.HashedPwd.MockOnly.000008', 'Hira Baig',        670.00),
( 9, '21L-0201', '$2b$12$Ham.HashedPwd.MockOnly.000009', 'Hamza Qureshi',   3730.00),
(10, '21L-0202', '$2b$12$Zar.HashedPwd.MockOnly.000010', 'Zara Hussain',    1460.00);


INSERT INTO Students (student_id, roll_number, password_hash, full_name, current_balance) VALUES
( 1, '24L-0001', '$2b$12$Ali.HashedPwd.MockOnly.000001', 'Ali Hassan',      1570.00);

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


-- ============================================================================
-- SECTION 1: PERFORMANCE INDEXES
-- Ensures queries from the backend run instantly.
-- ============================================================================

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

-- ─────────────────────────────────────────────────────────────
-- 1 .STudent Balance
-- Returns current balance; raises if student doesn't exist.
-- Used as a lightweight guard in application-level checks.
-- ─────────────────────────────────────────────────────────────
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



-- 
-- ─────────────────────────────────────────────────────────────
-- 2. Student 30-Day Spending Breakdown 
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_student_spending_breakdown(p_student_id INT)
RETURNS TABLE (
    roll_number VARCHAR,
    full_name VARCHAR,
    transaction_type VARCHAR,
    transaction_count BIGINT,
    total_spent NUMERIC,
    avg_per_transaction NUMERIC,
    cumulative_spend NUMERIC
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.roll_number,
        s.full_name,
        wl.transaction_type::VARCHAR, -- Cast to match return type
        COUNT(*) AS transaction_count,
        SUM(ABS(wl.amount)) AS total_spent,
        ROUND(AVG(ABS(wl.amount)), 2) AS avg_per_transaction,
        SUM(SUM(ABS(wl.amount))) OVER (
            PARTITION BY s.student_id
            ORDER BY wl.transaction_type
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cumulative_spend
    FROM Students s
    JOIN Wallet_Ledger wl ON s.student_id = wl.student_id
    WHERE s.student_id = p_student_id 
      AND wl.transaction_timestamp >= NOW() - INTERVAL '30 days'
      AND wl.transaction_type IN ('CAFETERIA_SPEND', 'BOOKSHOP_SPEND')
    GROUP BY
        s.student_id, s.roll_number, s.full_name, wl.transaction_type
    ORDER BY wl.transaction_type;
END;
$$;


-- ─────────────────────────────────────────────────────────────
-- 3. Per-Student Game Performance Trend 
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_student_game_trend(p_student_id INT)
RETURNS TABLE (
    roll_number VARCHAR,
    full_name VARCHAR,
    game_name VARCHAR,
    play_date DATE,
    raw_score INT,
    cash_earned DECIMAL(10,2),
    rolling_7_session_avg NUMERIC,
    cumulative_earnings DECIMAL(10,2),
    session_number BIGINT
) 
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.roll_number,
        s.full_name,
        eg.game_name::VARCHAR,
        gs.played_at::DATE AS play_date,
        gs.raw_score,
        gs.cash_earned,
        ROUND(AVG(gs.raw_score) OVER (
            PARTITION BY gs.game_id
            ORDER BY gs.played_at
            ROWS BETWEEN 6 PRECEDING AND CURRENT ROW
        ), 0) AS rolling_7_session_avg,
        SUM(gs.cash_earned) OVER (
            PARTITION BY gs.game_id
            ORDER BY gs.played_at
            ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
        ) AS cumulative_earnings,
        ROW_NUMBER() OVER (
            PARTITION BY gs.game_id
            ORDER BY gs.played_at
        ) AS session_number
    FROM Game_Sessions gs
    JOIN Students s ON gs.student_id = s.student_id
    JOIN E_Sports_Games eg ON gs.game_id = eg.game_id
    WHERE gs.status = 'PROCESSED' 
      AND gs.student_id = p_student_id
    ORDER BY eg.game_name, gs.played_at;
END;
$$;

-- ============================================================================
-- SECTION 3: VIEWS (Read-Only Data for Backend GET Requests)
-- ============================================================================

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


-- ─────────────────────────────────────────
-- 3G. Detailed Item History (Exact items purchased)
-- ─────────────────────────────────────────


CREATE OR REPLACE VIEW vw_student_item_history AS
SELECT 
    co.student_id,
    'CAFETERIA' AS store_type,
    ci.item_name,
    cod.quantity_purchased AS quantity,
    cod.unit_price_at_purchase AS unit_price,
    (cod.quantity_purchased * cod.unit_price_at_purchase) AS line_total,
    co.order_timestamp AS transaction_date
FROM Cafeteria_Orders co
JOIN Cafeteria_Order_Details cod ON co.order_id = cod.order_id
JOIN Cafeteria_Items ci ON cod.item_id = ci.item_id
WHERE co.status = 'COMPLETED'
UNION ALL
SELECT 
    bo.student_id,
    'BOOKSHOP' AS store_type,
    bi.item_name,
    bod.quantity_purchased AS quantity,
    bod.unit_price_at_purchase AS unit_price,
    (bod.quantity_purchased * bod.unit_price_at_purchase) AS line_total,
    bo.order_timestamp AS transaction_date
FROM Bookshop_Orders bo
JOIN Bookshop_Order_Details bod ON bo.order_id = bod.order_id
JOIN Bookshop_Items bi ON bod.item_id = bi.item_id
WHERE bo.status = 'COMPLETED'
ORDER BY transaction_date DESC;


-- ─────────────────────────────────────────
-- 3H. Game Session History
-- ─────────────────────────────────────────


CREATE OR REPLACE VIEW vw_student_game_history AS
SELECT 
    gs.student_id,
    eg.game_name,
    gs.raw_score,
    gs.cash_earned,
    gs.status AS verification_status,
    gs.played_at AS session_date
FROM Game_Sessions gs
JOIN E_Sports_Games eg ON gs.game_id = eg.game_id
ORDER BY gs.played_at DESC;


-- ─────────────────────────────────────────────────────────────
-- 3I. Peak Cafeteria Hours 
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_peak_cafeteria_hours AS
SELECT
    EXTRACT(DOW  FROM co.order_timestamp)::INT          AS day_of_week_num,
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
-- 3J. Top 10 Students by Total Wallet Activity 
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_top_active_students AS
SELECT
    s.roll_number,
    s.full_name,
    s.current_balance,
    SUM(CASE WHEN wl.amount > 0 THEN  wl.amount    ELSE 0 END) AS total_credited,
    SUM(CASE WHEN wl.amount < 0 THEN  ABS(wl.amount) ELSE 0 END) AS total_debited,
    COUNT(*)                                                      AS total_transactions,
    DENSE_RANK() OVER (ORDER BY SUM(ABS(wl.amount)) DESC)         AS activity_rank
FROM Students s
JOIN Wallet_Ledger wl ON s.student_id = wl.student_id
GROUP BY s.student_id, s.roll_number, s.full_name, s.current_balance
ORDER BY activity_rank
LIMIT 10;


-- ─────────────────────────────────────────────────────────────
-- 3K. Most Popular Cafeteria Items with Revenue Share % 
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_popular_cafeteria_items AS
WITH item_stats AS (
    SELECT
        ci.item_id,
        ci.item_name,
        ci.category,
        ci.price                                                      AS current_price,
        SUM(cod.quantity_purchased)                                   AS units_sold,
        SUM(cod.quantity_purchased * cod.unit_price_at_purchase)      AS revenue
    FROM Cafeteria_Items ci
    JOIN Cafeteria_Order_Details cod ON ci.item_id   = cod.item_id
    JOIN Cafeteria_Orders        co  ON cod.order_id = co.order_id AND co.status = 'COMPLETED'
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
    ROUND((ist.revenue / NULLIF(gt.total, 0)) * 100, 2)               AS revenue_share_pct,
    RANK() OVER (ORDER BY ist.units_sold DESC)                        AS popularity_rank,
    RANK() OVER (ORDER BY ist.revenue    DESC)                        AS revenue_rank
FROM item_stats ist
CROSS JOIN grand_total gt
ORDER BY popularity_rank;


-- ─────────────────────────────────────────────────────────────
-- 3L. Fraud Review Dashboard 
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_fraud_review_dashboard AS
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
       ON pss.student_id = gs.student_id AND pss.game_id = gs.game_id
WHERE gs.status = 'REJECTED_SUSPICIOUS'
ORDER BY gs.played_at DESC;


-- ─────────────────────────────────────────────────────────────
-- 3M. Bookshop Revenue by Category with MoM comparison 
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_bookshop_revenue_mom AS
WITH monthly AS (
    SELECT
        bi.item_category,
        DATE_TRUNC('month', bo.order_timestamp)           AS month,
        SUM(bod.quantity_purchased * bod.unit_price_at_purchase) AS revenue,
        SUM(bod.quantity_purchased)                       AS units_sold
    FROM Bookshop_Items         bi
    JOIN Bookshop_Order_Details bod ON bi.item_id   = bod.item_id
    JOIN Bookshop_Orders        bo  ON bod.order_id = bo.order_id AND bo.status = 'COMPLETED'
    GROUP BY bi.item_category, DATE_TRUNC('month', bo.order_timestamp)
)
SELECT
    item_category,
    TO_CHAR(month, 'YYYY-MM')                             AS month,
    ROUND(revenue, 2)                                     AS revenue,
    units_sold,
    LAG(revenue) OVER (PARTITION BY item_category ORDER BY month) AS prev_month_revenue,
    ROUND(
        (revenue - LAG(revenue) OVER (PARTITION BY item_category ORDER BY month)) / 
        NULLIF(LAG(revenue) OVER (PARTITION BY item_category ORDER BY month), 0) * 100, 2
    ) AS revenue_growth_pct
FROM monthly
ORDER BY item_category, month DESC;


-- ─────────────────────────────────────────────────────────────
-- 3N. Idle Students
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE VIEW vw_idle_students AS
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

-- ============================================================================
-- SECTION 4: STORED PROCEDURES (Action Logic for Backend POST/PUT Requests)
-- Contains strict ACID guarantees and `FOR UPDATE` locks.
-- ============================================================================

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

-- 4E. Process a Refund (Reverses Order, Restores Money & Stock)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE PROCEDURE sp_refund_cafeteria_order(p_order_id INT) LANGUAGE plpgsql AS $$
DECLARE
    v_student_id INT; v_refund_amount DECIMAL(10,2); v_item RECORD;
BEGIN
    SELECT student_id, total_amount INTO v_student_id, v_refund_amount FROM Cafeteria_Orders WHERE order_id = p_order_id AND status = 'COMPLETED' FOR UPDATE;
    IF NOT FOUND THEN RAISE EXCEPTION 'Order not found or not eligible for refund.'; END IF;

    UPDATE Students SET current_balance = current_balance + v_refund_amount WHERE student_id = v_student_id;

    FOR v_item IN (SELECT item_id, quantity_purchased FROM Cafeteria_Order_Details WHERE order_id = p_order_id) LOOP
        UPDATE Cafeteria_Items SET stock_quantity = stock_quantity + v_item.quantity_purchased WHERE item_id = v_item.item_id;
        INSERT INTO Cafeteria_Inventory_Logs (item_id, change_amount, transaction_type, order_id) VALUES (v_item.item_id, v_item.quantity_purchased, 'ADJUSTMENT', p_order_id);
    END LOOP;

    UPDATE Cafeteria_Orders SET status = 'REFUNDED' WHERE order_id = p_order_id;
    INSERT INTO Wallet_Ledger (student_id, transaction_type, amount, cafeteria_order_id) VALUES (v_student_id, 'MANUAL_ADJUSTMENT', v_refund_amount, p_order_id);
END; $$;


-- ─────────────────────────────────────────────────────────────
-- 4F. Restock a Cafeteria Item  (Admin)
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
-- 4G. Manual Wallet Adjustment  (Admin)
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



-- ─────────────────────────────────────────────────────────────
--  SECTION 5  ADVANCED ANALYTICAL QUERIES
-- ─────────────────────────────────────────────────────────────

-- ─────────────────────────────────────────────────────────────
-- Q1. Consecutive-Day Play Streaks  (Island Detection)
--
--  Classic "gaps and islands" technique:
--    Subtract ROW_NUMBER from the date — consecutive dates
--    produce the same constant (the "island group").
--    RANK() on streak_length reveals the all-time leaders.
-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE PROCEDURE proc_batch_restock_items(
    p_items INT[][] -- Node.js will pass the array here
)
LANGUAGE plpgsql
AS $$
DECLARE
    v_pair      INT[];
    v_item_id   INT;
    v_qty       INT;
    v_item_name VARCHAR(100);
    v_new_stock INT;
    v_ok        INT := 0;
    v_skip      INT := 0;
BEGIN
    -- We loop over the parameter array instead of the hardcoded one
    FOREACH v_pair SLICE 1 IN ARRAY p_items
    LOOP
        v_item_id := v_pair[1];
        v_qty     := v_pair[2];

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

            v_ok := v_ok + 1;
            RAISE NOTICE 'Restocked item % ("%") → new stock=%', v_item_id, v_item_name, v_new_stock;

        EXCEPTION
            WHEN OTHERS THEN
                v_skip := v_skip + 1;
                RAISE WARNING 'Skipped item_id=% — %: %', v_item_id, SQLSTATE, SQLERRM;
        END;
    END LOOP;

    RAISE NOTICE 'Batch complete: % restocked, % skipped.', v_ok, v_skip;
END;
$$;



-- ─────────────────────────────────────────────────────────────
--	Q2.  ROLLUP — hierarchical revenue cube
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_get_revenue_cube()
RETURNS TABLE (
    source TEXT,
    month TEXT,
    total_revenue NUMERIC,
    total_orders BIGINT,
    avg_order_value NUMERIC,
    is_source_subtotal INT,
    is_month_subtotal INT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(revenue_base.source, 'ALL SOURCES')::TEXT,
        COALESCE(TO_CHAR(revenue_base.month, 'YYYY-MM'), 'ALL MONTHS')::TEXT,
        SUM(revenue_base.revenue),
        SUM(revenue_base.order_count),
        ROUND(SUM(revenue_base.revenue) / NULLIF(SUM(revenue_base.order_count), 0), 2),
        GROUPING(revenue_base.source),
        GROUPING(revenue_base.month)
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
    GROUP BY ROLLUP(revenue_base.source, revenue_base.month)
    ORDER BY
        GROUPING(revenue_base.source),
        GROUPING(revenue_base.month),
        revenue_base.source,
        revenue_base.month;
END;
$$;


-- ─────────────────────────────────────────────────────────────
--      Q3.  GROUPING SETS — multi-dimensional spend report
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_get_spend_analysis()
RETURNS TABLE (
    dimension TEXT,
    month TEXT,
    transactions BIGINT,
    total_amount NUMERIC,
    avg_amount NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        COALESCE(wl.transaction_type, 'GRAND TOTAL')::TEXT,
        COALESCE(TO_CHAR(DATE_TRUNC('month', wl.transaction_timestamp), 'YYYY-MM'), '—')::TEXT,
        COUNT(*),
        ROUND(SUM(ABS(wl.amount)), 2),
        ROUND(AVG(ABS(wl.amount)), 2)
    FROM Wallet_Ledger wl
    WHERE wl.transaction_type IN ('CAFETERIA_SPEND', 'BOOKSHOP_SPEND')
    GROUP BY GROUPING SETS (
        (wl.transaction_type),
        (DATE_TRUNC('month', wl.transaction_timestamp)),
        ()
    )
    ORDER BY
        GROUPING(wl.transaction_type),
        GROUPING(DATE_TRUNC('month', wl.transaction_timestamp)),
        wl.transaction_type,
        month;
END;
$$;

-- ─────────────────────────────────────────────────────────────
--       Q4.  Cohort Retention — week-0 earners who returned

-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_get_cohort_retention()
RETURNS TABLE (
    cohort_week TEXT,
    cohort_size BIGINT,
    weeks_since_join INT,
    active_students BIGINT,
    retention_pct NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH student_cohorts AS (
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
            EXTRACT(DAY FROM (sa.activity_week - sc.cohort_week))::INT / 7 AS weeks_since_join,
            COUNT(DISTINCT sa.student_id) AS active_students
        FROM student_cohorts sc
        JOIN student_activity sa ON sc.student_id = sa.student_id
        GROUP BY sc.cohort_week, weeks_since_join
    ),
    cohort_sizes AS (
        SELECT sc.cohort_week, COUNT(*) AS cohort_size
        FROM student_cohorts sc
        GROUP BY sc.cohort_week
    )
    SELECT
        TO_CHAR(ca.cohort_week, 'YYYY-MM-DD')::TEXT,
        cs.cohort_size,
        ca.weeks_since_join,
        ca.active_students,
        ROUND(ca.active_students::NUMERIC / cs.cohort_size * 100, 1)
    FROM cohort_activity ca
    JOIN cohort_sizes cs ON ca.cohort_week = cs.cohort_week
    ORDER BY ca.cohort_week, ca.weeks_since_join;
END;
$$;

-- ─────────────────────────────────────────────────────────────
--       Q5.  LATERAL JOIN — most recent order per student

-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_get_student_recent_orders()
RETURNS TABLE (
    roll_number VARCHAR,
    full_name VARCHAR,
    current_balance NUMERIC,
    last_cafeteria_order_id INT,
    last_cafeteria_spend NUMERIC,
    last_cafeteria_date TIMESTAMP,
    last_bookshop_receipt VARCHAR,
    last_bookshop_spend NUMERIC,
    last_bookshop_date TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.roll_number,
        s.full_name,
        s.current_balance,
        last_caf.order_id,
        last_caf.total_amount,
        last_caf.order_timestamp,
        last_bs.receipt_number,
        last_bs.total_amount,
        last_bs.order_timestamp
    FROM Students s
    LEFT JOIN LATERAL (
        SELECT order_id, total_amount, order_timestamp
        FROM Cafeteria_Orders
        WHERE student_id = s.student_id AND status = 'COMPLETED'
        ORDER BY order_timestamp DESC LIMIT 1
    ) last_caf ON TRUE
    LEFT JOIN LATERAL (
        SELECT receipt_number, total_amount, order_timestamp
        FROM Bookshop_Orders
        WHERE student_id = s.student_id AND status = 'COMPLETED'
        ORDER BY order_timestamp DESC LIMIT 1
    ) last_bs ON TRUE
    ORDER BY s.roll_number;
END;
$$;

-- ─────────────────────────────────────────────────────────────
--       Q6.  Score Percentiles per game (P50 / P75 / P90 / P99)

-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_get_game_score_percentiles()
RETURNS TABLE (
    game_name VARCHAR,
    total_sessions BIGINT,
    min_score INT,
    mean_score NUMERIC,
    p50_median INT,
    p75 INT,
    p90 INT,
    p99 INT,
    max_score INT,
    score_cv_pct NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        eg.game_name,
        COUNT(gs.session_id),
        MIN(gs.raw_score),
        ROUND(AVG(gs.raw_score), 0),
        PERCENTILE_CONT(0.50) WITHIN GROUP (ORDER BY gs.raw_score)::INT,
        PERCENTILE_CONT(0.75) WITHIN GROUP (ORDER BY gs.raw_score)::INT,
        PERCENTILE_CONT(0.90) WITHIN GROUP (ORDER BY gs.raw_score)::INT,
        PERCENTILE_CONT(0.99) WITHIN GROUP (ORDER BY gs.raw_score)::INT,
        MAX(gs.raw_score),
        ROUND((STDDEV(gs.raw_score) / NULLIF(AVG(gs.raw_score), 0))::NUMERIC * 100, 1)
    FROM Game_Sessions gs
    JOIN E_Sports_Games eg ON gs.game_id = eg.game_id
    WHERE gs.status = 'PROCESSED'
    GROUP BY eg.game_id, eg.game_name
    ORDER BY eg.game_name;
END;
$$;

-- ─────────────────────────────────────────────────────────────
--       Q7.  FILTER clause — conditional multi-metric aggregation

-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_get_student_metrics()
RETURNS TABLE (
    roll_number VARCHAR,
    full_name VARCHAR,
    current_balance NUMERIC,
    game_txn_count BIGINT,
    total_earned NUMERIC,
    caf_txn_count BIGINT,
    caf_total_spend NUMERIC,
    bs_txn_count BIGINT,
    bs_total_spend NUMERIC,
    spend_to_earn_ratio NUMERIC,
    last_active_at TIMESTAMP
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.roll_number,
        s.full_name,
        s.current_balance,
        COUNT(*) FILTER (WHERE wl.transaction_type = 'GAME_EARNING'),
        COALESCE(SUM(wl.amount) FILTER (WHERE wl.transaction_type = 'GAME_EARNING'), 0),
        COUNT(*) FILTER (WHERE wl.transaction_type = 'CAFETERIA_SPEND'),
        COALESCE(SUM(ABS(wl.amount)) FILTER (WHERE wl.transaction_type = 'CAFETERIA_SPEND'), 0),
        COUNT(*) FILTER (WHERE wl.transaction_type = 'BOOKSHOP_SPEND'),
        COALESCE(SUM(ABS(wl.amount)) FILTER (WHERE wl.transaction_type = 'BOOKSHOP_SPEND'), 0),
        ROUND(
            COALESCE(SUM(ABS(wl.amount)) FILTER (WHERE wl.amount < 0), 0) /
            NULLIF(SUM(wl.amount) FILTER (WHERE wl.amount > 0), 0), 2
        ),
        MAX(wl.transaction_timestamp)
    FROM Students s
    LEFT JOIN Wallet_Ledger wl ON s.student_id = wl.student_id
    GROUP BY s.student_id, s.roll_number, s.full_name, s.current_balance
    ORDER BY total_earned DESC NULLS LAST;
END;
$$;

-- ─────────────────────────────────────────────────────────────
--       Q8.  Top-3 items per cafeteria category (top-N per group)

-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_get_top_cafeteria_items()
RETURNS TABLE (
    category VARCHAR,
    category_revenue_rank BIGINT,
    item_name VARCHAR,
    current_price NUMERIC,
    units_sold BIGINT,
    revenue NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH ranked_items AS (
        SELECT
            ci.category,
            ci.item_name,
            ci.price AS current_price,
            SUM(cod.quantity_purchased) AS units_sold,
            SUM(cod.quantity_purchased * cod.unit_price_at_purchase) AS rev,
            DENSE_RANK() OVER (
                PARTITION BY ci.category
                ORDER BY SUM(cod.quantity_purchased * cod.unit_price_at_purchase) DESC
            ) AS rank
        FROM Cafeteria_Items ci
        JOIN Cafeteria_Order_Details cod ON ci.item_id = cod.item_id
        JOIN Cafeteria_Orders co ON cod.order_id = co.order_id AND co.status = 'COMPLETED'
        GROUP BY ci.item_id, ci.category, ci.item_name, ci.price
    )
    SELECT r.category, r.rank, r.item_name, r.current_price, r.units_sold, ROUND(r.rev, 2)
    FROM ranked_items r
    WHERE r.rank <= 3
    ORDER BY r.category, r.rank;
END;
$$;

-- ─────────────────────────────────────────────────────────────
--       Q9.  Student RFM Segmentation (Recency·Frequency·Monetary)

-- ─────────────────────────────────────────────────────────────
CREATE OR REPLACE FUNCTION fn_get_student_rfm()
RETURNS TABLE (
    roll_number VARCHAR,
    full_name VARCHAR,
    recency_days INT,
    frequency BIGINT,
    total_spend NUMERIC,
    r_score INT,
    f_score INT,
    m_score INT,
    rfm_total INT,
    segment TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH rfm_raw AS (
        SELECT
            s.student_id,
            s.roll_number,
            s.full_name,
            (CURRENT_DATE - MAX(wl.transaction_timestamp)::DATE)::INT AS recency_days,
            COUNT(*) AS frequency,
            SUM(ABS(wl.amount)) FILTER (WHERE wl.amount < 0) AS monetary_spend
        FROM Students s
        LEFT JOIN Wallet_Ledger wl ON s.student_id = wl.student_id AND wl.transaction_type IN ('CAFETERIA_SPEND','BOOKSHOP_SPEND')
        GROUP BY s.student_id, s.roll_number, s.full_name
    ),
    rfm_scored AS (
        SELECT *,
            (5 - NTILE(4) OVER (ORDER BY recency_days DESC))::INT AS r,
            NTILE(4) OVER (ORDER BY frequency ASC)::INT AS f,
            NTILE(4) OVER (ORDER BY monetary_spend ASC)::INT AS m
        FROM rfm_raw
    )
    SELECT
        rs.roll_number,
        rs.full_name,
        rs.recency_days,
        rs.frequency,
        ROUND(COALESCE(rs.monetary_spend, 0), 2),
        rs.r, rs.f, rs.m,
        (rs.r + rs.f + rs.m),
        CASE
            WHEN (rs.r + rs.f + rs.m) >= 10 THEN 'CHAMPION'::TEXT
            WHEN (rs.r + rs.f + rs.m) >= 7 THEN 'LOYAL'::TEXT
            WHEN (rs.r + rs.f + rs.m) >= 5 THEN 'POTENTIAL'::TEXT
            WHEN rs.r >= 3 THEN 'NEW / RETURNING'::TEXT
            ELSE 'AT RISK'::TEXT
        END
    FROM rfm_scored rs
    ORDER BY (rs.r + rs.f + rs.m) DESC;
END;
$$;

-- ─────────────────────────────────────────────────────────────
--       Q10. Zero-Activity Days — date-series gap analysis

-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_get_zero_activity_days()
RETURNS TABLE (
    calendar_date DATE,
    order_count BIGINT,
    daily_revenue NUMERIC,
    activity_level TEXT
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH date_spine AS (
        SELECT generate_series(
            (SELECT MIN(order_timestamp)::DATE FROM Cafeteria_Orders),
            CURRENT_DATE,
            INTERVAL '1 day'
        )::DATE AS cal_date
    ),
    daily_orders AS (
        SELECT
            order_timestamp::DATE AS order_date,
            COUNT(*) AS o_count,
            SUM(total_amount) AS daily_rev
        FROM Cafeteria_Orders
        WHERE status = 'COMPLETED'
        GROUP BY order_timestamp::DATE
    )
    SELECT
        ds.cal_date,
        COALESCE(do_.o_count, 0),
        COALESCE(do_.daily_rev, 0),
        CASE
            WHEN do_.order_date IS NULL THEN 'ZERO ACTIVITY'::TEXT
            WHEN do_.o_count < 5 THEN 'LOW'::TEXT
            WHEN do_.o_count < 20 THEN 'MODERATE'::TEXT
            ELSE 'HIGH'::TEXT
        END
    FROM date_spine ds
    LEFT JOIN daily_orders do_ ON ds.cal_date = do_.order_date
    ORDER BY ds.cal_date;
END;
$$;

-- ─────────────────────────────────────────────────────────────
--       Q11. Wallet Balance History (point-in-time reconstruction)

-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_get_wallet_statement(p_student_id INT)
RETURNS TABLE (
    transaction_id INT,
    transaction_timestamp TIMESTAMP,
    transaction_type VARCHAR,
    credit NUMERIC,
    debit NUMERIC,
    balance_before NUMERIC,
    balance_after NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    WITH ordered_ledger AS (
        SELECT
            wl.transaction_id,
            wl.transaction_type,
            wl.amount,
            wl.transaction_timestamp,
            SUM(wl.amount) OVER (
                PARTITION BY wl.student_id
                ORDER BY wl.transaction_timestamp, wl.transaction_id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            ) AS running_balance,
            LAG(SUM(wl.amount) OVER (
                PARTITION BY wl.student_id
                ORDER BY wl.transaction_timestamp, wl.transaction_id
                ROWS BETWEEN UNBOUNDED PRECEDING AND CURRENT ROW
            )) OVER (
                PARTITION BY wl.student_id
                ORDER BY wl.transaction_timestamp, wl.transaction_id
            ) AS bal_before
        FROM Wallet_Ledger wl
        WHERE wl.student_id = p_student_id
    )
    SELECT
        ol.transaction_id,
        ol.transaction_timestamp,
        ol.transaction_type,
        CASE WHEN ol.amount > 0 THEN ol.amount ELSE NULL END,
        CASE WHEN ol.amount < 0 THEN ABS(ol.amount) ELSE NULL END,
        COALESCE(ol.bal_before, 0),
        ol.running_balance
    FROM ordered_ledger ol
    ORDER BY ol.transaction_timestamp, ol.transaction_id;
END;
$$;

-- ─────────────────────────────────────────────────────────────
--       Q12. Session Heatmap  (student × game × hour-of-day)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION fn_get_session_heatmap()
RETURNS TABLE (
    roll_number VARCHAR,
    game_name VARCHAR,
    hour_of_day INT,
    day_of_week INT,
    day_name TEXT,
    session_count BIGINT,
    total_earned NUMERIC,
    avg_score NUMERIC,
    pct_of_student_game_sessions NUMERIC
)
LANGUAGE plpgsql
AS $$
BEGIN
    RETURN QUERY
    SELECT
        s.roll_number,
        eg.game_name,
        EXTRACT(HOUR FROM gs.played_at)::INT,
        EXTRACT(DOW FROM gs.played_at)::INT,
        TO_CHAR(gs.played_at, 'Day')::TEXT,
        COUNT(*),
        SUM(gs.cash_earned),
        ROUND(AVG(gs.raw_score), 0),
        ROUND((COUNT(*)::NUMERIC / SUM(COUNT(*)) OVER (PARTITION BY gs.student_id, gs.game_id)) * 100, 1)
    FROM Game_Sessions gs
    JOIN Students s ON gs.student_id = s.student_id
    JOIN E_Sports_Games eg ON gs.game_id = eg.game_id
    WHERE gs.status = 'PROCESSED'
    GROUP BY
        s.student_id, s.roll_number,
        eg.game_id, eg.game_name,
        EXTRACT(HOUR FROM gs.played_at),
        EXTRACT(DOW FROM gs.played_at),
        TO_CHAR(gs.played_at, 'Day')
    ORDER BY s.roll_number, eg.game_name, EXTRACT(DOW FROM gs.played_at)::INT, EXTRACT(HOUR FROM gs.played_at)::INT;
END;
$$;






