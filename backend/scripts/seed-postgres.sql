-- Pre-computed bcrypt hash for "demo123" (cost 10)
-- $2a$10$eqx468juSq/gmQt4vlC8ZOul1wafXUV5T8FpmiONFfnPIXNYnfLVK

-- Admin user
INSERT INTO users (id, email, password_hash, role, name, phone)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'admin@demo.com',
    '$2a$10$eqx468juSq/gmQt4vlC8ZOul1wafXUV5T8FpmiONFfnPIXNYnfLVK',
    'ADMIN',
    'Admin User',
    '+1234567001'
);

-- Customers
INSERT INTO users (id, email, password_hash, role, name, phone)
VALUES
    (
        'c0000000-0000-0000-0000-000000000001',
        'user1@demo.com',
        '$2a$10$eqx468juSq/gmQt4vlC8ZOul1wafXUV5T8FpmiONFfnPIXNYnfLVK',
        'USER',
        'Alice Johnson',
        '+1234567002'
    ),
    (
        'c0000000-0000-0000-0000-000000000002',
        'user2@demo.com',
        '$2a$10$eqx468juSq/gmQt4vlC8ZOul1wafXUV5T8FpmiONFfnPIXNYnfLVK',
        'USER',
        'Bob Smith',
        '+1234567003'
    ),
    (
        'c0000000-0000-0000-0000-000000000003',
        'user3@demo.com',
        '$2a$10$eqx468juSq/gmQt4vlC8ZOul1wafXUV5T8FpmiONFfnPIXNYnfLVK',
        'USER',
        'Carol Davis',
        '+1234567004'
    );

-- Drivers
INSERT INTO users (id, email, password_hash, role, name, phone)
VALUES
    (
        'd0000000-0000-0000-0000-000000000001',
        'driver1@demo.com',
        '$2a$10$eqx468juSq/gmQt4vlC8ZOul1wafXUV5T8FpmiONFfnPIXNYnfLVK',
        'DRIVER',
        'Dave Driver',
        '+1234567010'
    ),
    (
        'd0000000-0000-0000-0000-000000000002',
        'driver2@demo.com',
        '$2a$10$eqx468juSq/gmQt4vlC8ZOul1wafXUV5T8FpmiONFfnPIXNYnfLVK',
        'DRIVER',
        'Emma Rider',
        '+1234567011'
    ),
    (
        'd0000000-0000-0000-0000-000000000003',
        'driver3@demo.com',
        '$2a$10$eqx468juSq/gmQt4vlC8ZOul1wafXUV5T8FpmiONFfnPIXNYnfLVK',
        'DRIVER',
        'Frank Couriers',
        '+1234567012'
    );

-- Driver profiles
INSERT INTO driver_profiles (user_id, license_number, vehicle_type, status)
VALUES
    ('d0000000-0000-0000-0000-000000000001', 'DL-001-ABCD', 'motorcycle', 'AVAILABLE'),
    ('d0000000-0000-0000-0000-000000000002', 'DL-002-EFGH', 'car',         'AVAILABLE'),
    ('d0000000-0000-0000-0000-000000000003', 'DL-003-IJKL', 'van',         'OFFLINE');

-- Orders (in different states)

-- Order 1: PENDING – no driver assigned yet
INSERT INTO orders (id, user_id, driver_id, gpx_file, status, restaurant_location, delivery_location, route_points)
VALUES (
    'a0000000-0000-0000-0000-000000000001',
    'c0000000-0000-0000-0000-000000000001',
    NULL,
    '/gpx/order001.gpx',
    'PENDING',
    '123 Restaurant St, City A',
    '456 Customer Ave, City A',
    '[]'::jsonb
);

-- Order 2: IN_PROGRESS – driver assigned, route underway
INSERT INTO orders (id, user_id, driver_id, gpx_file, status, restaurant_location, delivery_location, route_points)
VALUES (
    'b0000000-0000-0000-0000-000000000002',
    'c0000000-0000-0000-0000-000000000002',
    'd0000000-0000-0000-0000-000000000001',
    '/gpx/order002.gpx',
    'IN_PROGRESS',
    '789 Pizza Place, City B',
    '101 Client Blvd, City B',
    '[{"lat": 40.7128, "lon": -74.0060}, {"lat": 40.7148, "lon": -74.0080}, {"lat": 40.7168, "lon": -74.0100}]'::jsonb
);
