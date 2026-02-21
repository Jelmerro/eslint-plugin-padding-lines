import {createNewLineReporter} from '../util.js'

/** @type {import('../shared/types').Rule} */
export default {
    "create": context => createNewLineReporter(
        "properties", "ObjectExpression", context),
    "meta": {
        "docs": {
            "category": "Stylistic Issues",
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
