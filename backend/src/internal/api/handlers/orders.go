package handlers

import (
	"context"
	"encoding/json"
	"fmt"
	"net/http"

	"delivery-tracking/internal/cassandra"
	"delivery-tracking/internal/gpx"
	"delivery-tracking/internal/postgres"
	"delivery-tracking/internal/simulator"

	"github.com/gin-gonic/gin"
)

type OrderHandler struct {
	client     *cassandra.Client
	pgClient   postgres.PGClient
	gpxService *gpx.Service
}

func NewOrderHandler(client *cassandra.Client, pgClient postgres.PGClient, gpxSvc *gpx.Service) *OrderHandler {
	return &OrderHandler{client: client, pgClient: pgClient, gpxService: gpxSvc}
}

// POST /api/orders - Place a new order (USER only)
func (h *OrderHandler) CreateOrder(c *gin.Context) {
	userID, _ := c.Get("user_id")
	userIDStr := userID.(string)

	pg := h.pgClient
	gpxSvc := h.gpxService

	// Pick random GPX
	gpxFile, err := gpxSvc.PickRandom()
	if err != nil || gpxFile == "" {
		c.JSON(http.StatusServiceUnavailable, gin.H{"error": "no GPX files available"})
		return
	}

	restaurant, delivery, err := gpxSvc.GetEndpoints(gpxFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to parse GPX"})
		return
	}

	routePoints, err := gpxSvc.GetRoute(gpxFile)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to load route"})
		return
	}

	routeJSON, _ := json.Marshal(routePoints)

	// Create order as PENDING - no driver assigned yet, any driver can accept it
	rows, err := pg.Query(c.Request.Context(),
		`INSERT INTO orders (user_id, driver_id, gpx_file, status, restaurant_location, delivery_location, route_points)
         VALUES ($1, NULL, $2, 'PENDING', $3, $4, $5)
         RETURNING id::text`,
		userIDStr, gpxFile,
		formatPoint(restaurant), formatPoint(delivery), string(routeJSON))
	if err != nil || len(rows) == 0 {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to create order"})
		return
	}
	orderID := rows[0][0].(string)

	c.JSON(http.StatusCreated, gin.H{
		"id":                  orderID,
		"status":              "PENDING",
		"driver_id":           nil,
		"gpx_file":            gpxFile,
		"restaurant_location": formatPoint(restaurant),
		"delivery_location":   formatPoint(delivery),
	})
}

func formatPoint(pt gpx.RoutePoint) string {
	return fmt.Sprintf("%.6f,%.6f", pt[0], pt[1])
}

