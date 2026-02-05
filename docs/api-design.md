# API Design Specification

**Version:** 2.0.0
**Last Updated:** 2026-01-30

## 1. Overview

This document specifies the REST API and WebSocket protocol for the real-time delivery tracking system.

**Base URL:** `http://localhost:8080/api/v1`

**Authentication:** JWT Bearer tokens (implementation optional for demo)

## 2. REST API Endpoints

### 2.1. Order Management

#### POST /api/orders
**Description:** Customer places a new delivery order

**Request:**
```json
{
  "customer_id": "C456",
  "restaurant_location": "10.762622,106.660172",
  "delivery_location": "10.782345,106.695123",
  "items": ["Pizza Margherita", "Coke"],
  "notes": "Ring doorbell"
}
```

**Response (201 Created):**
```json
{
  "order_id": "O789",
  "customer_id": "C456",
  "driver_id": "D123",
  "driver_name": "John Doe",
  "driver_vehicle": "Honda CB150",
  "driver_phone": "+84901234567",
  "restaurant_location": "10.762622,106.660172",
  "delivery_location": "10.782345,106.695123",
  "status": "PENDING",
  "estimated_distance": 3.2,
  "estimated_duration": 12,
  "created_at": "2024-01-30T10:15:00Z"
}
```

**Errors:**
- `400 Bad Request`: Invalid location format
- `404 Not Found`: No available drivers
- `500 Internal Server Error`: Database error

---

#### GET /api/orders/:id
**Description:** Get order details

**Response (200 OK):**
```json
{
  "order_id": "O789",
  "customer_id": "C456",
  "driver_id": "D123",
  "trip_id": "T456",
  "status": "IN_TRANSIT",
  "restaurant_location": "10.762622,106.660172",
  "delivery_location": "10.782345,106.695123",
  "created_at": "2024-01-30T10:15:00Z",
  "accepted_at": "2024-01-30T10:16:30Z",
  "delivered_at": null,
  "current_eta_seconds": 420
}
```

---

#### PUT /api/orders/:id/status
**Description:** Driver updates order status

**Request:**
```json
{
  "status": "ACCEPTED",  // ACCEPTED | IN_TRANSIT | ARRIVING | DELIVERED
  "timestamp": "2024-01-30T10:16:30Z"
}
```

**Response (200 OK):**
```json
{
  "order_id": "O789",
  "status": "ACCEPTED",
  "updated_at": "2024-01-30T10:16:30Z"
}
```

**Status Transition Rules:**
```
PENDING → ACCEPTED → IN_TRANSIT → ARRIVING → DELIVERED
         ↓
      CANCELLED
```

---

### 2.2. Trip Management

#### GET /api/trips/:id
**Description:** Get trip summary with cost calculation

**Response (200 OK):**
```json
{
  "trip_id": "T456",
  "order_id": "O789",
  "driver_id": "D123",
  "start_time": "2024-01-30T10:16:30Z",
  "end_time": "2024-01-30T10:38:45Z",
  "duration_seconds": 1335,
  "total_distance_km": 8.3,
  "average_speed_kmh": 38.2,
  "max_speed_kmh": 62.5,
  "speeding_violations": 1,
  "trip_cost": 9.35,
  "cost_breakdown": {
    "base_fare": 3.00,
    "distance_charge": 4.15,
    "time_charge": 2.20
  },
  "status": "COMPLETED"
}
```

---

#### GET /api/trips/:id/route
**Description:** Get full GPS trace for route playback

**Query Parameters:**
- `limit` (optional): Max number of points (default: all)
- `interval` (optional): Sample every N seconds (default: 1)

**Response (200 OK):**
```json
{
  "trip_id": "T456",
  "total_points": 1335,
  "points": [
    {
      "timestamp": "2024-01-30T10:16:30Z",
      "latitude": 10.762622,
      "longitude": 106.660172,
      "speed": 0,
      "heading": 0
    },
    {
      "timestamp": "2024-01-30T10:16:31Z",
      "latitude": 10.762645,
      "longitude": 106.660189,
      "speed": 12.5,
      "heading": 45
    }
    // ... more points
  ]
}
```

**Performance Note:** For large trips (>1000 points), use pagination or sampling

---

### 2.3. Driver Management

#### GET /api/drivers/:id/location
**Description:** Get driver's current location (latest GPS point)

**Response (200 OK):**
```json
{
  "driver_id": "D123",
  "trip_id": "T456",
  "last_updated": "2024-01-30T10:30:15Z",
  "latitude": 10.772345,
  "longitude": 106.675123,
  "speed": 45.5,
  "heading": 90,
  "eta_seconds": 420,
  "distance_to_destination": 3.2
}
```

---

#### GET /api/drivers/:id/analytics
**Description:** Get driver performance analytics

**Query Parameters:**
- `start_date`: ISO date (e.g., "2024-01-29")
- `end_date`: ISO date (e.g., "2024-02-05")

