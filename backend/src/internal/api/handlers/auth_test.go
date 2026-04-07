package handlers

import (
	"bytes"
	"context"
	"encoding/json"
	"fmt"
	"net/http"
	"net/http/httptest"
	"testing"

	"delivery-tracking/internal/auth"

	"github.com/gin-gonic/gin"
)

// mockPGClient implements postgres.PGClient for testing
type mockPGClient struct {
	queryFunc       func(ctx context.Context, sql string, args ...interface{}) ([][]interface{}, error)
	queryRowFunc    func(ctx context.Context, sql string, args ...interface{}) ([]interface{}, error)
	execFunc        func(ctx context.Context, sql string, args ...interface{}) error
}

func (m *mockPGClient) Query(ctx context.Context, sql string, args ...interface{}) ([][]interface{}, error) {
	if m.queryFunc != nil {
		return m.queryFunc(ctx, sql, args...)
	}
	return nil, nil
}

func (m *mockPGClient) QueryRow(ctx context.Context, sql string, args ...interface{}) ([]interface{}, error) {
	if m.queryRowFunc != nil {
		return m.queryRowFunc(ctx, sql, args...)
	}
	return nil, nil
}

func (m *mockPGClient) Exec(ctx context.Context, sql string, args ...interface{}) error {
	if m.execFunc != nil {
		return m.execFunc(ctx, sql, args...)
	}
	return nil
}

func init() {
	gin.SetMode(gin.TestMode)
}

func TestLogin_Success(t *testing.T) {
	// Create a bcrypt hash for "demo123"
	hash, _ := auth.HashPassword("demo123")

	mock := &mockPGClient{
		queryRowFunc: func(ctx context.Context, sql string, args ...interface{}) ([]interface{}, error) {
			return []interface{}{
				"user-123",           // id
				"test@example.com",   // email
				hash,                 // password_hash
				"USER",               // role
				"Test User",          // name
			}, nil
		},
	}

	handler := NewAuthHandlerWithClient(mock)

	body := `{"email":"test@example.com","password":"demo123"}`
	req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r := gin.New()
	r.POST("/api/auth/login", handler.Login)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Status = %v, want %v. Body: %v", w.Code, http.StatusOK, w.Body.String())
	}

	var resp LoginResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.AccessToken == "" {
		t.Error("AccessToken should not be empty")
	}
	if resp.RefreshToken == "" {
		t.Error("RefreshToken should not be empty")
	}
	if resp.User.Email != "test@example.com" {
		t.Errorf("User.Email = %v, want %v", resp.User.Email, "test@example.com")
	}
	if resp.User.Role != "USER" {
		t.Errorf("User.Role = %v, want %v", resp.User.Role, "USER")
	}
}

func TestLogin_InvalidJSON(t *testing.T) {
	mock := &mockPGClient{}
	handler := NewAuthHandlerWithClient(mock)

	req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBufferString("{invalid json}"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r := gin.New()
	r.POST("/api/auth/login", handler.Login)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Status = %v, want %v", w.Code, http.StatusBadRequest)
	}
}

func TestLogin_MissingEmail(t *testing.T) {
	mock := &mockPGClient{}
	handler := NewAuthHandlerWithClient(mock)

	body := `{"password":"demo123"}`
	req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r := gin.New()
	r.POST("/api/auth/login", handler.Login)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Status = %v, want %v", w.Code, http.StatusBadRequest)
	}
}

func TestLogin_UserNotFound(t *testing.T) {
	mock := &mockPGClient{
		queryRowFunc: func(ctx context.Context, sql string, args ...interface{}) ([]interface{}, error) {
			return nil, nil // user not found
		},
	}
	handler := NewAuthHandlerWithClient(mock)

	body := `{"email":"nonexistent@example.com","password":"demo123"}`
	req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r := gin.New()
	r.POST("/api/auth/login", handler.Login)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Status = %v, want %v", w.Code, http.StatusUnauthorized)
	}
}

func TestLogin_WrongPassword(t *testing.T) {
	hash, _ := auth.HashPassword("correctpassword")

	mock := &mockPGClient{
		queryRowFunc: func(ctx context.Context, sql string, args ...interface{}) ([]interface{}, error) {
			return []interface{}{
				"user-123",
				"test@example.com",
				hash,
				"USER",
				"Test User",
			}, nil
		},
	}
	handler := NewAuthHandlerWithClient(mock)

	body := `{"email":"test@example.com","password":"wrongpassword"}`
	req, _ := http.NewRequest("POST", "/api/auth/login", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r := gin.New()
	r.POST("/api/auth/login", handler.Login)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Status = %v, want %v", w.Code, http.StatusUnauthorized)
	}
}

