DROP TABLE IF EXISTS "Cafeteria_Inventory_Logs";
DROP TABLE IF EXISTS "Cafeteria_Order_Details";
DROP TABLE IF EXISTS "Cafeteria_Items";
DROP TABLE IF EXISTS "Wallet_Ledger";
DROP TABLE IF EXISTS "Cafeteria_Orders";
DROP TABLE IF EXISTS "Game_Sessions";
DROP TABLE IF EXISTS "E_Sports_Games";
DROP TABLE IF EXISTS "Bookshop_Order_Details";
DROP TABLE IF EXISTS "Bookshop_Orders";
DROP TABLE IF EXISTS "Bookshop_Items";
DROP TABLE IF EXISTS "Students";


CREATE TABLE Students (
    student_id INT IDENTITY(1,1) PRIMARY KEY,
    roll_number VARCHAR(15) NOT NULL UNIQUE,
    password_hash VARCHAR(255) NOT NULL,
    full_name VARCHAR(100) NOT NULL,
    current_balance DECIMAL(10,2) NOT NULL DEFAULT 0.00,
    CONSTRAINT CHK_Students_Balance CHECK (current_balance >= 0)
);


CREATE TABLE Cafeteria_Items (
    item_id INT IDENTITY(1,1) PRIMARY KEY,
    item_name VARCHAR(100) NOT NULL UNIQUE,
    description NVARCHAR(MAX) NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    category VARCHAR(50) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    
    CONSTRAINT CHK_Cafeteria_Price CHECK (price > 0),
    CONSTRAINT CHK_Cafeteria_Stock CHECK (stock_quantity >= 0)
);


CREATE TABLE Cafeteria_Orders (
    order_id INT IDENTITY(1,1) PRIMARY KEY,
    student_id INT NOT NULL,
    order_timestamp DATETIME NOT NULL DEFAULT GETDATE(),
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    
    CONSTRAINT FK_CafeteriaOrders_Students FOREIGN KEY (student_id) 
        REFERENCES Students(student_id),
    
    CONSTRAINT CHK_Cafeteria_TotalAmount CHECK (total_amount >= 0),
    CONSTRAINT CHK_Cafeteria_Status CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED'))
);

CREATE TABLE Cafeteria_Order_Details (
    order_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity_purchased INT NOT NULL,
    unit_price_at_purchase DECIMAL(10,2) NOT NULL,
    
    PRIMARY KEY (order_id, item_id),
    
    CONSTRAINT FK_OrderDetails_Orders FOREIGN KEY (order_id) 
        REFERENCES Cafeteria_Orders(order_id),
    CONSTRAINT FK_OrderDetails_Items FOREIGN KEY (item_id) 
        REFERENCES Cafeteria_Items(item_id),
    
    CONSTRAINT CHK_OrderDetails_Quantity CHECK (quantity_purchased > 0)
);

CREATE TABLE Cafeteria_Inventory_Logs (
    log_id INT IDENTITY(1,1) PRIMARY KEY,
    item_id INT NOT NULL,
    change_amount INT NOT NULL,
    transaction_type VARCHAR(50) NOT NULL,
    log_timestamp DATETIME NOT NULL DEFAULT GETDATE(),
    order_id INT NULL,
    
    CONSTRAINT FK_InventoryLogs_Items FOREIGN KEY (item_id) 
        REFERENCES Cafeteria_Items(item_id),
    CONSTRAINT FK_InventoryLogs_Orders FOREIGN KEY (order_id) 
        REFERENCES Cafeteria_Orders(order_id),
        
    CONSTRAINT CHK_InventoryLogs_Type CHECK (transaction_type IN ('PURCHASE', 'RESTOCK', 'ADJUSTMENT'))
);


CREATE TABLE E_Sports_Games (
    game_id INT IDENTITY(1,1) PRIMARY KEY,
    external_game_code VARCHAR(50) NOT NULL UNIQUE, 
    game_name VARCHAR(100) NOT NULL,
    score_to_cash_ratio DECIMAL(8,4) NOT NULL,
    is_active BIT NOT NULL DEFAULT 1,
    
    CONSTRAINT CHK_Games_Ratio CHECK (score_to_cash_ratio > 0)
);

