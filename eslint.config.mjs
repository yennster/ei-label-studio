import { defineConfig, globalIgnores } from "eslint/config";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTs from "eslint-config-next/typescript";

const eslintConfig = defineConfig([
  ...nextVitals,
  ...nextTs,
  // Override default ignores of eslint-config-next.
  globalIgnores([
    // Default ignores of eslint-config-next:
    ".next/**",
    "out/**",
    "build/**",
    "next-env.d.ts",
    // Vendored third-party code (the Label Studio bundle) must not be linted.
    "public/**",
  ]),
  {
    rules: {
      // React 19's newer hook rules flag deliberate, working patterns this app
      // relies on (latest-value ref updates during render; setState inside
      // effects for session hydration and sample loading). Keep them visible as
      // warnings rather than failing CI on long-standing patterns.
      "react-hooks/set-state-in-effect": "warn",
      "react-hooks/refs": "warn",
    },
  },
]);

export default eslintConfig;