func TestRegister_Success(t *testing.T) {
	mock := &mockPGClient{
		execFunc: func(ctx context.Context, sql string, args ...interface{}) error {
			return nil
		},
		queryRowFunc: func(ctx context.Context, sql string, args ...interface{}) ([]interface{}, error) {
			return []interface{}{"new-user-id"}, nil
		},
	}
	handler := NewAuthHandlerWithClient(mock)

	body := `{"email":"new@example.com","password":"password123","name":"New User","phone":"123456"}`
	req, _ := http.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r := gin.New()
	r.POST("/api/auth/register", handler.Register)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusCreated {
		t.Errorf("Status = %v, want %v. Body: %v", w.Code, http.StatusCreated, w.Body.String())
	}

	var resp LoginResponse
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.AccessToken == "" {
		t.Error("AccessToken should not be empty")
	}
	if resp.User.Email != "new@example.com" {
		t.Errorf("User.Email = %v, want %v", resp.User.Email, "new@example.com")
	}
	if resp.User.Role != "USER" {
		t.Errorf("User.Role = %v, want %v", resp.User.Role, "USER")
	}
}

func TestRegister_EmailExists(t *testing.T) {
	mock := &mockPGClient{
		execFunc: func(ctx context.Context, sql string, args ...interface{}) error {
			return fmt.Errorf("duplicate key")
		},
	}
	handler := NewAuthHandlerWithClient(mock)

	body := `{"email":"existing@example.com","password":"password123","name":"Test User"}`
	req, _ := http.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r := gin.New()
	r.POST("/api/auth/register", handler.Register)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Status = %v, want %v", w.Code, http.StatusBadRequest)
	}
}

func TestRegister_InvalidJSON(t *testing.T) {
	mock := &mockPGClient{}
	handler := NewAuthHandlerWithClient(mock)

	req, _ := http.NewRequest("POST", "/api/auth/register", bytes.NewBufferString("{invalid}"))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r := gin.New()
	r.POST("/api/auth/register", handler.Register)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Status = %v, want %v", w.Code, http.StatusBadRequest)
	}
}

func TestRegister_PasswordTooShort(t *testing.T) {
	mock := &mockPGClient{}
	handler := NewAuthHandlerWithClient(mock)

	body := `{"email":"test@example.com","password":"12345","name":"Test User"}` // password < 6 chars
	req, _ := http.NewRequest("POST", "/api/auth/register", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r := gin.New()
	r.POST("/api/auth/register", handler.Register)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusBadRequest {
		t.Errorf("Status = %v, want %v", w.Code, http.StatusBadRequest)
	}
}

func TestRefresh_Success(t *testing.T) {
	mock := &mockPGClient{
		queryRowFunc: func(ctx context.Context, sql string, args ...interface{}) ([]interface{}, error) {
			return []interface{}{
				"user@example.com",
				"USER",
			}, nil
		},
	}
	handler := NewAuthHandlerWithClient(mock)

	// Generate a valid refresh token
	refreshToken, _ := auth.GenerateRefreshToken("user-123")

	body := `{"refresh_token":"` + refreshToken + `"}`
	req, _ := http.NewRequest("POST", "/api/auth/refresh", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r := gin.New()
	r.POST("/api/auth/refresh", handler.Refresh)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Status = %v, want %v. Body: %v", w.Code, http.StatusOK, w.Body.String())
	}

	var resp map[string]string
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp["access_token"] == "" {
		t.Error("access_token should not be empty")
	}
	if resp["refresh_token"] == "" {
		t.Error("refresh_token should not be empty")
	}
}

func TestRefresh_InvalidToken(t *testing.T) {
	mock := &mockPGClient{}
	handler := NewAuthHandlerWithClient(mock)

	body := `{"refresh_token":"invalid-token"}`
	req, _ := http.NewRequest("POST", "/api/auth/refresh", bytes.NewBufferString(body))
	req.Header.Set("Content-Type", "application/json")
	w := httptest.NewRecorder()

	r := gin.New()
	r.POST("/api/auth/refresh", handler.Refresh)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusUnauthorized {
		t.Errorf("Status = %v, want %v", w.Code, http.StatusUnauthorized)
	}
}

func TestMe_Success(t *testing.T) {
	mock := &mockPGClient{}
	handler := NewAuthHandlerWithClient(mock)

	req, _ := http.NewRequest("GET", "/api/auth/me", nil)
	w := httptest.NewRecorder()

	r := gin.New()
	r.Use(func(c *gin.Context) {
		c.Set("user_id", "user-123")
		c.Set("email", "test@example.com")
		c.Set("role", "USER")
		c.Next()
	})
	r.GET("/api/auth/me", handler.Me)
	r.ServeHTTP(w, req)

	if w.Code != http.StatusOK {
		t.Errorf("Status = %v, want %v", w.Code, http.StatusOK)
	}

	var resp AuthUser
	json.Unmarshal(w.Body.Bytes(), &resp)

	if resp.ID != "user-123" {
		t.Errorf("ID = %v, want %v", resp.ID, "user-123")
	}
	if resp.Email != "test@example.com" {
		t.Errorf("Email = %v, want %v", resp.Email, "test@example.com")
	}
	if resp.Role != "USER" {
		t.Errorf("Role = %v, want %v", resp.Role, "USER")
	}
}
