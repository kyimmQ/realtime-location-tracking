package gpx

import (
    "encoding/xml"
    "os"
    "time"
)

// TrackPoint represents a single GPS point from GPX
type TrackPoint struct {
    Lat  float64   `xml:"lat,attr"`
    Lon  float64   `xml:"lon,attr"`
    Time time.Time `xml:"time"`
}

// Parse reads a GPX file and returns all trackpoints
func Parse(path string) ([]TrackPoint, error) {
    data, err := os.ReadFile(path)
    if err != nil {
        return nil, err
    }

    var gpx struct {
        Tracks []struct {
            Segs []struct {
                Points []TrackPoint `xml:"trkpt"`
            } `xml:"trkseg"`
        } `xml:"trk"`
    }

    if err := xml.Unmarshal(data, &gpx); err != nil {
        return nil, err
    }

    var all []TrackPoint
    for _, trk := range gpx.Tracks {
        for _, seg := range trk.Segs {
            all = append(all, seg.Points...)
        }
    }
    return all, nil
}
