import assert from "node:assert/strict";
import { test } from "node:test";
import { resetSchema, PASSWORD_REQUIREMENTS_MESSAGE } from "../reset-password-schema.js";

const basePayload = {
  email: "user@example.com",
  otp: "123456",
};

test("rejects weak passwords that do not meet complexity requirements", () => {
  const result = resetSchema.safeParse({
    ...basePayload,
    newPassword: "password1",
    confirmPassword: "password1",
  });

  assert.equal(result.success, false);
  const formatted = result.error.format();
  assert.deepEqual(formatted.newPassword?._errors, [PASSWORD_REQUIREMENTS_MESSAGE]);
});

test("accepts strong passwords that meet all complexity requirements", () => {
  const result = resetSchema.safeParse({
    ...basePayload,
    newPassword: "Str0ng!Pass",
    confirmPassword: "Str0ng!Pass",
  });

  assert.equal(result.success, true);
});
