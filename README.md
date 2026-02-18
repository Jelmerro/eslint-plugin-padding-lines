eslint-plugin-padding-lines
===========================

All the Eslint newline padding rules in one plugin

## Install

Install the package (either in `~` or in your project dir) using:

`npm i -D Jelmerro/eslint-plugin-padding-lines`

Add `padding-lines` to your Eslint config:

```json
{
    "plugins": [
        "padding-lines"
    ],
    "rules": {
        "padding-lines/objects": "error",
        "padding-lines/statements": "error"
    }
}
```

That's it!

(That is, if you don't want newlines anywhere, keep reading for configuration)

## Why

I wanted to also control padding newlines between arrow functions definitions,
and to control the padding newlines between objects (which are not statements in [Espree AST](https://github.com/eslint/espree)).
This package merely combines these padding rules into one convenience package,
as Eslint decided to close and reject any PR that improves stylistic rules.

## padding-lines/statements

This rule controls the padding between any statements.
Custom configuration of `statements` is exactly the same as the `padding-line-between-statements` Eslint rule,
for which you can find the [documentation here](https://eslint.org/docs/latest/rules/padding-line-between-statements).
The major difference is that this package supports arrow functions using `arrow`,
while Eslint [refused to add it](https://github.com/eslint/eslint/pull/16970) as they have deprecated stylistic rules.

Since by default this rule disallows any padding newline, you probably want to configure it.
Personally I like to use something like this to control the padding newlines:

```json
{
    "plugins": [
        "padding-lines"
    ],
    "rules": {
        "padding-lines/objects": "error",
        "padding-lines/statements": [
            "error",
            {
                "blankLine": "never",
                "next": "*",
                "prev": "*"
            },
            {
                "blankLine": "always",
                "next": [
                    "var",
                    "let",
                    "const"
                ],
                "prev": "directive"
            },
            {
                "blankLine": "always",
                "next": [
                    "var",
                    "let",
                    "const"
                ],
                "prev": "arrow"
            },
            {
                "blankLine": "always",
                "next": "arrow",
                "prev": "arrow"
            },
            {
                "blankLine": "always",
                "next": "arrow",
                "prev": [
                    "var",
                    "let",
                    "const"
                ]
            },
            {
                "blankLine": "any",
                "next": "*",
                "prev": [
                    "import",
                    "cjs-import"
                ]
            },
            {
                "blankLine": "always",
                "next": [
                    "export",
                    "cjs-export"
                ],
                "prev": "*"
            },
            {
                "blankLine": "always",
                "next": [
                    "export",
                    "cjs-export"
                ],
                "prev": [
                    "export",
                    "cjs-export"
                ]
            }
        ]
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
