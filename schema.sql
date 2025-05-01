CREATE SCHEMA IF NOT EXISTS public;


CREATE TABLE public.users (
    id SERIAL PRIMARY KEY,
    username VARCHAR(50) NOT NULL UNIQUE,
    password VARCHAR(255) NOT NULL,
    role VARCHAR(20) NOT NULL,
    CONSTRAINT users_role_check CHECK (role IN ('admin', 'staff'))
);


CREATE TABLE public.tables (
    id SERIAL PRIMARY KEY,
    table_number INTEGER NOT NULL UNIQUE,
    qr_token UUID
);


CREATE TABLE public.menu_items (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    description TEXT,
    category VARCHAR(50),
    image VARCHAR(255) DEFAULT ''
);


CREATE TABLE public.meat_options (
    id SERIAL PRIMARY KEY,
    name VARCHAR(50) NOT NULL UNIQUE,
    price_adjustment NUMERIC(10,2) DEFAULT 0.00
);


CREATE TABLE public.menu_item_meat_options (
    menu_item_id INTEGER NOT NULL,
    meat_option_id INTEGER NOT NULL,
    PRIMARY KEY (menu_item_id, meat_option_id),
    FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id),
    FOREIGN KEY (meat_option_id) REFERENCES public.meat_options(id)
);


CREATE TABLE public.orders (
    id SERIAL PRIMARY KEY,
    table_id INTEGER NOT NULL,
    user_id INTEGER,
    items JSONB,
    notes TEXT,
    status VARCHAR(20) NOT NULL,
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    order_type VARCHAR(50),
    staff_name VARCHAR(255),
    payment_method VARCHAR(100),
    completed_at TIMESTAMP,
    CONSTRAINT orders_status_check CHECK (status IN ('New', 'Confirmed', 'Paid', 'Cancelled')),
    FOREIGN KEY (table_id) REFERENCES public.tables(id),
    FOREIGN KEY (user_id) REFERENCES public.users(id)
);


CREATE TABLE public.order_items (
    id SERIAL PRIMARY KEY,
    order_id INTEGER NOT NULL,
    menu_item_id INTEGER NOT NULL,
    count INTEGER NOT NULL,
    price NUMERIC(10,2) NOT NULL,
    options JSONB,
    FOREIGN KEY (order_id) REFERENCES public.orders(id),
    FOREIGN KEY (menu_item_id) REFERENCES public.menu_items(id)
);


CREATE TABLE public.orderhistory (
    id INTEGER PRIMARY KEY,
    table_id INTEGER NOT NULL,
    user_id INTEGER,
    items JSONB,
    notes TEXT,
    status VARCHAR(20),
    created_at TIMESTAMP DEFAULT CURRENT_TIMESTAMP,
    order_type VARCHAR(50),
    staff_name VARCHAR(255),
    payment_method VARCHAR(100),
    completed_at TIMESTAMP,
    CONSTRAINT orderhistory_status_check CHECK (status IN ('Pending', 'Confirmed', 'Paid', 'Cancelled')),
    FOREIGN KEY (table_id) REFERENCES public.tables(id),
    FOREIGN KEY (user_id) REFERENCES public.users(id)
);


CREATE TABLE public.charges (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    rate DOUBLE PRECISION NOT NULL,
    enabled BOOLEAN DEFAULT true
);


CREATE TABLE public.discounts (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    rate DOUBLE PRECISION NOT NULL,
    enabled BOOLEAN DEFAULT true
);


CREATE TABLE public.employees (
    id SERIAL PRIMARY KEY,
    name VARCHAR(255) NOT NULL,
    employee_id VARCHAR(50) NOT NULL UNIQUE,
    "position" VARCHAR(100),
    shift VARCHAR(100),
    email VARCHAR(255),
    phone VARCHAR(20),
    pin_code VARCHAR(20),
    status VARCHAR(20),
    start_date DATE,
    date_of_birth DATE,
    id_card_number VARCHAR(50),
    gender VARCHAR(20),
    profile_image TEXT
);


CREATE TABLE public.payment_options (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    enabled BOOLEAN DEFAULT true,
    show_image_in_invoice BOOLEAN DEFAULT false,
    image TEXT
);


CREATE TABLE public.taxes (
    id SERIAL PRIMARY KEY,
    name VARCHAR(100) NOT NULL,
    rate DOUBLE PRECISION NOT NULL,
    enabled BOOLEAN DEFAULT true
);


CREATE OR REPLACE FUNCTION public.sync_orders_to_history() RETURNS TRIGGER
    LANGUAGE plpgsql
    AS $$
BEGIN
    INSERT INTO orderhistory (
        id, table_id, user_id, items, notes, status, created_at,
        order_type, staff_name, payment_method, completed_at
    )
    VALUES (
        NEW.id, NEW.table_id, NEW.user_id, NEW.items, NEW.notes, NEW.status, NEW.created_at,
        NEW.order_type, NEW.staff_name, NEW.payment_method, NEW.completed_at
    )
    ON CONFLICT (id) DO UPDATE SET
        table_id = EXCLUDED.table_id,
        user_id = EXCLUDED.user_id,
        items = EXCLUDED.items,
        notes = EXCLUDED.notes,
        status = EXCLUDED.status,
        created_at = EXCLUDED.created_at,
        order_type = EXCLUDED.order_type,
        staff_name = EXCLUDED.staff_name,
        payment_method = EXCLUDED.payment_method,
        completed_at = EXCLUDED.completed_at;
    RETURN NEW;
END;
$$;


CREATE TRIGGER orders_sync_trigger
    AFTER INSERT OR UPDATE ON public.orders
    FOR EACH ROW EXECUTE FUNCTION public.sync_orders_to_history();