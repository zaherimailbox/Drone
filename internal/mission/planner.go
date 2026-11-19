// planner.go – Core mission planning algorithms (grid generation, sweep path, RTH)
package mission

import (
    "math"
    "errors"
)

// GenerateGrid creates a rectangular grid of square cells (step_cm) covering the polygon defined by vertices.
// Returns a slice of Cells with their geographic center and bounds.
func GenerateGrid(m *Mission) error {
    // TODO: Implement ENU projection, polygon clipping (>50% area), edge smoothing.
    // Placeholder: return not implemented error.
    return errors.New("GenerateGrid not implemented – geometry calculations pending")
}

// ComputeSweepPath generates a Boustrophedon sweep traversal for the mission cells.
// It populates m.SweepPolyline and sets start/end cell IDs.
func ComputeSweepPath(m *Mission) error {
    // TODO: Determine optimal sweep orientation (parallel to longest edge), perform snake traversal.
    return errors.New("ComputeSweepPath not implemented – traversal logic pending")
}

// ComputeConstrainedRTH computes the Return-To-Home (RTH) polyline after mission completion.
// It respects safety locks and falls back to A* if diagonal intersects NO_FLY cells.
func ComputeConstrainedRTH(m *Mission) error {
    // TODO: Implement diagonal safety check & A* fallback.
    return errors.New("ComputeConstrainedRTH not implemented – pathfinding pending")
}

// Helper for ENU projection (lat/lon to local metric coordinates).
func enuFromLatLon(origin LatLon, target LatLon) (x, y float64) {
    // Simple equirectangular approximation (sufficient for small areas).
    const R = 6378137.0 // Earth radius in meters
    dLat := (target.Lat - origin.Lat) * math.Pi / 180.0
    dLon := (target.Lon - origin.Lon) * math.Pi / 180.0
    latRad := origin.Lat * math.Pi / 180.0
    x = R * dLon * math.Cos(latRad)
    y = R * dLat
    return
}

// Helper to project ENU back to LatLon (inverse of enuFromLatLon).
func latLonFromENU(origin LatLon, x, y float64) (LatLon) {
    const R = 6378137.0
    dLat := y / R
    dLon := x / (R * math.Cos(origin.Lat*math.Pi/180.0))
    return LatLon{Lat: origin.Lat + dLat*180.0/math.Pi, Lon: origin.Lon + dLon*180.0/math.Pi}
}

// ValidateSafeAltitude clamps the provided altitude to allowed range.
func ValidateSafeAltitude(alt float64) float64 {
    const (
        min = 1.0
        max = 15.0
    )
    if alt < min { return min }
    if alt > max { return max }
    return alt
}
