package cassandra

import (
	"github.com/mmcloughlin/geohash"
	"log"
	"time"
)

type HeatmapCell struct {
	GeoHash       string `json:"geohash"`
	DeliveryCount int    `json:"delivery_count"`
}

// Get delivery density by geo-hash cells
// Note: Since standard Cassandra doesn't support grouping by geohash UDF natively without
// plugins/extensions, we fetch the locations in the time window and aggregate them in Go.
func (c *Client) GetHeatmapData(since, until time.Time) ([]HeatmapCell, error) {
	session := c.GetSession()
	// NOTE: querying over a timestamp without a partition key requires ALLOW FILTERING
	// in Cassandra. In a real production scenario, this table should be partitioned by
	// time bucket (e.g., date) to avoid expensive full cluster scans.
	query := `SELECT latitude, longitude
			  FROM trip_locations
			  WHERE timestamp >= ? AND timestamp < ? ALLOW FILTERING`
	rows := session.Query(query, since, until).Iter()

	counts := make(map[string]int)
	var lat, lon float64
	for rows.Scan(&lat, &lon) {
		// Calculate geohash with precision 5
		hash := geohash.EncodeWithPrecision(lat, lon, 5)
		counts[hash]++
	}

	if err := rows.Close(); err != nil {
		log.Printf("Error fetching heatmap data: %v", err)
		return nil, err
	}

	var cells []HeatmapCell
	for hash, count := range counts {
		cells = append(cells, HeatmapCell{
			GeoHash:       hash,
			DeliveryCount: count,
		})
	}
	return cells, nil
}
