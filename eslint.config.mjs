import stylistic from "@stylistic/eslint-plugin";
import nextVitals from "eslint-config-next/core-web-vitals";
import nextTypeScript from "eslint-config-next/typescript";
import { defineConfig, globalIgnores } from "eslint/config";

export default defineConfig([
    ...nextVitals,
    ...nextTypeScript,
    {
        files: ["**/*.{js,mjs,cjs,ts,mts,cts,jsx,tsx}"],
        plugins: {
            "@stylistic": stylistic,
        },
        rules: {
            "@stylistic/brace-style": ["error", "allman", { allowSingleLine: false }],
            "@stylistic/indent": ["error", 4, { SwitchCase: 1 }],
            "@stylistic/quotes": ["error", "double", { avoidEscape: true }],
            "@stylistic/semi": ["error", "always"],
            "curly": ["error", "all"],
            "no-console": ["error", { allow: ["error", "info", "warn"] }],
        },
    },
    globalIgnores([
        "**/.next/**",
        "**/coverage/**",
        "**/dist/**",
        "**/node_modules/**",
        "packages/ingestion/fixtures/raw/**",
    ]),
]);
