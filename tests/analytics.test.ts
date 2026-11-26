import test from "node:test";
import assert from "node:assert/strict";
import { isValidElement } from "react";
import { GoogleAnalytics } from "@next/third-parties/google";
import { Analytics } from "../src/components/analytics";

test("GA4 renders only when a measurement ID is configured", () => {
  const element = Analytics({ measurementId: "G-TEST123" });
  assert.ok(isValidElement(element));
  assert.equal(element.type, GoogleAnalytics);
  assert.deepEqual(element.props, { gaId: "G-TEST123" });

  assert.equal(Analytics({ measurementId: undefined }), null);
  assert.equal(Analytics({ measurementId: "" }), null);
  assert.equal(Analytics({ measurementId: "   " }), null);
});
