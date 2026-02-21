import {createNewLineReporter} from '../util.js'

/** @type {import('../shared/types').Rule} */
export default {
    "create": context => createNewLineReporter(
        "elements", "ArrayExpression", context),
    "meta": {
        "docs": {
            "category": "Stylistic Issues",
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
