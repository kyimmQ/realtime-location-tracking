package handlers

import (
	"delivery-tracking/internal/auth"
	"delivery-tracking/internal/postgres"
	"net/http"

	"github.com/gin-gonic/gin"
)

type AuthHandler struct {
	pg postgres.PGClient
}

func NewAuthHandler() *AuthHandler {
	return &AuthHandler{pg: postgres.Get()}
}

// NewAuthHandlerWithClient creates an AuthHandler with a custom PGClient (for testing)
func NewAuthHandlerWithClient(pg postgres.PGClient) *AuthHandler {
	return &AuthHandler{pg: pg}
}

type LoginRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required"`
}

type LoginResponse struct {
	AccessToken  string   `json:"access_token"`
	RefreshToken string   `json:"refresh_token"`
	User         AuthUser `json:"user"`
}

type RegisterRequest struct {
	Email    string `json:"email" binding:"required,email"`
	Password string `json:"password" binding:"required,min=6"`
	Name     string `json:"name" binding:"required"`
	Phone    string `json:"phone"`
}

// AuthUser is the user payload returned in auth responses.
// Named AuthUser to avoid collision with postgres.User.
type AuthUser struct {
	ID    string `json:"id"`
	Email string `json:"email"`
	Role  string `json:"role"`
	Name  string `json:"name"`
}

func (h *AuthHandler) Login(c *gin.Context) {
	var req LoginRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	pg := h.pg
	row, err := pg.QueryRow(c.Request.Context(),
		"SELECT id::text, email, password_hash, role, name FROM users WHERE email = $1", req.Email)
	if err != nil || row == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	userID := row[0].(string)
	storedHash := row[2].(string)
	role := row[3].(string)
	name := row[4].(string)

	if !auth.CheckPassword(req.Password, storedHash) {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid credentials"})
		return
	}

	accessToken, err := auth.GenerateToken(userID, req.Email, role)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate token"})
		return
	}

	refreshToken, err := auth.GenerateRefreshToken(userID)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to generate refresh token"})
		return
	}

	c.JSON(http.StatusOK, LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User: AuthUser{
			ID:    userID,
			Email: req.Email,
			Role:  role,
			Name:  name,
		},
	})
}

func (h *AuthHandler) Register(c *gin.Context) {
	var req RegisterRequest
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	hash, err := auth.HashPassword(req.Password)
	if err != nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to hash password"})
		return
	}

	pg := h.pg
	var userID string
	err = pg.Exec(c.Request.Context(),
		`INSERT INTO users (email, password_hash, role, name, phone)
		 VALUES ($1, $2, 'USER', $3, $4)
		 RETURNING id::text`, req.Email, hash, req.Name, req.Phone)
	if err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": "email already exists"})
		return
	}
	// Get the inserted user's ID
	row, err := pg.QueryRow(c.Request.Context(),
		"SELECT id::text FROM users WHERE email = $1", req.Email)
	if err != nil || row == nil {
		c.JSON(http.StatusInternalServerError, gin.H{"error": "failed to retrieve user"})
		return
	}
	userID = row[0].(string)

	accessToken, _ := auth.GenerateToken(userID, req.Email, "USER")
	refreshToken, _ := auth.GenerateRefreshToken(userID)

	c.JSON(http.StatusCreated, LoginResponse{
		AccessToken:  accessToken,
		RefreshToken: refreshToken,
		User: AuthUser{
			ID:    userID,
			Email: req.Email,
			Role:  "USER",
			Name:  req.Name,
		},
	})
}

func (h *AuthHandler) Refresh(c *gin.Context) {
	var req struct {
		RefreshToken string `json:"refresh_token" binding:"required"`
	}
	if err := c.ShouldBindJSON(&req); err != nil {
		c.JSON(http.StatusBadRequest, gin.H{"error": err.Error()})
		return
	}

	userID, err := auth.ValidateRefreshToken(req.RefreshToken)
	if err != nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "invalid refresh token"})
		return
	}

	pg := h.pg
	row, err := pg.QueryRow(c.Request.Context(),
		"SELECT email, role FROM users WHERE id = $1", userID)
	if err != nil || row == nil {
		c.JSON(http.StatusUnauthorized, gin.H{"error": "user not found"})
		return
	}

	email := row[0].(string)
	role := row[1].(string)

	accessToken, _ := auth.GenerateToken(userID, email, role)
	newRefreshToken, _ := auth.GenerateRefreshToken(userID)

	c.JSON(http.StatusOK, gin.H{
		"access_token":  accessToken,
		"refresh_token": newRefreshToken,
	})
}

func (h *AuthHandler) Me(c *gin.Context) {
	userID, _ := c.Get("user_id")
	role, _ := c.Get("role")
	email, _ := c.Get("email")

	c.JSON(http.StatusOK, AuthUser{
		ID:    userID.(string),
		Email: email.(string),
		Role:  role.(string),
	})
}
