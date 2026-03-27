package cassandra

import (
	"log"
	"time"
)

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
