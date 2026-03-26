package model

import "time"

type LocationEvent struct {
    DriverID  string    `json:"driver_id"`
    TripID    string    `json:"trip_id"`
    OrderID   string    `json:"order_id"`
    Latitude  float64   `json:"latitude"`
    Longitude float64   `json:"longitude"`
    Timestamp time.Time `json:"timestamp"`
}
