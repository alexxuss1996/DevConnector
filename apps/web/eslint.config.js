// For more info, see https://github.com/storybookjs/eslint-plugin-storybook#configuration-flat-config-format
import storybook from "eslint-plugin-storybook";

import { nextJsConfig } from "@dev-conn/eslint-config/next-js";

/** @type {import("eslint").Linter.Config[]} */
export default [...nextJsConfig, ...storybook.configs["flat/recommended"]];