**Response (200 OK):**
```json
{
  "driver_id": "D123",
  "period": {
    "start": "2024-01-29",
    "end": "2024-02-05"
  },
  "metrics": {
    "total_trips": 42,
    "total_distance_km": 523.4,
    "total_duration_hours": 18.5,
    "average_speed_kmh": 38.2,
    "max_speed_kmh": 72.3,
    "speeding_violations": 3,
    "idle_time_hours": 2.1,
    "total_earnings": 432.50
  },
  "daily_breakdown": [
    {
      "date": "2024-01-29",
      "trips": 8,
      "distance_km": 95.2,
      "earnings": 78.40
    }
    // ... more days
  ]
}
```

---

#### GET /api/drivers/:id/alerts
**Description:** Get driver's safety alerts and violations

**Query Parameters:**
- `since`: ISO timestamp (default: last 7 days)
- `type`: Filter by alert type (optional)

**Response (200 OK):**
```json
{
  "driver_id": "D123",
  "total_alerts": 5,
  "alerts": [
    {
      "alert_id": "A001",
      "trip_id": "T456",
      "timestamp": "2024-01-30T10:25:30Z",
      "alert_type": "SPEEDING",
      "severity": "HIGH",
      "message": "Speed limit exceeded: 75 km/h in 60 km/h zone",
      "metadata": {
        "current_speed": "75.0",
        "speed_limit": "60.0",
        "location": "10.772345,106.675123",
        "duration_seconds": "15"
      }
    },
    {
      "alert_id": "A002",
      "trip_id": "T456",
      "timestamp": "2024-01-30T10:37:00Z",
      "alert_type": "PROXIMITY",
      "severity": "MEDIUM",
      "message": "Driver approaching destination: 480m remaining",
      "metadata": {
        "distance_meters": "480"
      }
    }
  ]
}
```

---

### 2.4. Admin & Analytics

#### GET /api/admin/heatmap
**Description:** Get delivery density heatmap data

**Query Parameters:**
- `start_date`: ISO date
- `end_date`: ISO date
- `grid_size`: Grid cell size in meters (default: 1000)

**Response (200 OK):**
```json
{
  "period": {
    "start": "2024-01-01",
    "end": "2024-01-30"
  },
  "grid_size_meters": 1000,
  "zones": [
    {
      "center_lat": 10.780000,
      "center_lng": 106.680000,
      "delivery_count": 342,
      "avg_delivery_time_minutes": 18.5,
      "density_score": 0.85
    }
    // ... more zones
  ]
}
```

---

#### GET /api/admin/trips
**Description:** List all trips with filtering and pagination

**Query Parameters:**
- `driver_id` (optional): Filter by driver
- `status` (optional): Filter by status (ACTIVE | COMPLETED | CANCELLED)
- `start_date` (optional): Filter by trip start date
- `limit` (default: 50): Max results
- `offset` (default: 0): Pagination offset

**Response (200 OK):**
```json
{
  "total_count": 1234,
  "limit": 50,
  "offset": 0,
  "trips": [
    {
      "trip_id": "T456",
      "order_id": "O789",
      "driver_id": "D123",
      "driver_name": "John Doe",
      "start_time": "2024-01-30T10:16:30Z",
      "end_time": "2024-01-30T10:38:45Z",
      "distance_km": 8.3,
      "duration_minutes": 22.3,
      "cost": 9.35,
      "status": "COMPLETED"
    }
    // ... more trips
  ]
}
```

---

## 3. WebSocket API

### 3.1. Connection

**Endpoint:** `ws://localhost:8080/ws/tracking`

**Authentication:** Send JWT token in first message (optional for demo)

### 3.2. Client → Server Messages

#### Subscribe to Driver Updates
```json
{
  "action": "subscribe",
  "driver_ids": ["D123", "D456"]
}
```

**Response:**
```json
{
  "type": "subscription_success",
  "driver_ids": ["D123", "D456"],
  "message": "Subscribed to 2 drivers"
}
```

---

#### Unsubscribe from Driver
```json
{
  "action": "unsubscribe",
  "driver_ids": ["D456"]
}
```

---

#### Ping (Keep-Alive)
```json
{
  "action": "ping"
}
```

**Response:**
```json
{
  "type": "pong",
  "timestamp": "2024-01-30T10:30:00Z"
}
```

---

### 3.3. Server → Client Messages

#### Location Update
**Frequency:** Every 1 second (when driver is active)

```json
{
  "type": "location_update",
  "driver_id": "D123",
  "trip_id": "T456",
  "timestamp": "2024-01-30T10:30:15.123Z",
  "latitude": 10.772345,
  "longitude": 106.675123,
  "speed": 45.5,
  "heading": 90,
  "eta_seconds": 420,
  "distance_to_destination_km": 3.2,
  "is_speeding": false
}
```

---

#### Alert Notification
**Triggered by:** Speed violations, proximity detection

```json
{
  "type": "alert",
  "alert_id": "A001",
  "driver_id": "D123",
  "trip_id": "T456",
  "timestamp": "2024-01-30T10:25:30Z",
  "alert_type": "SPEEDING",
  "severity": "HIGH",
  "message": "Driver exceeded speed limit: 75 km/h",
  "requires_action": true
}
```

