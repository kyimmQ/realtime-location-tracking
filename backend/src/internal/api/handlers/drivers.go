package handlers

import (
	"net/http"
	"time"

	"delivery-tracking/internal/cassandra"
	"github.com/gin-gonic/gin"
)

type DriverHandler struct {
	client *cassandra.Client
}

func NewDriverHandler(client *cassandra.Client) *DriverHandler {
	return &DriverHandler{client: client}
}

func (h *DriverHandler) GetDriverAnalytics(c *gin.Context) {
	driverID := c.Param("id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing driver ID"})
		return
	}

	stats, err := h.client.GetDriverAnalytics(driverID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch driver analytics"})
		return
	}

	c.JSON(http.StatusOK, stats)
}

func (h *DriverHandler) GetDriverAlerts(c *gin.Context) {
	driverID := c.Param("id")
	if driverID == "" {
		c.JSON(http.StatusBadRequest, gin.H{"error": "Missing driver ID"})
		return
	}

	// Default to last 24 hours if not specified
	sinceStr := c.Query("since")
	since := time.Now().Add(-24 * time.Hour)
	if sinceStr != "" {
		parsed, err := time.Parse(time.RFC3339, sinceStr)
		if err == nil {
			since = parsed
		}
	}

	alerts, err := h.client.GetDriverAlerts(driverID, since)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch driver alerts"})
		return
	}

	c.JSON(http.StatusOK, alerts)
}