// PUT /api/orders/:id/status - Update order status
func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
	orderID := c.Param("id")
	userID, _ := c.Get("user_id")
	role, _ := c.Get("role")

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pg := h.pgClient

	// Get current order
	row, err := pg.QueryRow(c.Request.Context(),
		"SELECT driver_id::text, status, user_id::text FROM orders WHERE id = $1", orderID)
	if err != nil || row == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}

	var driverID *string
	if row[0] != nil {
		did := row[0].(string)
		driverID = &did
	}
	currentStatus := row[1].(string)

	// Validate state transitions and permissions
	validTransitions := map[string]map[string]bool{
		"USER": {
			"PENDING":   true,
			"CANCELLED": true,
		},
		"DRIVER": {
			"ACCEPTED":   currentStatus == "ASSIGNED" || currentStatus == "PENDING",
			"PICKING_UP": currentStatus == "ACCEPTED",
			"IN_TRANSIT": currentStatus == "PICKING_UP" || currentStatus == "IN_TRANSIT",
			"ARRIVING":   currentStatus == "IN_TRANSIT",
			"DELIVERED":  currentStatus == "ARRIVING",
		},
	}

	roleStr, _ := role.(string)
	if roleTransitions, ok := validTransitions[roleStr]; !ok || !roleTransitions[req.Status] {
		c.JSON(http.StatusForbidden, gin.H{"error": "invalid status transition"})
		return
	}

	// If driver assignment needed (no driver assigned yet)
	if roleStr == "DRIVER" && req.Status == "ACCEPTED" && driverID == nil {
		driverIDStr, ok := userID.(string)
		if ok {
			driverRow, _ := pg.QueryRow(c.Request.Context(),
				`UPDATE driver_profiles
                 SET status = 'BUSY'
                 WHERE user_id = $1
                 RETURNING user_id::text`, driverIDStr)
			if driverRow != nil && len(driverRow) > 0 {
				newDriverID := driverRow[0].(string)
				driverID = &newDriverID
			} else {
				driverID = &driverIDStr
			}
		}
	}

	// Update status (and driver_id if reassigned)
	if driverID != nil && *driverID != "" {
		err = pg.Exec(c.Request.Context(),
			"UPDATE orders SET status = $1, driver_id = $2, updated_at = NOW() WHERE id = $3",
			req.Status, *driverID, orderID)
	} else {
		err = pg.Exec(c.Request.Context(),
			"UPDATE orders SET status = $1, updated_at = NOW() WHERE id = $2",
			req.Status, orderID)
	}
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	fmt.Println("Order status updated to", req.Status)
	fmt.Println("Driver ID:", driverID)
	// If PICKING_UP, trigger simulator
	if req.Status == "IN_TRANSIT" && driverID != nil {
		sim := simulator.GetTrigger()
		if sim != nil {
			// Use background context so simulator continues after HTTP request ends
			go sim.Trigger(context.Background(), orderID, *driverID, 1000)
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": req.Status})
}

// GET /api/orders - List orders for current user (USER) or driver (DRIVER)
func (h *OrderHandler) ListOrders(c *gin.Context) {
	userID, _ := c.Get("user_id")
	role, _ := c.Get("role")

	pg := h.pgClient
	userIDStr := userID.(string)

	var rows [][]interface{}
	var err error

	if role.(string) == "DRIVER" {
		rows, err = pg.Query(c.Request.Context(),
			`SELECT id::text, user_id::text, driver_id::text, status,
                    restaurant_location, delivery_location, gpx_file, created_at
             FROM orders WHERE driver_id = $1 OR status = 'PENDING' ORDER BY created_at DESC`, userIDStr)
	} else {
		rows, err = pg.Query(c.Request.Context(),
			`SELECT id::text, user_id::text, driver_id::text, status,
                    restaurant_location, delivery_location, gpx_file, created_at
             FROM orders WHERE user_id = $1 ORDER BY created_at DESC`, userIDStr)
	}

	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": err.Error()})
		return
	}

	orders := make([]gin.H, len(rows))
	for i, row := range rows {
		var driverID *string
		if row[2] != nil {
			did := row[2].(string)
			driverID = &did
		}
		orders[i] = gin.H{
			"id":                  row[0].(string),
			"user_id":             row[1].(string),
			"driver_id":           driverID,
			"status":              row[3].(string),
			"restaurant_location": row[4],
			"delivery_location":   row[5],
			"gpx_file":            row[6],
			"created_at":          row[7],
		}
	}

	c.JSON(http.StatusOK, orders)
}

// GET /api/orders/:id - Get order details
func (h *OrderHandler) GetOrder(c *gin.Context) {
	orderID := c.Param("id")

	pg := h.pgClient
	row, err := pg.QueryRow(c.Request.Context(),
		`SELECT id::text, user_id::text, driver_id::text, status,
                restaurant_location, delivery_location, gpx_file, route_points, created_at
         FROM orders WHERE id = $1`, orderID)
	if err != nil || row == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}

	var driverID *string
	if row[2] != nil {
		did := row[2].(string)
		driverID = &did
	}
	var routePoints json.RawMessage
	if row[7] != nil {
		switch v := row[7].(type) {
		case string:
			routePoints = json.RawMessage(v)
		case []interface{}:
			routeBytes, _ := json.Marshal(v)
			routePoints = json.RawMessage(routeBytes)
		}
	}

	c.JSON(http.StatusOK, gin.H{
		"id":                  row[0].(string),
		"user_id":             row[1].(string),
		"driver_id":           driverID,
		"status":              row[3].(string),
		"restaurant_location": row[4],
		"delivery_location":   row[5],
		"gpx_file":            row[6],
		"route_points":        routePoints,
		"created_at":          row[8],
	})
}

// GET /api/orders/:id/route - Get route points for the order
func (h *OrderHandler) GetOrderRoute(c *gin.Context) {
	orderID := c.Param("id")

	pg := h.pgClient
	row, err := pg.QueryRow(c.Request.Context(),
		"SELECT route_points FROM orders WHERE id = $1", orderID)
	if err != nil || row == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "order not found"})
		return
	}

	if row[0] == nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "no route for this order"})
		return
	}

	var routePoints json.RawMessage
	switch v := row[0].(type) {
	case string:
		routePoints = json.RawMessage(v)
	case []interface{}:
		routeBytes, _ := json.Marshal(v)
		routePoints = json.RawMessage(routeBytes)
	}
	c.JSON(http.StatusOK, routePoints)
}
