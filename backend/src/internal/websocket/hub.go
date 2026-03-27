package websocket

import (
	"encoding/json"
	"log"
	"sync"
)

// Client represents a connected WebSocket client.
type Client struct {
	Hub     *Hub
	Conn    interface{} // Generic for now, to be integrated with gorilla/websocket later
	Send    chan []byte
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

				// Clean up subscriptions
				for driverID, clients := range h.DriverSubscriptions {
					delete(clients, client)
					if len(clients) == 0 {
						delete(h.DriverSubscriptions, driverID)
					}
				}
				delete(h.AlertSubscriptions, client)
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

	if clients, ok := h.DriverSubscriptions[driverID]; ok {
		for client := range clients {
			select {
			case client.Send <- payload:
			default:
				// Assuming channel closed or full, clean up handled by unregister
			}
		}
	}
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
