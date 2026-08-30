import js from "@eslint/js";
import tsParser from "@typescript-eslint/parser";
import importPluginX from "eslint-plugin-import-x";
import prettierPlugin from "eslint-plugin-prettier";
import reactPlugin from "eslint-plugin-react";
import unusedImportsPlugin from "eslint-plugin-unused-imports";
import globals from "globals";
import tseslint from "typescript-eslint";

export default [
  {
    ignores: ["**/node_modules/**", "**/dist/**", "**/build/**", "**/*.xml"],
  },

  {
    files: ["**/*.{js,jsx,ts,tsx}"],
    plugins: {
      react: reactPlugin,
      "@typescript-eslint": tseslint.plugin,
      "import-x": importPluginX,
      "unused-imports": unusedImportsPlugin,
      prettier: prettierPlugin,
    },
    languageOptions: {
      parser: tsParser,
      ecmaVersion: 11,
      sourceType: "module",
      parserOptions: {
        ecmaFeatures: {
          jsx: true,
        },
      },
      globals: {
        ...globals.browser,
        ...globals.node,
        ...globals.es2015,
        Atomics: "readonly",
        SharedArrayBuffer: "readonly",
      },
    },
    settings: {
      "import-x/resolver": {
        typescript: {
          alwaysTryTypes: true,
        },
        node: {
          extensions: [".js", ".jsx", ".ts", ".tsx"],
          moduleDirectory: ["node_modules", "src/"],
        },
      },
      react: {
        version: "17.0",
      },
    },
    rules: {
      ...js.configs.recommended.rules,
      ...reactPlugin.configs.recommended.rules,
      ...tseslint.configs.eslintRecommended.rules,
      ...importPluginX.configs.recommended.rules,
      "react/jsx-key": "off",
      "react/react-in-jsx-scope": "off",
      "no-useless-assignment": "off",
      "no-constant-binary-expression": "off",
      "no-var": "error",
      eqeqeq: ["error", "always", { null: "ignore" }],
      "react/jsx-curly-brace-presence": [
        "error",
        { props: "never", children: "always" },
      ],
      curly: ["error", "multi-line"],
      "no-unused-vars": "off",
      "@typescript-eslint/no-unused-vars": "off",
      "unused-imports/no-unused-imports": "error",
      "unused-imports/no-unused-vars": [
        "warn",
        {
          vars: "all",
          varsIgnorePattern: "^_",
          args: "after-used",
          argsIgnorePattern: "^_",
        },
      ],
      "import-x/no-relative-packages": "error",
      "import-x/no-unresolved": [
        "error",
        {
          ignore: ["\\.js$"],
        },
      ],
      "sort-imports": [
        "error",
        {
          ignoreDeclarationSort: true,
        },
      ],
      "import-x/order": [
        "error",
        {
          groups: [
            "index",
            "sibling",
            "parent",
            "internal",
            "external",
            "builtin",
            "object",
            "type",
          ],
          alphabetize: {
            order: "asc",
            caseInsensitive: true,
          },
        },
      ],
    },
  },

  {
    files: ["**/*.tsx"],
    rules: {
      "react/prop-types": "off",
    },
  },
];
