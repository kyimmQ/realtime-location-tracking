package websocket

import (
	"encoding/json"
	"log"
	"sync"

	"github.com/gorilla/websocket"
)

// Client represents a connected WebSocket client.
type Client struct {
	Hub           *Hub
	Conn         *websocket.Conn
	Send         chan []byte
	Authenticated bool
	UserID       string
	Role         string
}

// Hub maintains the set of active clients and broadcasts messages to the clients.
type Hub struct {
	// Registered clients.
	Clients map[*Client]bool

	// Inbound messages from the clients.
	Broadcast chan []byte

	// Register requests from the clients.
	Register chan *Client

	// Unregister requests from clients.
	Unregister chan *Client

	// Subscriptions
	DriverSubscriptions map[string]map[*Client]bool
	AlertSubscriptions  map[*Client]bool
	OrderSubscriptions  map[string]map[*Client]bool
	mu                  sync.RWMutex
}

func NewHub() *Hub {
	return &Hub{
		Broadcast:           make(chan []byte),
		Register:            make(chan *Client),
		Unregister:          make(chan *Client),
		Clients:             make(map[*Client]bool),
		DriverSubscriptions: make(map[string]map[*Client]bool),
		AlertSubscriptions:  make(map[*Client]bool),
		OrderSubscriptions:  make(map[string]map[*Client]bool),
	}
}

func (h *Hub) Run() {
	for {
		select {
		case client := <-h.Register:
			h.mu.Lock()
			h.Clients[client] = true
			h.mu.Unlock()
		case client := <-h.Unregister:
			h.mu.Lock()
			if _, ok := h.Clients[client]; ok {
				delete(h.Clients, client)
				close(client.Send)

				// Clean up driver subscriptions
				for driverID, clients := range h.DriverSubscriptions {
					delete(clients, client)
					if len(clients) == 0 {
						delete(h.DriverSubscriptions, driverID)
					}
				}
				// Clean up alert subscriptions
				delete(h.AlertSubscriptions, client)
				// Clean up order subscriptions
				for orderID, clients := range h.OrderSubscriptions {
					delete(clients, client)
					if len(clients) == 0 {
						delete(h.OrderSubscriptions, orderID)
					}
				}
			}
			h.mu.Unlock()
		case message := <-h.Broadcast:
			h.mu.Lock()
			for client := range h.Clients {
				select {
				case client.Send <- message:
				default:
					close(client.Send)
					delete(h.Clients, client)
				}
			}
			h.mu.Unlock()
		}
	}
}

func (h *Hub) SubscribeDriver(client *Client, driverID string) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.DriverSubscriptions[driverID]; !ok {
		h.DriverSubscriptions[driverID] = make(map[*Client]bool)
	}
	h.DriverSubscriptions[driverID][client] = true
}

func (h *Hub) SubscribeAlerts(client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	h.AlertSubscriptions[client] = true
}

func (h *Hub) BroadcastLocation(driverID string, message map[string]interface{}) {
	payload, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling location: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	// Send to driver subscribers
	if clients, ok := h.DriverSubscriptions[driverID]; ok {
		for client := range clients {
			select {
			case client.Send <- payload:
			default:
			}
		}
	}

	// Send to order subscribers (order-based subscription)
	// Extract order_id from message payload
	if payloadMap, ok := message["payload"].(map[string]interface{}); ok {
		if orderID, ok := payloadMap["order_id"].(string); ok {
			if clients, ok := h.OrderSubscriptions[orderID]; ok {
				for client := range clients {
					select {
					case client.Send <- payload:
					default:
					}
				}
			}
		}
	}
}

func (h *Hub) SubscribeOrder(orderID string, client *Client) {
	h.mu.Lock()
	defer h.mu.Unlock()
	if _, ok := h.OrderSubscriptions[orderID]; !ok {
		h.OrderSubscriptions[orderID] = make(map[*Client]bool)
	}
	h.OrderSubscriptions[orderID][client] = true
}

func (h *Hub) BroadcastAlert(message map[string]interface{}) {
	payload, err := json.Marshal(message)
	if err != nil {
		log.Printf("Error marshaling alert: %v", err)
		return
	}

	h.mu.RLock()
	defer h.mu.RUnlock()

	for client := range h.AlertSubscriptions {
		select {
		case client.Send <- payload:
		default:
		}
	}
}
