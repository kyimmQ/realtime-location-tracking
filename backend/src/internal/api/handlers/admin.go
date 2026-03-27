package handlers

import (
	"net/http"
	"time"

	"delivery-tracking/internal/cassandra"
	"github.com/gin-gonic/gin"
)

type AdminHandler struct {
	client *cassandra.Client
}

func NewAdminHandler(client *cassandra.Client) *AdminHandler {
	return &AdminHandler{client: client}
}

func (h *AdminHandler) GetHeatmap(c *gin.Context) {
	// Parse since/until query parameters, default to last hour
	now := time.Now()
	since := now.Add(-1 * time.Hour)
	until := now

	if sinceStr := c.Query("since"); sinceStr != "" {
		if parsed, err := time.Parse(time.RFC3339, sinceStr); err == nil {
			since = parsed
		}
	}
	if untilStr := c.Query("until"); untilStr != "" {
		if parsed, err := time.Parse(time.RFC3339, untilStr); err == nil {
			until = parsed
		}
	}

	heatmapData, err := h.client.GetHeatmapData(since, until)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "Failed to fetch heatmap data"})
		return
	}

	c.JSON(http.StatusOK, heatmapData)
}
