import js from "@eslint/js";
import react from "eslint-plugin-react";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";

export default [
    // Ignore built / vendored directories
    {
        ignores: ["vendor/**", "node_modules/**", "public/**"],
    },

    // Base recommended rules
    js.configs.recommended,

    // React + React-Hooks configuration for JSX files
    {
        files: ["resources/js/**/*.{js,jsx}"],
        plugins: {
            react,
            "react-hooks": reactHooks,
        },
        languageOptions: {
            sourceType: "module",
            globals: {
                ...globals.browser,
            },
            parserOptions: {
                ecmaFeatures: { jsx: true },
            },
        },
        settings: {
            react: { version: "detect" },
        },
        rules: {
            // Warn on unused variables, but allow _ prefix for intentionally unused ones
            "no-unused-vars": [
                "warn",
                { argsIgnorePattern: "^_", varsIgnorePattern: "^_" },
            ],

            // React hooks
            "react-hooks/rules-of-hooks": "error",
            "react-hooks/exhaustive-deps": "warn",

            // React JSX — not needed with the new JSX transform, but safe to keep
            "react/react-in-jsx-scope": "off",
        },
    },
];
