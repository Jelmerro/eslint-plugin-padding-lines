eslint-plugin-padding-lines
===========================

All the Eslint newline padding rules in one plugin

## Install

`npm i -D Jelmerro/eslint-plugin-padding-lines`

Add `padding-lines` to your Eslint config:

```js
import paddingLines from "eslint-plugin-padding-lines"

export default {
    "plugins": {
        "padding-lines": paddingLines
    },
    "rules": {
        "padding-lines/arrays": "error",
        "padding-lines/objects": "error",
        // This rule is deprecated, use the @stylistic one instead.
        // "padding-lines/statements": "error"
    }
}
```

## padding-lines/arrays

Custom configuration of `arrays` can be set to either `always` or `never`,
by default set to `never`, so you can choose to make it always with:

```json
{
    "rules": {
        "padding-lines/arrays": ["error", "always"]
    }
}
```

## padding-lines/objects

Custom configuration of `objects` can be set to either `always` or `never`,
by default set to `never`, so you can choose to make it always with:

```json
{
    "rules": {
        "padding-lines/objects": ["error", "always"]
    }
}
```

## padding-lines/statements

This rule controls the padding between any statements.
Custom configuration of `statements` is exactly the same as the `padding-line-between-statements` Eslint rule,
for which you can find the [documentation here](https://eslint.org/docs/latest/rules/padding-line-between-statements).
The major difference is that this package supports arrow functions using `arrow`,
while Eslint [refused to add it](https://github.com/eslint/eslint/pull/16970) as they have deprecated stylistic rules.
Since by default this rule disallows any padding newline, you probably want to configure it.
In 2026, [@stylistic/padding-line-between-statements](https://eslint.style/rules/padding-line-between-statements) was given support for custom selectors,
hence the statements part is deprecated in favor of using an arrow selector like:
`VariableDeclaration[declarations.0.init.type='ArrowFunctionExpression']`
