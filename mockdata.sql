

-- ==============================================================================
-- FAST CAMPUSVERSE: DATA SEEDING SCRIPT
-- Execute this after running your table creation DDL
-- ==============================================================================

-- 1. INSERT STUDENTS
-- Using the 2XL-YYYY pattern (L = Lahore Campus). Ahsan is Student 1.
INSERT INTO Students (roll_number, password_hash, full_name, current_balance) VALUES
('24L-3062', 'hashed_pwd_1', 'Ahsan Ali', 1500.00),
('24L-3100', 'hashed_pwd_2', 'Fatima Tariq', 800.00),
('23L-1024', 'hashed_pwd_3', 'Usman Khan', 2500.00),
('22L-0567', 'hashed_pwd_4', 'Zainab Qureshi', 120.00),
('21L-9011', 'hashed_pwd_5', 'Bilal Ahmed', 3500.00),
('24L-4001', 'hashed_pwd_6', 'Ayesha Malik', 450.00),
('22L-1122', 'hashed_pwd_7', 'Omar Farooq', 0.00);

-- 2. INSERT E-SPORTS GAMES
INSERT INTO E_Sports_Games (external_game_code, game_name, score_to_cash_ratio, is_active) VALUES
('TETRIS_01', 'Tetris Classic', 0.05, 1),
('VAL_01', 'Valorant Aim Trainer', 0.10, 1),
('CSGO_01', 'CS:GO Deathmatch', 0.20, 1),
('FIFA_24', 'FIFA Penalty Shootout', 0.50, 1);

-- 3. INSERT CAFETERIA ITEMS (Localized for FAST Lahore)
INSERT INTO Cafeteria_Items (item_name, description, price, stock_quantity, category, is_active) VALUES
('Spicy Zinger Burger', 'Crispy fried chicken with spicy mayo', 500.00, 50, 'Fast Food', 1),
('Chicken Biryani', 'Traditional Lahori biryani', 350.00, 40, 'Desi', 1),
('Karak Chai', 'Strong milk tea', 80.00, 100, 'Beverages', 1),
('Aloo Samosa', 'Crispy potato pastry', 50.00, 200, 'Snacks', 1),
('Chicken Shawarma', 'Arabic style wrap', 250.00, 60, 'Fast Food', 1);

-- 4. INSERT BOOKSHOP ITEMS
INSERT INTO Bookshop_Items (item_name, item_category, isbn, author, price, stock_quantity, is_active) VALUES
('Database Systems 6th Ed', 'TEXTBOOK', '978-013214', 'Thomas Connolly', 2500.00, 20, 1),
('FAST NUCES Hoodie (Black)', 'MERCHANDISE', NULL, NULL, 3000.00, 50, 1),
('Casio FX-991EX', 'ELECTRONICS', NULL, NULL, 4500.00, 15, 1),
('A4 Paper Ream', 'STATIONERY', NULL, NULL, 800.00, 30, 1),
('FAST NUCES Notebook', 'STATIONERY', NULL, NULL, 300.00, 100, 1);

-- 5. INSERT GAME SESSIONS (Generating Income)
-- Ahsan (Student 1) plays Tetris and CS:GO
INSERT INTO Game_Sessions (student_id, game_id, external_match_id, raw_score, cash_earned, status) VALUES
(1, 1, 'MATCH_001', 10000, 500.00, 'PROCESSED'), -- Tetris: 10000 * 0.05
(1, 3, 'MATCH_002', 5000, 1000.00, 'PROCESSED'), -- CSGO: 5000 * 0.20
(2, 2, 'MATCH_003', 8000, 800.00, 'PROCESSED'),  -- Fatima plays Valorant
(3, 4, 'MATCH_004', 5000, 2500.00, 'PROCESSED'), -- Usman plays FIFA
(7, 1, 'MATCH_005', 99999, 4999.95, 'REJECTED_SUSPICIOUS'); -- Omar gets flagged for cheating!

