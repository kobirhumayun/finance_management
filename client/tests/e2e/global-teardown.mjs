import { resetE2ETestData } from "./reset-test-data.mjs";

export default async function globalTeardown() {
  await resetE2ETestData("global-teardown");
}
