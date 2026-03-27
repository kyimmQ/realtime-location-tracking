package cassandra

import (
	"log"
	"time"
)

type DriverWeekStats struct {
	WeekStart          time.Time `json:"week_start_date"`
	TotalTrips         int       `json:"total_trips"`
	TotalDistance      float64   `json:"total_distance"`
	AverageSpeed       float64   `json:"average_speed"`
	SpeedingViolations int       `json:"speeding_violations"`
}

type Alert struct {
	ID        string            `json:"alert_id"`
	Type      string            `json:"alert_type"`
	Severity  string            `json:"severity"`
	Message   string            `json:"message"`
	Timestamp time.Time         `json:"timestamp"`
	Metadata  map[string]string `json:"metadata"`
}

// Get weekly driver analytics
func (c *Client) GetDriverAnalytics(driverID string) ([]DriverWeekStats, error) {
	session := c.GetSession()

	// Default to last 52 weeks (approx 1 year)
	oneYearAgo := time.Now().AddDate(-1, 0, 0).Format("2006-01-02")

	query := `SELECT week_start_date, total_trips, total_distance, average_speed, speeding_violations
			  FROM driver_analytics
			  WHERE driver_id = ? AND week_start_date >= ?
			  ORDER BY week_start_date DESC`
	rows := session.Query(query, driverID, oneYearAgo).Iter()

	var stats []DriverWeekStats
	var s DriverWeekStats
	for rows.Scan(&s.WeekStart, &s.TotalTrips, &s.TotalDistance, &s.AverageSpeed, &s.SpeedingViolations) {
		stats = append(stats, s)
	}

	if err := rows.Close(); err != nil {
		log.Printf("Error fetching driver analytics: %v", err)
		return nil, err
	}
	return stats, nil
}

// Get recent alerts for a driver
func (c *Client) GetDriverAlerts(driverID string, since time.Time) ([]Alert, error) {
	session := c.GetSession()
	query := `SELECT alert_id, alert_type, severity, message, timestamp, metadata
			  FROM alerts
			  WHERE driver_id = ? AND timestamp >= ?
			  ORDER BY timestamp DESC LIMIT 100`
	rows := session.Query(query, driverID, since).Iter()

	var alerts []Alert
	var a Alert
	for rows.Scan(&a.ID, &a.Type, &a.Severity, &a.Message, &a.Timestamp, &a.Metadata) {
		alerts = append(alerts, a)
	}

	if err := rows.Close(); err != nil {
		log.Printf("Error fetching driver alerts: %v", err)
		return nil, err
	}
	return alerts, nil
}