-- 6. INSERT CAFETERIA ORDERS & DETAILS
-- Ahsan buys a Zinger (500) and Chai (80) = 580
INSERT INTO Cafeteria_Orders (student_id, total_amount, status) VALUES (1, 580.00, 'COMPLETED');
INSERT INTO Cafeteria_Order_Details (order_id, item_id, quantity_purchased, unit_price_at_purchase) VALUES 
(1, 1, 1, 500.00), 
(1, 3, 1, 80.00);

-- Fatima buys Biryani (350)
INSERT INTO Cafeteria_Orders (student_id, total_amount, status) VALUES (2, 350.00, 'COMPLETED');
INSERT INTO Cafeteria_Order_Details (order_id, item_id, quantity_purchased, unit_price_at_purchase) VALUES 
(2, 2, 1, 350.00);

-- Update Cafeteria Inventory Logs
INSERT INTO Cafeteria_Inventory_Logs (item_id, change_amount, transaction_type, order_id) VALUES
(1, -1, 'PURCHASE', 1),
(3, -1, 'PURCHASE', 1),
(2, -1, 'PURCHASE', 2);

-- 7. INSERT BOOKSHOP ORDERS & DETAILS
-- Usman buys Database Textbook (2500)
INSERT INTO Bookshop_Orders (receipt_number, student_id, total_amount, status) VALUES ('REC-2026-001', 3, 2500.00, 'COMPLETED');
INSERT INTO Bookshop_Order_Details (order_id, item_id, quantity_purchased, unit_price_at_purchase) VALUES (1, 1, 1, 2500.00);

-- Ahsan buys a Notebook (300)
INSERT INTO Bookshop_Orders (receipt_number, student_id, total_amount, status) VALUES ('REC-2026-002', 1, 300.00, 'COMPLETED');
INSERT INTO Bookshop_Order_Details (order_id, item_id, quantity_purchased, unit_price_at_purchase) VALUES (2, 5, 1, 300.00);

-- 8. INSERT WALLET LEDGER TRANSACTIONS (The Audit Trail)
-- Ahsan's Ledger
INSERT INTO Wallet_Ledger (student_id, transaction_type, amount, game_session_id) VALUES (1, 'GAME_EARNING', 500.00, 1);
INSERT INTO Wallet_Ledger (student_id, transaction_type, amount, game_session_id) VALUES (1, 'GAME_EARNING', 1000.00, 2);
INSERT INTO Wallet_Ledger (student_id, transaction_type, amount, cafeteria_order_id) VALUES (1, 'CAFETERIA_SPEND', -580.00, 1);
INSERT INTO Wallet_Ledger (student_id, transaction_type, amount, bookshop_order_id) VALUES (1, 'BOOKSHOP_SPEND', -300.00, 2);
INSERT INTO Wallet_Ledger (student_id, transaction_type, amount) VALUES (1, 'MANUAL_ADJUSTMENT', 880.00); -- Initial deposit to reach 1500 balance

-- Fatima's Ledger
INSERT INTO Wallet_Ledger (student_id, transaction_type, amount, game_session_id) VALUES (2, 'GAME_EARNING', 800.00, 3);
INSERT INTO Wallet_Ledger (student_id, transaction_type, amount, cafeteria_order_id) VALUES (2, 'CAFETERIA_SPEND', -350.00, 2);
INSERT INTO Wallet_Ledger (student_id, transaction_type, amount) VALUES (2, 'MANUAL_ADJUSTMENT', 350.00); -- Deposit to reach 800 balance

-- Usman's Ledger
INSERT INTO Wallet_Ledger (student_id, transaction_type, amount, game_session_id) VALUES (3, 'GAME_EARNING', 2500.00, 4);
INSERT INTO Wallet_Ledger (student_id, transaction_type, amount, bookshop_order_id) VALUES (3, 'BOOKSHOP_SPEND', -2500.00, 1);
INSERT INTO Wallet_Ledger (student_id, transaction_type, amount) VALUES (3, 'MANUAL_ADJUSTMENT', 2500.00); -- Deposit to reach 2500 balance







