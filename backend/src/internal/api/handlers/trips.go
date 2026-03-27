package handlers

import (
	"net/http"

	"delivery-tracking/internal/cassandra"
	"github.com/gin-gonic/gin"
)

type TripHandler struct {
	client *cassandra.Client
}

func NewTripHandler(client *cassandra.Client) *TripHandler {
	return &TripHandler{client: client}
}

func (h *TripHandler) GetTripMetadata(c *gin.Context) {
	tripID := c.Param("id")
	if tripID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing trip ID"})
		return
	}

	metadata, err := h.client.GetTripMetadata(tripID)
	if err != nil {
		c.JSON(http.StatusNotFound, gin.H{"error": "Trip metadata not found"})
		return
	}

	c.JSON(http.StatusOK, metadata)
}

func (h *TripHandler) GetTripRoute(c *gin.Context) {
	tripID := c.Param("id")
	if tripID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing trip ID"})
		return
	}

	route, err := h.client.GetTripRoute(tripID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch trip route"})
		return
	}

	c.JSON(http.StatusOK, route)
}