CREATE TABLE Game_Sessions (
    session_id INT IDENTITY(1,1) PRIMARY KEY,
    student_id INT NOT NULL,
    game_id INT NOT NULL,
    external_match_id VARCHAR(100) UNIQUE NULL,
    raw_score INT NOT NULL,
    cash_earned DECIMAL(10,2) NOT NULL,
    played_at DATETIME NOT NULL DEFAULT GETDATE(),
    status VARCHAR(20) NOT NULL DEFAULT 'PROCESSED',
    
    CONSTRAINT FK_GameSessions_Students FOREIGN KEY (student_id) 
        REFERENCES Students(student_id),
    CONSTRAINT FK_GameSessions_Games FOREIGN KEY (game_id) 
        REFERENCES E_Sports_Games(game_id),
        
    CONSTRAINT CHK_GameSessions_Score CHECK (raw_score >= 0),
    CONSTRAINT CHK_GameSessions_Status CHECK (status IN ('PROCESSED', 'REJECTED_SUSPICIOUS'))
);


CREATE TABLE Wallet_Ledger (
    transaction_id INT IDENTITY(1,1) PRIMARY KEY,
    student_id INT NOT NULL,
    transaction_type VARCHAR(30) NOT NULL,
    amount DECIMAL(10,2) NOT NULL, 
    transaction_timestamp DATETIME NOT NULL DEFAULT GETDATE(),
    
    game_session_id INT NULL,
    cafeteria_order_id INT NULL,
    bookshop_order_id INT NULL,
    
    CONSTRAINT FK_WalletLedger_Students FOREIGN KEY (student_id) 
        REFERENCES Students(student_id),
    CONSTRAINT FK_WalletLedger_GameSessions FOREIGN KEY (game_session_id) 
        REFERENCES Game_Sessions(session_id),
    CONSTRAINT FK_WalletLedger_Cafeteria FOREIGN KEY (cafeteria_order_id) 
        REFERENCES Cafeteria_Orders(order_id),
        
    CONSTRAINT CHK_WalletLedger_Amount CHECK (amount <> 0), 
    CONSTRAINT CHK_WalletLedger_Type CHECK (transaction_type IN ('GAME_EARNING', 'CAFETERIA_SPEND', 'BOOKSHOP_SPEND', 'MANUAL_ADJUSTMENT'))
);


CREATE TABLE Bookshop_Items (
    item_id INT IDENTITY(1,1) PRIMARY KEY,
    item_name VARCHAR(150) NOT NULL,
    item_category VARCHAR(50) NOT NULL,
    isbn VARCHAR(20) NULL,
    author VARCHAR(100) NULL,
    price DECIMAL(10,2) NOT NULL,
    stock_quantity INT NOT NULL DEFAULT 0,
    is_active BIT NOT NULL DEFAULT 1,
    
    CONSTRAINT CHK_Bookshop_Category CHECK (item_category IN ('TEXTBOOK', 'STATIONERY', 'ELECTRONICS', 'MERCHANDISE', 'OTHER')),
    
    CONSTRAINT CHK_Bookshop_Price CHECK (price > 0),
    CONSTRAINT CHK_Bookshop_Stock CHECK (stock_quantity >= 0)
);

CREATE TABLE Bookshop_Orders (
    order_id INT IDENTITY(1,1) PRIMARY KEY,
    receipt_number VARCHAR(50) NOT NULL UNIQUE,
    student_id INT NOT NULL,
    order_timestamp DATETIME NOT NULL DEFAULT GETDATE(),
    total_amount DECIMAL(10,2) NOT NULL,
    status VARCHAR(20) NOT NULL DEFAULT 'COMPLETED',
    
    CONSTRAINT FK_BookshopOrders_Students FOREIGN KEY (student_id) 
        REFERENCES Students(student_id),
        
    CONSTRAINT CHK_Bookshop_TotalAmount CHECK (total_amount >= 0),
    CONSTRAINT CHK_Bookshop_Status CHECK (status IN ('PENDING', 'COMPLETED', 'FAILED'))
);


