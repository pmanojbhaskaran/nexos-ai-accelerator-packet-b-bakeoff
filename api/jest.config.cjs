/** @type {import("jest").Config} */
const path = require("path");

// Force CommonJS entry for otplib (package is "type":"module"; Jest otherwise loads ESM/@scure and fails).
let otplibCjs;
try {
  otplibCjs = require.resolve("otplib");
} catch {
  otplibCjs = path.join(__dirname, "node_modules", "otplib", "dist", "index.cjs");
}

module.exports = {
  modulePathIgnorePatterns: ["<rootDir>/_evidence/", "<rootDir>/dist/"],
  watchPathIgnorePatterns: ["<rootDir>/_evidence/"],
  testEnvironment: "node",
  testMatch: ["<rootDir>/test/**/*.spec.ts"],
  transform: {
    "^.+\\.(ts|tsx)$": [
      "ts-jest",
      {
        tsconfig: "<rootDir>/tsconfig.jest.json",
      },
    ],
  },
  transformIgnorePatterns: [
    "/node_modules/(?!(otplib|@otplib|@scure)/)",
  ],
  moduleNameMapper: {
    "^otplib$": otplibCjs,
    "^nexos-courier-shared$": "<rootDir>/../nexos-courier-shared/src/index.ts",
  },
  moduleFileExtensions: ["ts", "tsx", "js", "json"],
  clearMocks: true,
  collectCoverage: false,
};
