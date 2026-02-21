const LINEBREAKS = new Set(["\r\n", "\r", "\n", "\u2028", "\u2029"])
const LT = `[${[...LINEBREAKS].join("")}]`
const PADDING_LINE_SEQUENCE = new RegExp(
    String.raw`^(\s*?${LT})\s*${LT}(\s*;?)$`, "u")
const CJS_EXPORT = /^(?:module\s*\.\s*)?exports(?:\s*\.|\s*\[|$)/u
const CJS_IMPORT = /^require\(/u
const STATEMENT_LIST_PARENTS = new Set(
    ["BlockStatement", "Program", "StaticBlock", "SwitchCase"]
)
const anyFunctionPattern = /^(?:Function(?:Declaration|Expression)|ArrowFunctionExpression)$/u

/**
 * Retrieve `expression` value if the given node a `ChainExpression` node.
 * Otherwise, pass through it.
 * @param {import('estree').Node} node - The node to address.
 * @returns {import('estree').Node} The node or the sub-expression.
 */
const skipChainExpression = node => {
    if (node && node.type === "ChainExpression") {
        return node.expression
    }
    return node
}

/**
 * Checks if the given token is a semicolon token or not.
 * @param {import('eslint').AST.Token} token - The token to check.
 * @returns {boolean} `true` if the token is a semicolon token.
 */
const isSemicolonToken = token => token.value === ";"
    && token.type === "Punctuator"

/**
 * Checks if the given token is a semicolon token or not.
 * @param {import('eslint').AST.Token} token - The token to check.
 * @returns {boolean} `true` if the token is a semicolon token.
 */
const isNotSemicolonToken = token => !isSemicolonToken(token)

/**
 * Checks if the given token is a closing brace token or not.
 * @param {import('eslint').AST.Token} token - The token to check.
 * @returns {boolean} `true` if the token is a closing brace token.
 */
const isClosingBraceToken = token => token.value === "}"
    && token.type === "Punctuator"

/**
 * Determines if a node is surrounded by parentheses.
 * @param {import('eslint').SourceCode} sourceCode - The source code object.
 * @param {import('estree').Node} node - The node to be checked.
 * @returns {boolean} True if the node is parenthesised.
 * @private
 */
const isParenthesised = (sourceCode, node) => {
    const previousToken = sourceCode.getTokenBefore(node)
    const nextToken = sourceCode.getTokenAfter(node)
    return !!previousToken && !!nextToken
        && previousToken.value === "("
        && previousToken.range[1] <= (node.range?.[0] ?? -1)
        && nextToken?.value === ")"
        && nextToken.range[0] >= (node.range?.[1] ?? -1)
}

/**
 * Determines whether two adjacent tokens are on the same line.
 * @param {import('eslint').AST.Token|import('estree').Comment} left
 * @param {import('eslint').AST.Token|import('estree').Comment} right
 * @returns {boolean} Whether or not the tokens are on the same line.
 * @public
 */
const isTokenOnSameLine = (
    left, right) => left.loc?.end.line === right.loc?.start.line

/**
 * Checks whether a given node is a function node or not.
 * The following types are function nodes:
 *
 * - ArrowFunctionExpression
 * - FunctionDeclaration
 * - FunctionExpression.
 * @param {import('estree').Node|null} node - A node to check.
 * @returns {boolean} `true` if the node is a function node.
 */
const isFunction = node => Boolean(
    node && anyFunctionPattern.test(node.type))

/**
 * Creates tester which check if a node starts with specific keyword.
 * @param {string} keyword - The keyword to test.
 * @returns {object} The created tester.
 * @private
 */
const newKeywordTester = keyword => ({
    "test": (node, sourceCode) => sourceCode
        .getFirstToken(node).value === keyword
})

/**
 * Creates tester which check if:
 * a node starts with specific keyword and spans a single line.
 * @param {string} keyword - The keyword to test.
 * @returns {object} The created tester.
 * @private
 */
const newSinglelineKeywordTester = keyword => ({
    "test": (node, sourceCode) => node.loc.start.line === node.loc.end.line
            && sourceCode.getFirstToken(node).value === keyword
})

/**
 * Creates tester which check if:
 * a node starts with specific keyword and spans multiple lines.
 * @param {string} keyword - The keyword to test.
 * @returns {object} The created tester.
 * @private
 */
const newMultilineKeywordTester = keyword => ({
    "test": (node, sourceCode) => node.loc.start.line !== node.loc.end.line
            && sourceCode.getFirstToken(node).value === keyword
})

/**
 * Creates tester which check if a node is specific type.
 * @param {string} type - The node type to test.
 * @returns {object} The created tester.
 * @private
 */
const newNodeTypeTester = type => ({"test": node => node.type === type})

/**
 * Checks the given node is an expression statement of IIFE.
 * @param {import('estree').Node} node - The node to check.
 * @returns {boolean} `true` if the node is an expression statement of IIFE.
 * @private
 */
const isIIFEStatement = node => {
    if (node.type === "ExpressionStatement") {
        let call = skipChainExpression(node.expression)
        if (call.type === "UnaryExpression") {
            call = skipChainExpression(call.argument)
        }
        return call.type === "CallExpression" && isFunction(call.callee)
    }
    return false
}

/**
 * Checks whether the given node is a block-like statement.
 * This checks the last token of the node is the closing brace of a block.
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').Node} node - The node to check.
 * @returns {boolean} `true` if the node is a block-like statement.
 * @private
 */
const isBlockLikeStatement = (sourceCode, node) => {
    // Do-while with a block is a block-like statement.
    if (node.type === "DoWhileStatement"
        && node.body.type === "BlockStatement") {
        return true
    }
    /*
     * IIFE is a block-like statement specially from
     * JSCS#disallowPaddingNewLinesAfterBlocks.
     */
    if (isIIFEStatement(node)) {
        return true
    }
    // Checks the last token is a closing brace of blocks.
    const lastToken = sourceCode.getLastToken(node, isNotSemicolonToken)
    let belongingNode = null
    if (lastToken && isClosingBraceToken(lastToken)) {
        belongingNode = sourceCode.getNodeByRangeIndex(lastToken.range[0])
    }
    return !!belongingNode && (
        belongingNode.type === "BlockStatement"
        || belongingNode.type === "SwitchStatement"
    )
}

/**
 * Checks whether the given node is an arrow function.
 * @param {import('estree').Node} node - The node to check.
 * @returns {boolean} `true` if the node is a arrow-function statement.
 * @private
 */
const isArrowFuntion = node => {
    if (
        node !== null
        && node.type === "VariableDeclaration"
        && node.declarations[0].init !== null
        && node.declarations[0].init?.type === "ArrowFunctionExpression"
    ) {
        return true
    }
    return false
}

/**
 * Check whether the given node is a directive or not.
 * @param {import('estree').Node} node - The node to check.
 * @param {import('eslint').SourceCode} sourceCode
 * @returns {boolean} `true` if the node is a directive.
 */
const isDirective = (node, sourceCode) => node.type === "ExpressionStatement"
    && (node.parent.type === "Program" || node.parent.type === "BlockStatement"
        && isFunction(node.parent.parent))
    && node.expression.type === "Literal"
    && typeof node.expression.value === "string"
    && !isParenthesised(sourceCode, node.expression)

/**
 * Check whether the given node is a part of directive prologue or not.
 * @param {import('estree').Node} node
 * @param {import('eslint').SourceCode} sourceCode
 * @returns {boolean} `true` if the node is a part of directive prologue.
 */
const isDirectivePrologue = (node, sourceCode) => {
    if (isDirective(node, sourceCode)) {
        for (const sibling of node.parent.body) {
            if (sibling === node) {
                break
            }
            if (!isDirective(sibling, sourceCode)) {
                return false
            }
        }
        return true
    }
    return false
}

/**
 * Gets the actual last token.
 *
 * If a semicolon is semicolon-less style's semicolon, this ignores it.
 * For example:
 *
 *     foo()
 *     ;[1, 2, 3].forEach(bar).
 * @param {import('eslint').SourceCode} sourceCode
 * @param {import('estree').Node} node - The node to get.
 * @returns {import('eslint').AST.Token} The last token base on code and node.
 * @private
 */
const getActualLastToken = (sourceCode, node) => {
    const semiToken = sourceCode.getLastToken(node)
    const prevToken = sourceCode.getTokenBefore(semiToken)
    const nextToken = sourceCode.getTokenAfter(semiToken)
    const isSemicolonLessStyle = Boolean(
        prevToken
        && nextToken
        && prevToken.range[0] >= node.range[0]
        && isSemicolonToken(semiToken)
        && semiToken.loc.start.line !== prevToken.loc.end.line
        && semiToken.loc.end.line === nextToken.loc.start.line
    )
    if (isSemicolonLessStyle) {
        return prevToken
    }
    return semiToken
}

/**
 * This returns the concatenation of the first 2 captured strings.
 * @param {string} _ - Unused. Whole matched string.
 * @param {string} trailingSpaces - The trailing spaces of the first line.
 * @param {string} indentSpaces - The indentation spaces of the last line.
 * @returns {string} The concatenation of trailingSpaces and indentSpaces.
 * @private
 */
const replacerToRemovePaddingLines = (
    _, trailingSpaces, indentSpaces) => trailingSpaces + indentSpaces

/**
 * Check and report statements for `any` configuration.
 * @returns {void}
 * @private
 */
const verifyForAny = () => {
    // This does nothing, but the reporter needs a function to call.
}

/**
 * Check and report statements for `never` configuration.
 * This autofix removes blank lines between the given 2 statements.
 * However, if comments exist between 2 blank lines, it does not remove those
 * blank lines automatically.
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('estree').Node} _ - Unused. The previous node to check.
 * @param {import('estree').Node} nextNode - The next node to check.
 * @param {Array<import('eslint').AST.Token[]>} paddingLines - The array of
 * token pairs that blank lines exist between the pair.
 * @returns {void}
 * @private
 */
const verifyForNever = (context, _, nextNode, paddingLines) => {
    if (paddingLines.length === 0) {
        return
    }
    context.report({
        "fix": fixer => {
            if (paddingLines.length >= 2) {
                return null
            }
            const [[prevToken, nextToken]] = paddingLines
            const [, start] = prevToken.range
            const [end] = nextToken.range
            const text = context.sourceCode.text
                .slice(start, end)
                .replace(PADDING_LINE_SEQUENCE, replacerToRemovePaddingLines)
            return fixer.replaceTextRange([start, end], text)
        },
        "messageId": "unexpectedBlankLine",
        "node": nextNode
    })
}

/**
 * Check and report statements for `always` configuration.
 * This autofix inserts a blank line between the given 2 statements.
 * If the `prevNode` has trailing comments, it inserts a blank line after the
 * trailing comments.
 * @param {import('eslint').Rule.RuleContext} context
 * @param {import('estree').Node} prevNode - The previous node to check.
 * @param {import('estree').Node} nextNode - The next node to check.
 * @param {Array<import('eslint').AST.Token[]>} paddingLines - The array of
 * token pairs that blank lines exist between the pair.
 * @returns {void}
 * @private
 */
const verifyForAlways = (context, prevNode, nextNode, paddingLines) => {
    if (paddingLines.length > 0) {
        return
    }
    context.report({
        "fix": fixer => {
            const {sourceCode} = context
            /** @type {import('eslint').AST.Token|import('estree').Comment} */
            let prevToken = getActualLastToken(sourceCode, prevNode)
            const nextToken = sourceCode.getFirstTokenBetween(
                prevToken,
                nextNode,
                {
                    /**
                     * Skip the trailing comments of the previous node.
                     * This adds a blank line after the last trailing comment.
                     *
                     * For example:
                     *
                     *     foo(); // trailing comment.
                     *     // comment.
                     *     Bar();
                     *
                     * Get fixed to:
                     *
                     *     foo(); // trailing comment.
                     *
                     *     // comment.
                     *     Bar();.
                     * @param {import('eslint').AST.Token|import('estree').Comment} token
                     * @returns {boolean} `true` if the comment is not trailing.
                     * @private
                     */
                    "filter": token => {
                        if (isTokenOnSameLine(prevToken, token)) {
                            prevToken = token
                            return false
                        }
                        return true
                    },
                    "includeComments": true
                }
            ) || nextNode
            let insertText = "\n"
            if (isTokenOnSameLine(prevToken, nextToken)) {
                insertText += "\n"
            }
            return fixer.insertTextAfter(prevToken, insertText)
        },
        "messageId": "expectedBlankLine",
        "node": nextNode
    })
}

/**
 * Types of blank lines.
 * `any`, `never`, and `always` are defined.
 * Those have `verify` method to check and report statements.
 * @private
 */
const PaddingTypes = {
    "always": {"verify": verifyForAlways},
    "any": {"verify": verifyForAny},
    "never": {"verify": verifyForNever}
}
/**
 * Types of statements.
 * Those have `test` method to check it matches to the given statement.
 * @private
 */
const StatementTypes = {
    "*": {"test": () => true},
    "arrow": {
        "test": node => isArrowFuntion(node)
    },
    "block": newNodeTypeTester("BlockStatement"),
    "block-like": {
        "test": (node, sourceCode) => isBlockLikeStatement(sourceCode, node)
    },
    "break": newKeywordTester("break"),
    "case": newKeywordTester("case"),
    "cjs-export": {
        "test": (node, sourceCode) => node.type === "ExpressionStatement"
            && node.expression.type === "AssignmentExpression"
            && CJS_EXPORT.test(sourceCode.getText(node.expression.left))
    },
    "cjs-import": {
        "test": (node, sourceCode) => node.type === "VariableDeclaration"
            && node.declarations.length > 0
            && Boolean(node.declarations[0].init)
            && CJS_IMPORT.test(sourceCode.getText(node.declarations[0].init))
    },
    "class": newKeywordTester("class"),
    "const": {
        "test": node => newKeywordTester("const") && !isArrowFuntion(node)
    },
    "continue": newKeywordTester("continue"),
    "debugger": newKeywordTester("debugger"),
    "default": newKeywordTester("default"),
    "directive": {
        "test": isDirectivePrologue
    },
    "do": newKeywordTester("do"),
    "empty": newNodeTypeTester("EmptyStatement"),
    "export": newKeywordTester("export"),
    "expression": {
        "test": (node, sourceCode) => node.type === "ExpressionStatement"
            && !isDirectivePrologue(node, sourceCode)
    },
    "for": newKeywordTester("for"),
    "function": newNodeTypeTester("FunctionDeclaration"),
    "if": newKeywordTester("if"),
    "iife": {
        "test": isIIFEStatement
    },
    "import": newKeywordTester("import"),
    "let": {
        "test": node => newKeywordTester("const") && !isArrowFuntion(node)
    },
    "multiline-block-like": {
        "test": (node, sourceCode) => node.loc.start.line !== node.loc.end.line
            && isBlockLikeStatement(sourceCode, node)
    },
    "multiline-const": newMultilineKeywordTester("const"),
    "multiline-expression": {
        "test": (node, sourceCode) => node.loc.start.line !== node.loc.end.line
            && node.type === "ExpressionStatement"
            && !isDirectivePrologue(node, sourceCode)
    },
    "multiline-let": newMultilineKeywordTester("let"),
    "multiline-var": newMultilineKeywordTester("var"),
    "return": newKeywordTester("return"),
    "singleline-const": newSinglelineKeywordTester("const"),
    "singleline-let": newSinglelineKeywordTester("let"),
    "singleline-var": newSinglelineKeywordTester("var"),
    "switch": newKeywordTester("switch"),
    "throw": newKeywordTester("throw"),
    "try": newKeywordTester("try"),
    "var": newKeywordTester("var"),
    "while": newKeywordTester("while"),
    "with": newKeywordTester("with")
}

/** @type {import('eslint').Rule.RuleModule} */
export default {
    "create": context => {
        const {sourceCode} = context
        const configureList = context.options || []
        let scopeInfo = null
        /**
         * Processes to enter to new scope.
         * This manages the current previous statement.
         * @returns {void}
         * @private
         */
        const enterScope = () => {
            scopeInfo = {
                "prevNode": null,
                "upper": scopeInfo
            }
        }
        /**
         * Processes to exit from the current scope.
         * @returns {void}
         * @private
         */
        const exitScope = () => {
            scopeInfo = scopeInfo.upper
        }
        /**
         * Checks whether the given node matches the given type.
         * @param {import('estree').Node} node - The statement node to check.
         * @param {string|string[]} type - The statement type to check.
         * @returns {boolean} `true` if the statement node matched the type.
         * @private
         */
        const match = (node, type) => {
            let innerStatementNode = node
            while (innerStatementNode.type === "LabeledStatement") {
                innerStatementNode = innerStatementNode.body
            }
            if (Array.isArray(type)) {
                return type.some(match.bind(null, innerStatementNode))
            }
            return StatementTypes[type].test(innerStatementNode, sourceCode)
        }
        /**
         * Finds the last matched configure from configureList.
         * @param {import('estree').Node} prevNode - The previous statement to match.
         * @param {import('estree').Node} nextNode - The current statement to match.
         * @returns {object} The tester of the last matched configure.
         * @private
         */
        const getPaddingType = (prevNode, nextNode) => {
            for (let i = configureList.length - 1; i >= 0; --i) {
                const configure = configureList[i]
                const matched
                    = match(prevNode, configure.prev)
                    && match(nextNode, configure.next)
                if (matched) {
                    return PaddingTypes[configure.blankLine]
                }
            }
            return PaddingTypes.any
        }
        /**
         * Gets padding line sequences between the given 2 statements.
         * Comments are separators of the padding line sequences.
         * @param {import('estree').Node} prevNode - The previous statement to count.
         * @param {import('estree').Node} nextNode - The current statement to count.
         * @returns {Array<import('eslint').AST.Token[]>} The array of token pairs.
         * @private
         */
        const getPaddingLineSequences = (prevNode, nextNode) => {
            const pairs = []
            let prevToken = getActualLastToken(sourceCode, prevNode)
            if (nextNode.loc.start.line - prevToken.loc.end.line >= 2) {
                do {
                    const token = sourceCode.getTokenAfter(
                        prevToken,
                        {"includeComments": true}
                    )
                    if (token.loc.start.line - prevToken.loc.end.line >= 2) {
                        pairs.push([prevToken, token])
                    }
                    prevToken = token
                } while (prevToken.range[0] < nextNode.range[0])
            }
            return pairs
        }
        /**
         * Verify padding lines between the given node and the previous node.
         * @param {import('estree').Node} node - The node to verify.
         * @returns {void}
         * @private
         */
        const verify = node => {
            const parentType = node.parent.type
            const validParent
                = STATEMENT_LIST_PARENTS.has(parentType)
                || parentType === "SwitchStatement"
            if (!validParent) {
                return
            }
            // Save this node as the current previous statement.
            const {prevNode} = scopeInfo
            // Verify.
            if (prevNode) {
                const type = getPaddingType(prevNode, node)
                const paddingLines = getPaddingLineSequences(prevNode, node)
                type.verify(context, prevNode, node, paddingLines)
            }
            scopeInfo.prevNode = node
        }
        /**
         * Verify padding lines between the given node and the previous node.
         * Then process to enter to new scope.
         * @param {import('estree').Node} node - The node to verify.
         * @returns {void}
         * @private
         */
        const verifyThenEnterScope = node => {
            verify(node)
            enterScope()
        }
        return {
            ":statement": verify,
            "BlockStatement": enterScope,
            "BlockStatement:exit": exitScope,
            "Program": enterScope,
            "Program:exit": exitScope,
            "StaticBlock": enterScope,
            "StaticBlock:exit": exitScope,
            "SwitchCase": verifyThenEnterScope,
            "SwitchCase:exit": exitScope,
            "SwitchStatement": enterScope,
            "SwitchStatement:exit": exitScope
        }
    },
    "meta": {
        "deprecated": {
            "replacedBy": [{
                "message": "Use the custom selector feature of the stylistic rule",
                "plugin": {
                    "name": "@stylistic/eslint-plugin",
                    "url": "https://eslint.style"
                },
                "rule": {
                    "name": "@stylistic/padding-line-between-statements",
                    "url": "https://eslint.style/rules/padding-line-between-statements"
                }
            }]
        },
        "docs": {
            "description": "Control padding lines between statements",
            "recommended": false,
            "url": "https://github.com/Jelmerro/eslint-plugin-padding-lines"
        },
        "fixable": "whitespace",
        "messages": {
            "expectedBlankLine": "Expected blank line above.",
            "unexpectedBlankLine": "Unexpected blank line above."
        },
        "schema": {
            "definitions": {
                "paddingType": {
                    "enum": Object.keys(PaddingTypes)
                },
                "statementType": {
                    "anyOf": [
                        {"enum": Object.keys(StatementTypes)},
                        {
                            "items": {"enum": Object.keys(StatementTypes)},
                            "minItems": 1,
                            "type": "array",
                            "uniqueItems": true
                        }
                    ]
                }
            },
            "items": {
                "additionalProperties": false,
                "properties": {
                    "blankLine": {"$ref": "#/definitions/paddingType"},
                    "next": {"$ref": "#/definitions/statementType"},
                    "prev": {"$ref": "#/definitions/statementType"}
                },
                "required": ["blankLine", "prev", "next"],
                "type": "object"
            },
            "type": "array"
        },
        "type": "layout"
    }
}
