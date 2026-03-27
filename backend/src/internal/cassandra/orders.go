package cassandra

import (
	"log"
	"time"
)

type Order struct {
	OrderID            string    `json:"order_id"`
	CustomerID         string    `json:"customer_id"`
	DriverID           string    `json:"driver_id"`
	RestaurantLocation string    `json:"restaurant_location"`
	DeliveryLocation   string    `json:"delivery_location"`
	Status             string    `json:"status"`
	CreatedAt          time.Time `json:"created_at"`
	UpdatedAt          time.Time `json:"updated_at"`
}

func (c *Client) CreateOrder(order Order) error {
	session := c.GetSession()
	query := `INSERT INTO orders (order_id, customer_id, driver_id, restaurant_location, delivery_location, status, created_at, updated_at)
			  VALUES (?, ?, ?, ?, ?, ?, ?, ?)`

	err := session.Query(query, order.OrderID, order.CustomerID, order.DriverID, order.RestaurantLocation, order.DeliveryLocation, order.Status, time.Now(), time.Now()).Exec()
	if err != nil {
		log.Printf("Error creating order: %v", err)
	}
	return err
}

func (c *Client) GetOrder(orderID string) (*Order, error) {
	session := c.GetSession()
	query := `SELECT order_id, customer_id, driver_id, restaurant_location, delivery_location, status, created_at, updated_at
			  FROM orders WHERE order_id = ?`

	var order Order
	err := session.Query(query, orderID).Scan(
		&order.OrderID, &order.CustomerID, &order.DriverID,
		&order.RestaurantLocation, &order.DeliveryLocation,
		&order.Status, &order.CreatedAt, &order.UpdatedAt,
	)
	if err != nil {
		log.Printf("Error fetching order: %v", err)
		return nil, err
	}
	return &order, nil
}

func (c *Client) UpdateOrderStatus(orderID, status string) error {
	session := c.GetSession()
	query := `UPDATE orders SET status = ?, updated_at = ? WHERE order_id = ?`

	err := session.Query(query, status, time.Now(), orderID).Exec()
	if err != nil {
		log.Printf("Error updating order status: %v", err)
	}
	return err
}