CREATE TABLE Bookshop_Order_Details (
    order_id INT NOT NULL,
    item_id INT NOT NULL,
    quantity_purchased INT NOT NULL,
    unit_price_at_purchase DECIMAL(10,2) NOT NULL,
    
    PRIMARY KEY (order_id, item_id),
    
    CONSTRAINT FK_BookshopOrderDetails_Orders FOREIGN KEY (order_id) 
        REFERENCES Bookshop_Orders(order_id),
    CONSTRAINT FK_BookshopOrderDetails_Items FOREIGN KEY (item_id) 
        REFERENCES Bookshop_Items(item_id),
        
    CONSTRAINT CHK_Bookshop_Quantity CHECK (quantity_purchased > 0)
);

ALTER TABLE Wallet_Ledger
ADD CONSTRAINT FK_WalletLedger_Bookshop FOREIGN KEY (bookshop_order_id) 
    REFERENCES Bookshop_Orders(order_id);


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


-- ==============================================================================
-- FAST CAMPUSVERSE: PHASE 2 QUERIES
-- 15 Functionalities covering all advanced SQL concepts
-- ==============================================================================

-- ==============================================================================
-- Q1. ONBOARDING A NEW STUDENT
-- Functionality: Register a new student into the system.
-- Concepts Covered: INSERT
-- ==============================================================================
INSERT INTO Students (roll_number, password_hash, full_name, current_balance) 
VALUES ('25L-5000', 'new_hash_xyz', 'Saad Qureshi', 0.00);
select * from Students;

-- ==============================================================================
-- Q2. PRICE INFLATION ADJUSTMENT
-- Functionality: Increase the price of Karak Chai due to inflation.
-- Concepts Covered: UPDATE, WHERE
-- ==============================================================================
UPDATE Cafeteria_Items 
SET price = 100.00 
WHERE item_name = 'Karak Chai';
select * from "Cafeteria_Items";

-- ==============================================================================
-- Q3. FRAUD PREVENTION CLEANUP
-- Functionality: Delete any game sessions that were flagged as suspicious/cheating.
-- Concepts Covered: DELETE, WHERE
-- ==============================================================================
DELETE FROM Game_Sessions 
WHERE status = 'REJECTED_SUSPICIOUS';

-- ==============================================================================
-- Q4. STUDENT DIRECTORY SEARCH
-- Functionality: Find all students whose names start with 'A' (e.g., Ahsan, Ayesha).
-- Concepts Covered: SELECT, WHERE, LIKE
-- ==============================================================================
SELECT student_id, roll_number, full_name, current_balance
FROM Students
WHERE full_name LIKE 'A%';

-- ==============================================================================
-- Q5. BOOKSHOP REVENUE CALCULATION
-- Functionality: Calculate the total revenue ever generated by the Bookshop.
-- Concepts Covered: SELECT, SUM
-- ==============================================================================
SELECT SUM(total_amount) AS total_bookshop_revenue
FROM Bookshop_Orders
WHERE status = 'COMPLETED';

-- ==============================================================================
-- Q6. E-SPORTS GAME PERFORMANCE
-- Functionality: Find the average cash earned by students per game, ranked highest to lowest.
-- Concepts Covered: AVG, GROUP BY, ORDER BY, INNER JOIN
-- ==============================================================================
SELECT 
    g.game_name, 
    AVG(gs.cash_earned) AS average_cash_payout
FROM E_Sports_Games g
JOIN Game_Sessions gs ON g.game_id = gs.game_id
GROUP BY g.game_name
ORDER BY average_cash_payout DESC;

-- ==============================================================================
-- Q7. CAFETERIA VIP SPENDERS
-- Functionality: Identify students who have spent strictly more than 400 total in the cafeteria.
-- Concepts Covered: SUM, GROUP BY, HAVING, INNER JOIN
-- ==============================================================================
SELECT 
    s.full_name, 
    SUM(co.total_amount) AS total_spent
