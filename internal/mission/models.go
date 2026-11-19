// models.go – Data structures for mission planning
package mission

import "encoding/json"

type LatLon struct {
    Lat float64 `json:"lat"`
    Lon float64 `json:"lon"`
}

// Mission defines the overall mission configuration.
type Mission struct {
    ID            string      `json:"id"`
    Vertices      []LatLon    `json:"vertices"`
    StepCM        int         `json:"step_cm"`
    VirtualHome   LatLon      `json:"virtual_home"`
    SweepAngleDeg float64     `json:"sweep_angle_offset_deg"`
    Cells         []Cell      `json:"cells"`
    SweepPolyline []Waypoint  `json:"sweep_polyline"`
    RTHPolyline   []Waypoint  `json:"rth_polyline"`
    Stats         Stats       `json:"stats"`
    Profile       string      `json:"mission_profile"`
    SafeAltM      float64     `json:"safe_altitude_m"`
}

type Cell struct {
    ID       string   `json:"id"`
    Row      int      `json:"row"`
    Col      int      `json:"col"`
    Center   LatLon   `json:"center_lat_lon"`
    Bounds   []LatLon `json:"bounds"`
    State    string   `json:"state"`
    SeqIndex int      `json:"sequence_index"`
}

type Waypoint struct {
    Lat        float64 `json:"lat"`
    Lon        float64 `json:"lon"`
    AltitudeM  float64 `json:"altitude_m"`
    Action     string  `json:"action,omitempty"`
    Timestamp  int64   `json:"timestamp,omitempty"`
}

type Stats struct {
    TotalCells          int `json:"total_cells"`
    ActiveScanCells     int `json:"active_scan_cells"`
    EstimatedDurationSec int `json:"estimated_duration_sec"`
}

// Helper to deep‑copy a mission as JSON (used by storage).
func (m *Mission) Clone() (*Mission, error) {
    b, err := json.Marshal(m)
    if err != nil { return nil, err }
    var copy Mission
    if err = json.Unmarshal(b, &copy); err != nil { return nil, err }
    return &copy, nil
}