---

#### Status Update
**Triggered by:** Driver updates order status

```json
{
  "type": "status_update",
  "order_id": "O789",
  "driver_id": "D123",
  "old_status": "IN_TRANSIT",
  "new_status": "ARRIVING",
  "timestamp": "2024-01-30T10:37:00Z"
}
```

---

#### Trip Completion
**Triggered by:** Driver marks order as DELIVERED

```json
{
  "type": "trip_complete",
  "trip_id": "T456",
  "order_id": "O789",
  "driver_id": "D123",
  "timestamp": "2024-01-30T10:38:45Z",
  "total_distance_km": 8.3,
  "total_duration_seconds": 1335,
  "trip_cost": 9.35,
  "cost_breakdown": {
    "base_fare": 3.00,
    "distance_charge": 4.15,
    "time_charge": 2.20
  }
}
```

---

## 4. Error Handling

### 4.1. HTTP Error Responses

**Standard Error Format:**
```json
{
  "error": {
    "code": "ORDER_NOT_FOUND",
    "message": "Order with ID O999 does not exist",
    "details": {
      "order_id": "O999"
    },
    "timestamp": "2024-01-30T10:30:00Z"
  }
}
```

**Common Error Codes:**
- `INVALID_REQUEST`: Malformed request body
- `ORDER_NOT_FOUND`: Order ID doesn't exist
- `DRIVER_NOT_FOUND`: Driver ID doesn't exist
- `UNAUTHORIZED`: Missing or invalid authentication
- `FORBIDDEN`: Insufficient permissions
- `CONFLICT`: Status transition not allowed
- `INTERNAL_ERROR`: Database or system error

### 4.2. WebSocket Error Messages

```json
{
  "type": "error",
  "code": "SUBSCRIPTION_FAILED",
  "message": "Driver D999 does not exist",
  "timestamp": "2024-01-30T10:30:00Z"
}
```

---

## 5. Rate Limiting

| Endpoint | Rate Limit | Window |
|----------|-----------|--------|
| POST /api/orders | 10 requests | 1 minute |
| GET /api/trips/:id/route | 5 requests | 1 minute |
| WebSocket connections | 5 connections | per IP |
| Other GET endpoints | 100 requests | 1 minute |

**Rate Limit Response (429 Too Many Requests):**
```json
{
  "error": {
    "code": "RATE_LIMIT_EXCEEDED",
    "message": "Too many requests. Retry after 60 seconds",
    "retry_after": 60
  }
}
```

---

## 6. Pagination

**Standard Pagination Parameters:**
- `limit`: Max results per page (default: 50, max: 100)
- `offset`: Number of results to skip (default: 0)

**Response Format:**
```json
{
  "total_count": 1234,
  "limit": 50,
  "offset": 0,
  "has_more": true,
  "data": [ /* ... */ ]
}
```

---

## 7. API Usage Examples

### 7.1. Complete Order Flow (Customer Perspective)

```javascript
// 1. Customer places order
const orderResponse = await fetch('http://localhost:8080/api/v1/orders', {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    customer_id: 'C456',
    restaurant_location: '10.762622,106.660172',
    delivery_location: '10.782345,106.695123'
  })
});
const order = await orderResponse.json();
console.log('Order created:', order.order_id);

// 2. Subscribe to driver updates via WebSocket
const ws = new WebSocket('ws://localhost:8080/ws/tracking');

ws.onopen = () => {
  ws.send(JSON.stringify({
    action: 'subscribe',
    driver_ids: [order.driver_id]
  }));
};

ws.onmessage = (event) => {
  const data = JSON.parse(event.data);

  switch (data.type) {
    case 'location_update':
      updateMapMarker(data.latitude, data.longitude);
      updateETA(data.eta_seconds);
      break;

    case 'alert':
      if (data.alert_type === 'PROXIMITY') {
        showNotification('Your driver is approaching!');
      }
      break;

    case 'status_update':
      updateOrderStatus(data.new_status);
      break;

    case 'trip_complete':
      showTripSummary(data.trip_cost, data.total_distance_km);
      break;
  }
};
```

### 7.2. Driver App Flow

```javascript
// 1. Driver accepts order
await fetch(`http://localhost:8080/api/v1/orders/${orderId}/status`, {
  method: 'PUT',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify({
    status: 'ACCEPTED',
    timestamp: new Date().toISOString()
  })
});

// 2. Driver marks as in transit
await fetch(`http://localhost:8080/api/v1/orders/${orderId}/status`, {
  method: 'PUT',
  body: JSON.stringify({ status: 'IN_TRANSIT' })
});

// 3. Driver completes delivery
await fetch(`http://localhost:8080/api/v1/orders/${orderId}/status`, {
  method: 'PUT',
  body: JSON.stringify({ status: 'DELIVERED' })
});

// 4. View trip summary
const trip = await fetch(`http://localhost:8080/api/v1/trips/${tripId}`);
console.log('Trip cost:', trip.trip_cost);
```

---

**End of API Specification**