FROM Students s
JOIN Cafeteria_Orders co ON s.student_id = co.student_id
GROUP BY s.full_name
HAVING SUM(co.total_amount) > 400.00;

-- ==============================================================================
-- Q8. STUDENT GAMING ENGAGEMENT
-- Functionality: List all students and their game sessions. Must include students who haven't played yet.
-- Concepts Covered: LEFT JOIN, ORDER BY
-- ==============================================================================
SELECT 
    s.full_name, 
    gs.raw_score, 
    gs.cash_earned
FROM Students s
LEFT JOIN Game_Sessions gs ON s.student_id = gs.student_id
ORDER BY s.full_name ASC;

-- ==============================================================================
-- Q9. CAFETERIA INVENTORY POPULARITY
-- Functionality: List all cafeteria items and their order quantities. Must include items never ordered (e.g., Samosa).
-- Concepts Covered: RIGHT JOIN
-- ==============================================================================
SELECT 
    ci.item_name, 
    cod.quantity_purchased
FROM Cafeteria_Order_Details cod
RIGHT JOIN Cafeteria_Items ci ON cod.item_id = ci.item_id;

-- ==============================================================================
-- Q10. COMPLETE LEDGER AUDIT
-- Functionality: Show a full alignment of students and their wallet ledger entries. Includes students with no entries, and potential ledger anomalies.
-- Concepts Covered: FULL OUTER JOIN
-- ==============================================================================
SELECT 
    s.full_name, 
    wl.transaction_type, 
    wl.amount
FROM Students s
FULL OUTER JOIN Wallet_Ledger wl ON s.student_id = wl.student_id;

-- ==============================================================================
-- Q11. THE RICHEST STUDENT
-- Functionality: Find the profile of the student who currently has the absolute highest balance.
-- Concepts Covered: Sub/Nested Query
-- ==============================================================================
SELECT roll_number, full_name, current_balance 
FROM Students 
WHERE current_balance = (
    SELECT MAX(current_balance) 
    FROM Students
);

-- ==============================================================================
-- Q12. CROSS-MODULE ENGAGEMENT (GAMERS WHO EAT)
-- Functionality: Find the roll numbers of students who BOTH play E-Sports AND buy food from the Cafeteria.
-- Concepts Covered: INTERSECT
-- ==============================================================================
SELECT student_id FROM Game_Sessions
INTERSECT
SELECT student_id FROM Cafeteria_Orders;

-- ==============================================================================
-- Q13. THE NERD DEMOGRAPHIC (STUDY, NO GAMES)
-- Functionality: Find the roll numbers of students who buy from the Bookshop but have NEVER played an E-Sports game.
-- Concepts Covered: EXCEPT
-- ==============================================================================
SELECT student_id FROM Bookshop_Orders
EXCEPT
SELECT student_id FROM Game_Sessions;

-- ==============================================================================
-- Q14. UNIFIED CAMPUS INVENTORY
-- Functionality: Generate a single master catalog list combining items from both the Cafeteria and the Bookshop.
-- Concepts Covered: UNION
-- ==============================================================================
SELECT item_name AS 'Item Name', category AS 'Department', price 
FROM Cafeteria_Items
UNION
SELECT item_name, item_category, price 
FROM Bookshop_Items;

-- ==============================================================================
-- Q15. THE WHALE GAMER ANALYSIS (COMPLEX QUERY)
-- Functionality: Find high-performing gamers whose personal average game earnings are strictly higher than the overall university's average game earnings.
-- Concepts Covered: Nested Subqueries, Aggregation, INNER JOIN
-- ==============================================================================
SELECT 
    s.full_name, 
    AVG(gs.cash_earned) AS student_avg_earnings
FROM Students s
JOIN Game_Sessions gs ON s.student_id = gs.student_id
GROUP BY s.full_name
HAVING AVG(gs.cash_earned) > (
    SELECT AVG(cash_earned) 
    FROM Game_Sessions
);





