package handlers

import (
	"net/http"

	"delivery-tracking/internal/cassandra"
	"github.com/gin-gonic/gin"
)

type OrderHandler struct {
	client *cassandra.Client
}

func NewOrderHandler(client *cassandra.Client) *OrderHandler {
	return &OrderHandler{client: client}
}

func (h *OrderHandler) CreateOrder(c *gin.Context) {
	var order cassandra.Order
	if err := c.ShouldBindJSON(&order); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.client.CreateOrder(order); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to create order"})
		return
	}

	c.JSON(http.StatusCreated, order)
}

func (h *OrderHandler) GetOrder(c *gin.Context) {
	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing order ID"})
		return
	}

	order, err := h.client.GetOrder(orderID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Order not found"})
		return
	}

	c.JSON(http.StatusOK, order)
}

func (h *OrderHandler) UpdateOrderStatus(c *gin.Context) {
	orderID := c.Param("id")
	if orderID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing order ID"})
		return
	}

	var req struct {
		Status string `json:"status" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	if err := h.client.UpdateOrderStatus(orderID, req.Status); err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to update order status"})
		return
	}

	if req.Status == "DELIVERED" {
		tripID, err := h.client.GetTripIDByOrderID(orderID)
		if err == nil && tripID != "" {
			_ = h.client.CompleteTrip(tripID)
		}
	}

	c.JSON(http.StatusOK, gin.H{"status": "updated"})
}
