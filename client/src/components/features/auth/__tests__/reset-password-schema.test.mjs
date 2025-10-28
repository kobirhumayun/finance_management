import { resetSchema, PASSWORD_REQUIREMENTS_MESSAGE } from "../reset-password-schema.mjs";

import { test } from "node:test";
import assert from "node:assert/strict";

const validData = {
  email: "user@example.com",
  otp: "123456",
  newPassword: "Password1!",
  confirmPassword: "Password1!",
};

test("accepts valid reset payloads", () => {
  assert.doesNotThrow(() => resetSchema.parse(validData));
});

test("rejects mismatched passwords", () => {
  const result = resetSchema.safeParse({
    ...validData,
    confirmPassword: "Password1?",
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.issues?.[0]?.path?.[0], "confirmPassword");
});

test("enforces strong password requirements", () => {
  const result = resetSchema.safeParse({
    ...validData,
    newPassword: "weakpass",
    confirmPassword: "weakpass",
  });

  assert.equal(result.success, false);
  assert.equal(result.error?.issues?.[0]?.message, PASSWORD_REQUIREMENTS_MESSAGE);
});
