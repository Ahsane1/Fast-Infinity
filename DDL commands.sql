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