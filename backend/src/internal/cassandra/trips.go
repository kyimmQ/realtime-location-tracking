package cassandra

import (
	"errors"
	"log"
	"math"
	"time"

	"github.com/gocql/gocql"
)

// Haversine formula to calculate the distance between two points in kilometers
func haversine(lat1, lon1, lat2, lon2 float64) float64 {
	const R = 6371 // Earth radius in kilometers

	dLat := (lat2 - lat1) * math.Pi / 180.0
	dLon := (lon2 - lon1) * math.Pi / 180.0

	lat1 = lat1 * math.Pi / 180.0
	lat2 = lat2 * math.Pi / 180.0

	a := math.Sin(dLat/2)*math.Sin(dLat/2) +
		math.Sin(dLon/2)*math.Sin(dLon/2)*math.Cos(lat1)*math.Cos(lat2)
	c := 2 * math.Atan2(math.Sqrt(a), math.Sqrt(1-a))

	return R * c
}

func CalculateTripDistance(points []TripPoint) float64 {
	totalKm := 0.0
	for i := 1; i < len(points); i++ {
		dist := haversine(
			points[i-1].Latitude, points[i-1].Longitude,
			points[i].Latitude, points[i].Longitude,
		)
		totalKm += dist
	}
	return totalKm
}

type TripPoint struct {
	Timestamp time.Time `json:"timestamp"`
	Latitude  float64   `json:"latitude"`
	Longitude float64   `json:"longitude"`
	Speed     float64   `json:"speed"`
	Heading   float64   `json:"heading"`
}

type TripMetadata struct {
	TripID             string    `json:"trip_id"`
	DriverID           string    `json:"driver_id"`
	OrderID            string    `json:"order_id"`
	StartTime          time.Time `json:"start_time"`
	EndTime            time.Time `json:"end_time"`
	StartLocation      string    `json:"start_location"`
	Destination        string    `json:"destination"`
	TotalDistance      float64   `json:"total_distance"`
	TotalDuration      int       `json:"total_duration"`
	AverageSpeed       float64   `json:"average_speed"`
	MaxSpeed           float64   `json:"max_speed"`
	SpeedingViolations int       `json:"speeding_violations"`
	TripCost           float64   `json:"trip_cost"`
	Status             string    `json:"status"`
}

type TripSummary struct {
	TripID string `json:"trip_id"`
	Status string `json:"status"`
}

func (c *Client) ListTrips(limit int) ([]TripSummary, error) {
	if limit <= 0 {
		limit = 100
	}

	session := c.GetSession()
	query := `SELECT trip_id, status FROM trip_metadata LIMIT ?`
	rows := session.Query(query, limit).Iter()

	var trips []TripSummary
	var tripUUID gocql.UUID
	var status string
	for rows.Scan(&tripUUID, &status) {
		trips = append(trips, TripSummary{
			TripID: tripUUID.String(),
			Status: status,
		})
	}

	if err := rows.Close(); err != nil {
		log.Printf("Error listing trips: %v", err)
		return nil, err
	}
	return trips, nil
}

func (c *Client) EnsureTripMetadata(tripID, driverID, orderID, startLocation, destination string, startTime time.Time) error {
	session := c.GetSession()

	tripUUID, err := gocql.ParseUUID(tripID)
	if err != nil {
		return err
	}
	orderUUID, err := gocql.ParseUUID(orderID)
	if err != nil {
		return err
	}

	query := `INSERT INTO trip_metadata (
		trip_id, driver_id, order_id, start_time, start_location, destination, status
	) VALUES (?, ?, ?, ?, ?, ?, ?) IF NOT EXISTS`
	return session.Query(query,
		tripUUID,
		driverID,
		orderUUID,
		startTime,
		startLocation,
		destination,
		"ACTIVE",
	).Exec()
}

func (c *Client) SaveTripLocation(tripID, driverID, orderID string, timestamp time.Time, latitude, longitude, speed, heading, accuracy float64) error {
	session := c.GetSession()

	tripUUID, err := gocql.ParseUUID(tripID)
	if err != nil {
		return err
	}
	orderUUID, err := gocql.ParseUUID(orderID)
	if err != nil {
		return err
	}

	query := `INSERT INTO trip_locations (
		trip_id, timestamp, driver_id, order_id, latitude, longitude, speed, heading, accuracy
	) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)`
	return session.Query(query,
		tripUUID,
		timestamp,
		driverID,
		orderUUID,
		latitude,
		longitude,
		speed,
		heading,
		accuracy,
	).Exec()
}

func (c *Client) MarkTripCompleted(tripID string, endTime time.Time) error {
	session := c.GetSession()

	tripUUID, err := gocql.ParseUUID(tripID)
	if err != nil {
		return err
	}

	query := `UPDATE trip_metadata SET end_time = ?, status = 'COMPLETED' WHERE trip_id = ?`
	return session.Query(query, endTime, tripUUID).Exec()
}

// Get full GPS trace for a trip, ordered ascending for playback
func (c *Client) GetTripRoute(tripID string) ([]TripPoint, error) {
	session := c.GetSession()
	query := `SELECT timestamp, latitude, longitude, speed, heading
			  FROM trip_locations
			  WHERE trip_id = ? ORDER BY timestamp ASC`
	rows := session.Query(query, tripID).Iter()

	var points []TripPoint
	var p TripPoint
	for rows.Scan(&p.Timestamp, &p.Latitude, &p.Longitude, &p.Speed, &p.Heading) {
		points = append(points, p)
	}

	if err := rows.Close(); err != nil {
		log.Printf("Error fetching trip route: %v", err)
		return nil, err
	}
	return points, nil
}

