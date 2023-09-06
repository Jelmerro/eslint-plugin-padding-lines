eslint-plugin-padding-lines
===========================

### All the Eslint newline padding rules in one plugin

# Installation

Install the package (either in `~` or in your project dir) using:

`npm i -D git+https://github.com/Jelmerro/eslint-plugin-padding-lines.git`

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

# Why

I wanted to also control padding newlines between arrow functions definitions,
and to control the padding newlines between objects (which are not statements in [Espree AST](https://github.com/eslint/espree)).
This package merely combines these padding rules into one convenience package,
as Eslint decided to close and reject any PR that improves stylistic rules.

## padding-lines/statements

This rule controls the padding between any statements.
Custom configuration of `statements` is exactly the same as the `padding-line-between-statements` Eslint rule,
for which you can find the [documentation here](https://eslint.org/docs/latest/rules/padding-line-between-statements).
The major difference is that this package supports arrow functions using `arrow`,
while Eslint [refuses to add that](https://github.com/eslint/eslint/pull/16970) as they hate stylistic rules.

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
                "blankLine": "any",
                "next": [
                    "export",
                    "cjs-export"
                ],
                "prev": "*"
            },
            {
                "blankLine": "never",
                "next": [
                    "import",
                    "cjs-import"
                ],
                "prev": [
                    "import",
                    "cjs-import"
                ]
            },
            {
                "blankLine": "never",
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

Since Eslint hate stylistic rules nowadays for whatever reason,
this was [rejected](https://github.com/eslint/eslint/issues/12948) from addition to main Eslint.

# LICENSE

This package is based on a lot of different sources and refined to work properly,
all of which are licensed under the MIT license, as which I also pulish my modifications to it.
For exact author information, please refer to the LICENSE.
Special thanks to:

- [DockYard](https://github.com/DockYard/eslint-plugin-ember-suave/) for creating the object padding rule
- [Bavly Abdelmasih](https://github.com/eslint/eslint/pull/16970) for adding the arrow option to the existing rule

While their code has been rewritten to solve some code and stylistic issues,
without them this package would probably not exist.
