package postgres

import "time"

// Role represents the set of user roles stored in the users table.
type Role string

const (
	RoleUser   Role = "USER"
	RoleDriver Role = "DRIVER"
	RoleAdmin  Role = "ADMIN"
)

// DriverStatus maps to the status CHECK constraint on driver_profiles.
type DriverStatus string

const (
	DriverStatusAvailable DriverStatus = "AVAILABLE"
	DriverStatusBusy      DriverStatus = "BUSY"
	DriverStatusOffline   DriverStatus = "OFFLINE"
)

// User mirrors the users table.
type User struct {
	ID           string    `json:"id"`
	Email        string    `json:"email"`
	PasswordHash string    `json:"-"`
	Role         Role      `json:"role"`
	Name         string    `json:"name"`
	Phone        string    `json:"phone,omitempty"`
	CreatedAt    time.Time `json:"created_at"`
}

// DriverProfile mirrors the driver_profiles table.
type DriverProfile struct {
	UserID        string       `json:"user_id"`
	LicenseNumber string       `json:"license_number,omitempty"`
	VehicleType   string       `json:"vehicle_type,omitempty"`
	Status        DriverStatus `json:"status"`
}

// Order mirrors the orders table. RoutePoints is stored as raw JSON in the DB (JSONB).
type Order struct {
	ID                 string          `json:"id"`
	UserID             string          `json:"user_id"`
	DriverID           string          `json:"driver_id,omitempty"`
	GPXFile            string          `json:"gpx_file,omitempty"`
	Status             string          `json:"status"`
	RestaurantLocation string          `json:"restaurant_location,omitempty"`
	DeliveryLocation   string          `json:"delivery_location,omitempty"`
	RoutePoints        []RoutePoint    `json:"route_points,omitempty"`
	CreatedAt          time.Time       `json:"created_at"`
	UpdatedAt          time.Time       `json:"updated_at"`
}

// RoutePoint represents a single coordinate in the route_points JSONB array.
type RoutePoint struct {
	Lat float64 `json:"lat"`
	Lon float64 `json:"lon"`
}
