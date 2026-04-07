package gpx

import (
	"encoding/json"
	"math/rand"
	"os"
	"path/filepath"
)

type Service struct {
	gpxDir string
}

type RoutePoint [2]float64 // [lat, lon]

func NewService(gpxDir string) *Service {
	return &Service{gpxDir: gpxDir}
}

// PickRandom returns a random GPX filename from the directory
func (s *Service) PickRandom() (string, error) {
	entries, err := os.ReadDir(s.gpxDir)
	if err != nil {
		return "", err
	}

	var gpxFiles []string
	for _, e := range entries {
		if !e.IsDir() && filepath.Ext(e.Name()) == ".gpx" {
			gpxFiles = append(gpxFiles, e.Name())
		}
	}

	if len(gpxFiles) == 0 {
		return "", nil
	}

	return gpxFiles[rand.Intn(len(gpxFiles))], nil
}

// GetRoute returns all trackpoints as [lat, lon] pairs
func (s *Service) GetRoute(filename string) ([]RoutePoint, error) {
	points, err := Parse(filepath.Join(s.gpxDir, filename))
	if err != nil {
		return nil, err
	}

	route := make([]RoutePoint, len(points))
	for i, p := range points {
		route[i] = RoutePoint{p.Lat, p.Lon}
	}
	return route, nil
}

// GetEndpoints returns first point (restaurant) and last point (delivery)
func (s *Service) GetEndpoints(filename string) (restaurant RoutePoint, delivery RoutePoint, err error) {
	points, err := Parse(filepath.Join(s.gpxDir, filename))
	if err != nil {
		return
	}
	if len(points) < 2 {
		err = nil
		return
	}
	restaurant = RoutePoint{points[0].Lat, points[0].Lon}
	delivery = RoutePoint{points[len(points)-1].Lat, points[len(points)-1].Lon}
	return
}

// RouteToJSON serializes route points to JSON bytes
func RouteToJSON(route []RoutePoint) ([]byte, error) {
	return json.Marshal(route)
}
