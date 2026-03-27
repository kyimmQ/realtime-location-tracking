package api

import (
	"encoding/json"
	"log"
	"net/http"

	"delivery-tracking/internal/api/handlers"
	"delivery-tracking/internal/cassandra"
	ws "delivery-tracking/internal/websocket"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

func SetupRouter(hub *ws.Hub, cassandraClient *cassandra.Client) *gin.Engine {
	r := gin.Default()

	// WebSocket Endpoint
	r.GET("/ws/tracking", func(c *gin.Context) {
		serveWs(hub, c.Writer, c.Request)
	})

	// Handlers
	orderHandler := handlers.NewOrderHandler(cassandraClient)
	tripHandler := handlers.NewTripHandler(cassandraClient)
	driverHandler := handlers.NewDriverHandler(cassandraClient)
	adminHandler := handlers.NewAdminHandler(cassandraClient)

	// API Routes
	api := r.Group("/api")
	{
		// Orders
		api.POST("/orders", orderHandler.CreateOrder)
		api.GET("/orders/:id", orderHandler.GetOrder)
		api.PUT("/orders/:id/status", orderHandler.UpdateOrderStatus)

		// Trips
		api.GET("/trips/:id", tripHandler.GetTripMetadata)
		api.GET("/trips/:id/route", tripHandler.GetTripRoute)

		// Drivers
		api.GET("/drivers/:id/analytics", driverHandler.GetDriverAnalytics)
		api.GET("/drivers/:id/alerts", driverHandler.GetDriverAlerts)

		// Admin
		api.GET("/admin/heatmap", adminHandler.GetHeatmap)
	}

	return r
}

func serveWs(hub *ws.Hub, w http.ResponseWriter, r *http.Request) {
	conn, err := upgrader.Upgrade(w, r, nil)
	if err != nil {
		log.Printf("Failed to set websocket upgrade: %v", err)
		return
	}

	client := &ws.Client{
		Hub:  hub,
		Conn: conn,
		Send: make(chan []byte, 256),
	}
	hub.Register <- client

	// Start pump loops
	go writePump(client, conn)
	go readPump(client, conn)
}

func readPump(client *ws.Client, conn *websocket.Conn) {
	defer func() {
		client.Hub.Unregister <- client
		conn.Close()
	}()

	for {
		_, message, err := conn.ReadMessage()
		if err != nil {
			if websocket.IsUnexpectedCloseError(err, websocket.CloseGoingAway, websocket.CloseAbnormalClosure) {
				log.Printf("websocket error: %v", err)
			}
			break
		}

		var req map[string]interface{}
		if err := json.Unmarshal(message, &req); err == nil {
			action, _ := req["action"].(string)
			switch action {
			case "subscribe":
				if driverID, ok := req["driver_id"].(string); ok {
					client.Hub.SubscribeDriver(client, driverID)
				}
			case "subscribe_alerts":
				client.Hub.SubscribeAlerts(client)
			}
		}
	}
}

func writePump(client *ws.Client, conn *websocket.Conn) {
	defer func() {
		conn.Close()
	}()

	for {
		select {
		case message, ok := <-client.Send:
			if !ok {
				conn.WriteMessage(websocket.CloseMessage, []byte{})
				return
			}

			w, err := conn.NextWriter(websocket.TextMessage)
			if err != nil {
				return
			}
			w.Write(message)

			// Add queued messages to the current websocket message.
			n := len(client.Send)
			for i := 0; i < n; i++ {
				w.Write([]byte{'\n'})
				w.Write(<-client.Send)
			}

			if err := w.Close(); err != nil {
				return
			}
		}
	}
}
