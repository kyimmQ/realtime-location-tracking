package api

import (
	"encoding/json"
	"log"
	"net/http"

	"delivery-tracking/internal/api/handlers"
	"delivery-tracking/internal/api/middleware"
	"delivery-tracking/internal/auth"
	"delivery-tracking/internal/cassandra"
	"delivery-tracking/internal/gpx"
	"delivery-tracking/internal/kafka"
	"delivery-tracking/internal/postgres"
	"delivery-tracking/internal/simulator"
	ws "delivery-tracking/internal/websocket"
	"github.com/gin-gonic/gin"
	"github.com/gorilla/websocket"
)

var upgrader = websocket.Upgrader{
	CheckOrigin: func(r *http.Request) bool {
		return true // Allow all origins for now
	},
}

func SetupRouter(hub *ws.Hub, cassandraClient *cassandra.Client, pgClient *postgres.Client, kafkaProducer *kafka.Producer, gpxService *gpx.Service) *gin.Engine {
	r := gin.Default()

	// CORS middleware - allow frontend origin
	r.Use(func(c *gin.Context) {
		c.Header("Access-Control-Allow-Origin", "*")
		c.Header("Access-Control-Allow-Methods", "GET, POST, PUT, DELETE, OPTIONS")
		c.Header("Access-Control-Allow-Headers", "Content-Type, Authorization")
		if c.Request.Method == "OPTIONS" {
			c.AbortWithStatus(204)
			return
		}
		c.Next()
	})

	// Initialize simulator trigger
	if kafkaProducer != nil && gpxService != nil {
		simulator.NewTrigger(kafkaProducer, gpxService)
	}

	// WebSocket Endpoint
	r.GET("/ws/tracking", func(c *gin.Context) {
		serveWs(hub, c.Writer, c.Request)
	})

	// Handlers
	orderHandler := handlers.NewOrderHandler(cassandraClient, pgClient, gpxService)
	tripHandler := handlers.NewTripHandler(cassandraClient)
	driverHandler := handlers.NewDriverHandler(cassandraClient, pgClient)
	adminHandler := handlers.NewAdminHandler(cassandraClient)
	authHandler := handlers.NewAuthHandler()

	// Auth routes (public)
	api := r.Group("/api")
	{
		api.POST("/auth/register", authHandler.Register)
		api.POST("/auth/login", authHandler.Login)
		api.POST("/auth/refresh", authHandler.Refresh)
	}

	// Protected routes
	protected := r.Group("/api")
	protected.Use(middleware.AuthRequired())
	{
		protected.GET("/auth/me", authHandler.Me)

		// Orders
		protected.POST("/orders", middleware.AuthRequired("USER"), orderHandler.CreateOrder)
		protected.GET("/orders", orderHandler.ListOrders)
		protected.GET("/orders/:id", orderHandler.GetOrder)
		protected.PUT("/orders/:id/status", orderHandler.UpdateOrderStatus)
		protected.GET("/orders/:id/route", orderHandler.GetOrderRoute)

		// Trips
		protected.GET("/trips/:id", tripHandler.GetTripMetadata)
		protected.GET("/trips/:id/route", tripHandler.GetTripRoute)

		// Drivers
		protected.GET("/drivers/:id/analytics", middleware.AuthRequired("ADMIN", "DRIVER"), driverHandler.GetDriverAnalytics)
		protected.GET("/drivers/:id/alerts", middleware.AuthRequired("ADMIN", "DRIVER"), driverHandler.GetDriverAlerts)
		protected.GET("/drivers/:id/orders", middleware.AuthRequired("ADMIN", "DRIVER"), driverHandler.GetDriverOrders)

		// Admin
		protected.GET("/admin/heatmap", middleware.AuthRequired("ADMIN"), adminHandler.GetHeatmap)
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

			// Auth handshake - must be first message
			if !client.Authenticated {
				if action == "auth" {
					token, ok := req["token"].(string)
					if !ok {
						conn.WriteJSON(map[string]string{"type": "auth_error", "error": "missing token"})
						return
					}
					claims, err := auth.ValidateToken(token)
					if err != nil {
						conn.WriteJSON(map[string]string{"type": "auth_error", "error": "invalid token"})
						return
					}
					client.Authenticated = true
					client.UserID = claims.UserID
					client.Role = claims.Role
					conn.WriteJSON(map[string]string{"type": "auth_success"})
					continue
				}
				conn.WriteJSON(map[string]string{"type": "error", "error": "must authenticate first"})
				return
			}

			// Handle subscribe after authenticated
			switch action {
			case "subscribe":
				if driverID, ok := req["driver_id"].(string); ok {
					client.Hub.SubscribeDriver(client, driverID)
				}
				if orderID, ok := req["order_id"].(string); ok {
					client.Hub.SubscribeOrder(orderID, client)
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
