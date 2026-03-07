"use strict";

const { describe, it } = require("node:test");
const assert = require("node:assert/strict");
const {
  validateEmail,
  validatePassword,
  validateName,
  validateSignup,
  validateLogin,
} = require("../validators");

describe("validateEmail", () => {
  it("accepts valid emails", () => {
    assert.equal(validateEmail("user@example.com"), null);
    assert.equal(validateEmail("user+tag@sub.domain.io"), null);
  });
  it("rejects missing email", () => {
    assert.ok(validateEmail(null));
    assert.ok(validateEmail(""));
  });
  it("rejects malformed emails", () => {
    assert.ok(validateEmail("notanemail"));
    assert.ok(validateEmail("@nodomain"));
    assert.ok(validateEmail("missing@"));
  });
});

describe("validatePassword", () => {
  it("accepts strong passwords", () => {
    assert.equal(validatePassword("StrongPass1"), null);
    assert.equal(validatePassword("Abc12345"), null);
  });
  it("rejects short passwords", () => {
    assert.ok(validatePassword("Short1"));
  });
  it("rejects passwords without uppercase", () => {
    assert.ok(validatePassword("alllowercase1"));
  });
  it("rejects passwords without numbers", () => {
    assert.ok(validatePassword("NoNumbers"));
  });
  it("rejects missing password", () => {
    assert.ok(validatePassword(null));
  });
});

describe("validateName", () => {
  it("accepts valid names", () => {
    assert.equal(validateName("Alice"), null);
    assert.equal(validateName("Jo"), null);
  });
  it("rejects short names", () => {
    assert.ok(validateName("A"));
  });
  it("rejects missing names", () => {
    assert.ok(validateName(null));
    assert.ok(validateName(""));
  });
  it("rejects names over 100 chars", () => {
    assert.ok(validateName("A".repeat(101)));
  });
});

describe("validateSignup", () => {
  it("returns null for valid data", () => {
    assert.equal(
      validateSignup({
        email: "a@b.com",
        password: "StrongPass1",
        name: "Alice",
      }),
      null,
    );
  });
  it("returns first error encountered", () => {
    assert.ok(
      validateSignup({ email: "bad", password: "StrongPass1", name: "Alice" }),
    );
    assert.ok(
      validateSignup({ email: "a@b.com", password: "weak", name: "Alice" }),
    );
    assert.ok(
      validateSignup({ email: "a@b.com", password: "StrongPass1", name: "A" }),
    );
  });
});

describe("validateLogin", () => {
  it("returns null for valid data", () => {
    assert.equal(
      validateLogin({ email: "a@b.com", password: "anything" }),
      null,
    );
  });
  it("rejects missing fields", () => {
    assert.ok(validateLogin({ email: "", password: "x" }));
    assert.ok(validateLogin({ email: "a@b.com", password: "" }));
  });
});
