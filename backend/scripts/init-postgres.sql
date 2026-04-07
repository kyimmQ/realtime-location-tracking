CREATE TABLE IF NOT EXISTS users (
    id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    email           VARCHAR(255) UNIQUE NOT NULL,
    password_hash   VARCHAR(255) NOT NULL,
    role            VARCHAR(20) NOT NULL CHECK (role IN ('USER', 'DRIVER', 'ADMIN')),
    name            VARCHAR(255) NOT NULL,
    phone           VARCHAR(50),
    created_at      TIMESTAMP DEFAULT NOW()
);

CREATE TABLE IF NOT EXISTS driver_profiles (
    user_id         UUID PRIMARY KEY REFERENCES users(id),
    license_number  VARCHAR(100),
    vehicle_type    VARCHAR(50),
    status          VARCHAR(20) DEFAULT 'AVAILABLE' CHECK (status IN ('AVAILABLE', 'BUSY', 'OFFLINE'))
);

CREATE TABLE IF NOT EXISTS orders (
    id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
    user_id               UUID REFERENCES users(id),
    driver_id             UUID REFERENCES users(id),
    gpx_file              VARCHAR(255),
    status                VARCHAR(50) DEFAULT 'PENDING',
    restaurant_location   VARCHAR(255),
    delivery_location     VARCHAR(255),
    route_points          JSONB,
    created_at            TIMESTAMP DEFAULT NOW(),
    updated_at            TIMESTAMP DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_orders_user    ON orders(user_id);
CREATE INDEX IF NOT EXISTS idx_orders_driver  ON orders(driver_id);
CREATE INDEX IF NOT EXISTS idx_orders_status ON orders(status);
CREATE INDEX IF NOT EXISTS idx_driver_profiles_status ON driver_profiles(status);
