const assert = require("assert");
const fs = require("fs");
const path = require("path");

const source = fs.readFileSync(
  path.join(__dirname, "..", "app", "components", "admin", "ProjectsModule.tsx"),
  "utf8"
);

function includes(snippet, message) {
  assert(source.includes(snippet), message);
}

includes("No registered customers found", "selector should show a no-results state");
includes("Use as Manual Customer", "selector should offer manual fallback when search has no results");
includes("Clear selected customer", "selector should allow clearing a linked customer");
includes("No saved address. Enter a project address manually below.", "selected customers without addresses should be supported");
includes("setCustomerQuery(\"\")", "selecting a customer should not leave typed query looking selected");
includes("customerId: null", "clear/manual flows should remove registered customer linkage");
includes("highlightMatch", "selector results should highlight direct text matches");
includes("customer.customerId", "result selection should use the customer result id");

console.log("Project customer selector UI source checks passed.");
