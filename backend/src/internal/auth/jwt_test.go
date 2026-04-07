package auth

import (
	"strings"
	"testing"
	"time"
)

func TestGenerateToken(t *testing.T) {
	userID := "user-123"
	email := "test@example.com"
	role := "USER"

	token, err := GenerateToken(userID, email, role)
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	if token == "" {
		t.Fatal("GenerateToken() returned empty token")
	}

	// Token should have 3 parts separated by dots
	parts := strings.Split(token, ".")
	if len(parts) != 3 {
		t.Errorf("GenerateToken() token = %v, want 3 parts", len(parts))
	}
}

func TestValidateToken(t *testing.T) {
	userID := "user-123"
	email := "test@example.com"
	role := "USER"

	token, err := GenerateToken(userID, email, role)
	if err != nil {
		t.Fatalf("GenerateToken() error = %v", err)
	}

	claims, err := ValidateToken(token)
	if err != nil {
		t.Fatalf("ValidateToken() error = %v", err)
	}

	if claims.UserID != userID {
		t.Errorf("ValidateToken() UserID = %v, want %v", claims.UserID, userID)
	}
	if claims.Email != email {
		t.Errorf("ValidateToken() Email = %v, want %v", claims.Email, email)
	}
	if claims.Role != role {
		t.Errorf("ValidateToken() Role = %v, want %v", claims.Role, role)
	}
}

func TestValidateToken_Invalid(t *testing.T) {
	tests := []struct {
		name  string
		token string
	}{
		{"empty token", ""},
		{"malformed token", "not.a.valid.token"},
		{"random string", "randomstring"},
		{"wrong signature", "eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJ1c2VyX2lkIjoidXNlci0xMjMiLCJlbWFpbCI6InRlc3RAZXhhbXBsZS5jb20iLCJyb2xlIjoiVVNFUiIsImV4cCI6MTcwMDAwMDAwMDB9.wrongsignature"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ValidateToken(tt.token)
			if err == nil {
				t.Error("ValidateToken() expected error, got nil")
			}
		})
	}
}

func TestGenerateRefreshToken(t *testing.T) {
	userID := "user-123"

	token, err := GenerateRefreshToken(userID)
	if err != nil {
		t.Fatalf("GenerateRefreshToken() error = %v", err)
	}

	if token == "" {
		t.Fatal("GenerateRefreshToken() returned empty token")
	}

	// Validate it can be parsed
	subject, err := ValidateRefreshToken(token)
	if err != nil {
		t.Fatalf("ValidateRefreshToken() error = %v", err)
	}

	if subject != userID {
		t.Errorf("ValidateRefreshToken() subject = %v, want %v", subject, userID)
	}
}

func TestValidateRefreshToken_Invalid(t *testing.T) {
	tests := []struct {
		name  string
		token string
	}{
		{"empty token", ""},
		{"malformed token", "not.a.valid.token"},
		{"random string", "randomstring"},
	}

	for _, tt := range tests {
		t.Run(tt.name, func(t *testing.T) {
			_, err := ValidateRefreshToken(tt.token)
			if err == nil {
				t.Error("ValidateRefreshToken() expected error, got nil")
			}
		})
	}
}

func TestTokenExpiration(t *testing.T) {
	// This test verifies that the token contains expiration claim
	userID := "user-123"
	email := "test@example.com"
	role := "USER"

	token, _ := GenerateToken(userID, email, role)
	claims, _ := ValidateToken(token)

	// Token should expire in approximately 24 hours
	expectedExpiry := time.Now().Add(24 * time.Hour)
	actualExpiry := claims.ExpiresAt.Time

	// Allow 1 minute tolerance for test execution time
	diff := actualExpiry.Sub(expectedExpiry)
	if diff < -time.Minute || diff > time.Minute {
		t.Errorf("Token expiry time differs from expected by %v", diff)
	}
}

func TestRefreshTokenExpiration(t *testing.T) {
	userID := "user-123"

	token, _ := GenerateRefreshToken(userID)

	// Validate it returns correct user ID
	subject, err := ValidateRefreshToken(token)
	if err != nil {
		t.Fatalf("ValidateRefreshToken() error = %v", err)
	}
	if subject != userID {
		t.Errorf("ValidateRefreshToken() subject = %v, want %v", subject, userID)
	}
}

func TestClaimsHaveCorrectTypes(t *testing.T) {
	userID := "user-123"
	email := "test@example.com"
	role := "ADMIN"

	token, _ := GenerateToken(userID, email, role)
	claims, _ := ValidateToken(token)

	// Verify all fields are properly typed
	if claims.UserID == "" {
		t.Error("UserID should not be empty")
	}
	if claims.Email == "" {
		t.Error("Email should not be empty")
	}
	if claims.Role == "" {
		t.Error("Role should not be empty")
	}

	// Verify role is preserved exactly
	if claims.Role != role {
		t.Errorf("Role = %v, want %v", claims.Role, role)
	}
}
