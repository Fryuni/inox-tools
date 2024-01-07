import { test, expect } from "vitest";
import { inspectValue } from "./inspectCode.js";

test('null value', () => {
  expect(inspectValue({})).toStrictEqual({});
});

