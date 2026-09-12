import js from "@eslint/js";
import eslintConfigPrettier from "eslint-config-prettier";
import turboPlugin from "eslint-plugin-turbo";
import tseslint from "typescript-eslint";
import onlyWarn from "eslint-plugin-only-warn";

/**
 * A shared ESLint configuration for the repository.
 *
 * @type {import("eslint").Linter.Config}
 * */
export const config = [
  js.configs.recommended,
  eslintConfigPrettier,
  ...tseslint.configs.recommended,
  {
    plugins: {
      turbo: turboPlugin,
    },
    rules: {
      "turbo/no-undeclared-env-vars": "warn",

      /**
       * Destructuring a key out in order to drop it leaves a binding nobody
       * reads, and that is the point of writing it: `const { incomplete: _,
       * ...rest } = row` is how a test says "the same record without this
       * field". The rest sibling is what marks it as an omission rather than
       * an oversight, which is exactly what this option keys on.
       *
       * Everything else the rule catches is left alone, including an unused
       * argument that nothing follows — the `_request` in the endpoints is
       * allowed by `args: "after-used"` and needs nothing from here.
       */
      "@typescript-eslint/no-unused-vars": [
        "warn",
        { ignoreRestSiblings: true },
      ],
    },
  },
  {
    plugins: {
      onlyWarn,
    },
  },
  {
    ignores: ["dist/**"],
  },
];
