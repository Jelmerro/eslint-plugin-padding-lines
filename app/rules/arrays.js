import {createNewLineReporter} from "../util.js"

/** @type {import('eslint').Rule.RuleModule} */
export default {
    "create": context => createNewLineReporter("ArrayExpression", context),
    "meta": {
        "docs": {
            "description": "Control padding lines between arrays",
            "recommended": true,
            "url": "https://github.com/Jelmerro/eslint-plugin-padding-lines"
        },
        "fixable": "whitespace",
        "messages": {
            "always": "Expected blank line between array elements.",
            "never": "Unexpected blank line between array elements."
        },
        "schema": [
            {"enum": ["always", "never"]},
            {
                "additionalProperties": false,
                "type": "object"
            }
        ],
        "type": "layout"
    }
}
