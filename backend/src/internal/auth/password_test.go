package auth

import (
	"strings"
	"testing"
)

func TestHashPassword(t *testing.T) {
	password := "testpassword123"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	if hash == "" {
		t.Fatal("HashPassword() returned empty hash")
	}

	// Hash should start with bcrypt prefix
	if !strings.HasPrefix(hash, "$2") {
		t.Errorf("HashPassword() hash = %v, want prefix $2", hash)
	}
}

func TestHashPassword_DifferentHashes(t *testing.T) {
	password := "samepassword"
	hash1, _ := HashPassword(password)
	hash2, _ := HashPassword(password)

	// Same password should produce different hashes due to random salt
	if hash1 == hash2 {
		t.Error("HashPassword() same password should produce different hashes")
	}
}

func TestCheckPassword_Correct(t *testing.T) {
	password := "testpassword123"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	if !CheckPassword(password, hash) {
		t.Error("CheckPassword() should return true for correct password")
	}
}

func TestCheckPassword_Incorrect(t *testing.T) {
	password := "testpassword123"
	wrongPassword := "wrongpassword"
	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	if CheckPassword(wrongPassword, hash) {
		t.Error("CheckPassword() should return false for incorrect password")
	}
}

func TestCheckPassword_EmptyPassword(t *testing.T) {
	password := "testpassword123"
	hash, _ := HashPassword(password)

	// Empty password should not match
	if CheckPassword("", hash) {
		t.Error("CheckPassword() should return false for empty password")
	}
}

func TestCheckPassword_EmptyHash(t *testing.T) {
	// Empty hash should not match any password
	if CheckPassword("anypassword", "") {
		t.Error("CheckPassword() should return false for empty hash")
	}
}

func TestCheckPassword_InvalidHash(t *testing.T) {
	// Invalid bcrypt hash format should not match
	invalidHashes := []string{
		"notahash",
		"$1$abc",                   // MD5 crypt
		"$2$invalid",               // Invalid bcrypt
		"$2a$10$toolongbase64==",   // Malformed
	}

	for _, hash := range invalidHashes {
		if CheckPassword("anypassword", hash) {
			t.Errorf("CheckPassword() should return false for invalid hash: %v", hash)
		}
	}
}

func TestHashPassword_LongPassword(t *testing.T) {
	// Test with a long password (close to bcrypt 72 byte limit)
	// 70 chars should work fine
	longPassword := strings.Repeat("a", 70)

	hash, err := HashPassword(longPassword)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	// Should verify correctly
	if !CheckPassword(longPassword, hash) {
		t.Error("CheckPassword() should return true for long password")
	}
}

func TestHashPassword_Unicode(t *testing.T) {
	// Test with unicode password
	unicodePassword := "пароль密码🔐"

	hash, err := HashPassword(unicodePassword)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	if !CheckPassword(unicodePassword, hash) {
		t.Error("CheckPassword() should return true for unicode password")
	}
}

func TestCheckPassword_SpecialChars(t *testing.T) {
	password := "p@$$w0rd!#$%^&*()_+-=[]{}|;':\",./<>?"

	hash, err := HashPassword(password)
	if err != nil {
		t.Fatalf("HashPassword() error = %v", err)
	}

	if !CheckPassword(password, hash) {
		t.Error("CheckPassword() should return true for password with special characters")
	}

	if CheckPassword("wrong" + password, hash) {
		t.Error("CheckPassword() should return false for wrong password with special chars")
	}
}
