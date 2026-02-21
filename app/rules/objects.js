import {createNewLineReporter} from "../util.js"

/** @type {import('eslint').Rule.RuleModule} */
export default {
    "create": context => createNewLineReporter("ObjectExpression", context),
    "meta": {
        "docs": {
            "description": "Control padding lines between objects",
            "recommended": true,
            "url": "https://github.com/Jelmerro/eslint-plugin-padding-lines"
        },
        "fixable": "whitespace",
        "messages": {
            "always": "Expected blank line between object props.",
            "never": "Unexpected blank line between object props."
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