func (c *Client) GetTripMetadata(tripID string) (*TripMetadata, error) {
	session := c.GetSession()
	query := `SELECT trip_id, driver_id, order_id, start_time, end_time, start_location, destination,
			  total_distance, total_duration, average_speed, max_speed, speeding_violations, trip_cost, status
			  FROM trip_metadata WHERE trip_id = ?`

	var meta TripMetadata
	err := session.Query(query, tripID).Scan(
		&meta.TripID, &meta.DriverID, &meta.OrderID, &meta.StartTime, &meta.EndTime,
		&meta.StartLocation, &meta.Destination, &meta.TotalDistance, &meta.TotalDuration,
		&meta.AverageSpeed, &meta.MaxSpeed, &meta.SpeedingViolations, &meta.TripCost, &meta.Status,
	)

	if err != nil {
		log.Printf("Error fetching trip metadata: %v", err)
		return nil, err
	}
	return &meta, nil
}

func (c *Client) GetTripIDByOrderID(orderID string) (string, error) {
	session := c.GetSession()
	query := `SELECT trip_id FROM trip_metadata WHERE order_id = ?`

	var tripID string
	err := session.Query(query, orderID).Scan(&tripID)
	if err != nil {
		log.Printf("Error fetching trip_id by order_id: %v", err)
		return "", err
	}
	return tripID, nil
}

// CompleteTrip finalizes a trip by calculating statistics and updating analytics
func (c *Client) CompleteTrip(tripID string) error {
	session := c.GetSession()

	// 1. Get all points for the trip directly from trip_locations
	query := `SELECT timestamp, latitude, longitude, speed, heading
			  FROM trip_locations
			  WHERE trip_id = ? ORDER BY timestamp ASC`
	rows := session.Query(query, tripID).Iter()

	var points []TripPoint
	var p TripPoint
	for rows.Scan(&p.Timestamp, &p.Latitude, &p.Longitude, &p.Speed, &p.Heading) {
		points = append(points, p)
	}

	if err := rows.Close(); err != nil {
		log.Printf("Error fetching trip route in CompleteTrip: %v", err)
		return err
	}

	if len(points) == 0 {
		return errors.New("no GPS points for trip")
	}

	// 2. Calculate statistics
	startTime := points[0].Timestamp
	endTime := points[len(points)-1].Timestamp
	durationSec := int(endTime.Sub(startTime).Seconds())
	totalDistance := CalculateTripDistance(points)

	var maxSpeed, totalSpeed float64
	speedingViolations := 0
	for _, p := range points {
		if p.Speed > maxSpeed {
			maxSpeed = p.Speed
		}
		if p.Speed > 60 {
			speedingViolations++
		}
		totalSpeed += p.Speed
	}

	avgSpeed := 0.0
	if len(points) > 0 {
		avgSpeed = totalSpeed / float64(len(points))
	}

	// 3. Pricing formula
	const baseFare = 3.00
	const distanceRate = 0.50 // per km
	const timeRate = 0.10     // per minute
	durationMin := float64(durationSec) / 60.0
	tripCost := baseFare + (distanceRate * totalDistance) + (timeRate * durationMin)
	tripCost = math.Round(tripCost*100) / 100 // round to 2dp

	// 4. Update trip_metadata
	updateQuery := `UPDATE trip_metadata SET
        end_time = ?,
        total_distance = ?,
        total_duration = ?,
        average_speed = ?,
        max_speed = ?,
        speeding_violations = ?,
        trip_cost = ?,
        status = 'COMPLETED'
        WHERE trip_id = ?`

	err := session.Query(updateQuery,
		endTime, totalDistance, durationSec, avgSpeed,
		maxSpeed, speedingViolations, tripCost, tripID,
	).Exec()

	if err != nil {
		log.Printf("Error updating trip metadata: %v", err)
		return err
	}

	// 5. Update driver analytics (weekly aggregation)
	if err := c.UpdateDriverAnalyticsFromTrip(tripID, totalDistance, avgSpeed, speedingViolations); err != nil {
		log.Printf("Warning: Error updating driver analytics: %v", err)
		// Don't fail the whole operation for analytics update failure
	}

	return nil
}

// UpdateDriverAnalyticsFromTrip aggregates trip stats into driver_analytics table
func (c *Client) UpdateDriverAnalyticsFromTrip(tripID string, totalDistance, avgSpeed float64, speedingViolations int) error {
	session := c.GetSession()

	// Get driver_id from trip_metadata
	var driverID string
	err := session.Query(`SELECT driver_id FROM trip_metadata WHERE trip_id = ?`, tripID).Scan(&driverID)
	if err != nil {
		return err
	}

	// Calculate week start (Monday)
	now := time.Now()
	weekStart := now.AddDate(0, 0, -int(now.Weekday())).Truncate(24 * time.Hour)
	weekStartStr := weekStart.Format("2006-01-02")

	// Try to update existing week, or insert new
	updateQuery := `INSERT INTO driver_analytics (driver_id, week_start_date, total_trips, total_distance, total_duration, average_speed, speeding_violations, idle_time)
	VALUES (?, ?, 1, ?, 0, ?, ?, 0)
	ON CONFLICT (driver_id, week_start_date)
	DO UPDATE SET
		total_trips = driver_analytics.total_trips + 1,
		total_distance = driver_analytics.total_distance + ?,
		average_speed = (driver_analytics.average_speed * driver_analytics.total_trips + ?) / (driver_analytics.total_trips + 1),
		speeding_violations = driver_analytics.speeding_violations + ?`

	err = session.Query(updateQuery, driverID, weekStartStr,
		totalDistance, avgSpeed, speedingViolations,
		totalDistance, avgSpeed, speedingViolations,
	).Exec()

	return err
}
