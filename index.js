"use strict"

const astUtils = require("./util")

const LT = `[${Array.from(astUtils.LINEBREAKS).join("")}]`
const PADDING_LINE_SEQUENCE = new RegExp(
    String.raw`^(\s*?${LT})\s*${LT}(\s*;?)$`, "u")
const CJS_EXPORT = /^(?:module\s*\.\s*)?exports(?:\s*\.|\s*\[|$)/u
const CJS_IMPORT = /^require\(/u

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
 * @param {ASTNode} node - The node to check.
 * @returns {boolean} `true` if the node is an expression statement of IIFE.
 * @private
 */
const isIIFEStatement = node => {
    if (node.type === "ExpressionStatement") {
        let call = astUtils.skipChainExpression(node.expression)
        if (call.type === "UnaryExpression") {
            call = astUtils.skipChainExpression(call.argument)
        }
        return call.type === "CallExpression"
            && astUtils.isFunction(call.callee)
    }
    return false
}

/**
 * Checks whether the given node is a block-like statement.
 * This checks the last token of the node is the closing brace of a block.
 * @param {SourceCode} sourceCode - The source code to get tokens.
 * @param {ASTNode} node - The node to check.
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
    const lastToken = sourceCode.getLastToken(
        node, astUtils.isNotSemicolonToken)
    let belongingNode = null
    if (lastToken && astUtils.isClosingBraceToken(lastToken)) {
        belongingNode = sourceCode.getNodeByRangeIndex(lastToken.range[0])
    }
    return Boolean(belongingNode) && (
        belongingNode.type === "BlockStatement"
        || belongingNode.type === "SwitchStatement"
    )
}

/**
 * Checks whether the given node is an arrow function.
 * @param {ASTNode} node - The node to check.
 * @returns {boolean} `true` if the node is a arrow-function statement.
 * @private
 */
const isArrowFuntion = node => {
    if (
        node !== null
        && node.type === "VariableDeclaration"
        && node.declarations[0].init !== null
        && node.declarations[0].init.type === "ArrowFunctionExpression"
    ) {
        return true
    }
    return false
}

/**
 * Check whether the given node is a directive or not.
 * @param {ASTNode} node - The node to check.
 * @param {SourceCode} sourceCode - The source code object to get tokens.
 * @returns {boolean} `true` if the node is a directive.
 */
const isDirective = (node, sourceCode) => node.type === "ExpressionStatement"
    && (node.parent.type === "Program" || node.parent.type === "BlockStatement"
        && astUtils.isFunction(node.parent.parent))
    && node.expression.type === "Literal"
    && typeof node.expression.value === "string"
    && !astUtils.isParenthesised(sourceCode, node.expression)


/**
 * Check whether the given node is a part of directive prologue or not.
 * @param {ASTNode} node - The node to check.
 * @param {SourceCode} sourceCode - The source code object to get tokens.
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
 * @param {SourceCode} sourceCode - The source code to get tokens.
 * @param {ASTNode} node - The node to get.
 * @returns {Token} The last token base on sourceCode and node provided.
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
        && astUtils.isSemicolonToken(semiToken)
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
 * It does nothing.
 * @returns {void}
 * @private
 */
const verifyForAny = () => undefined

/**
 * Check and report statements for `never` configuration.
 * This autofix removes blank lines between the given 2 statements.
 * However, if comments exist between 2 blank lines, it does not remove those
 * blank lines automatically.
 * @param {RuleContext} context - The rule context to report.
 * @param {ASTNode} _ - Unused. The previous node to check.
 * @param {ASTNode} nextNode - The next node to check.
 * @param {Array<Token[]>} paddingLines - The array of token pairs that blank
 * lines exist between the pair.
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
            const text = context.getSourceCode().text
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
 * @param {RuleContext} context - The rule context to report.
 * @param {ASTNode} prevNode - The previous node to check.
 * @param {ASTNode} nextNode - The next node to check.
 * @param {Array<Token[]>} paddingLines - The array of token pairs that blank
 * lines exist between the pair.
 * @returns {void}
 * @private
 */
const verifyForAlways = (context, prevNode, nextNode, paddingLines) => {
    if (paddingLines.length > 0) {
        return
    }
    context.report({
        "fix": fixer => {
            const sourceCode = context.getSourceCode()
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
                     * @param {Token} token - The token to check.
                     * @returns {boolean} `true` if the comment is not trailing.
                     * @private
                     */
                    "filter": token => {
                        if (astUtils.isTokenOnSameLine(prevToken, token)) {
                            prevToken = token
                            return false
                        }
                        return true
                    },
                    "includeComments": true
                }
            ) || nextNode
            let insertText = "\n"
            if (astUtils.isTokenOnSameLine(prevToken, nextToken)) {
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
/** @type {import('../shared/types').Rule} */
const statementsRule = {
    "create": context => {
        const sourceCode = context.getSourceCode()
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
         * @param {ASTNode} node - The statement node to check.
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
         * @param {ASTNode} prevNode - The previous statement to match.
         * @param {ASTNode} nextNode - The current statement to match.
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
         * @param {ASTNode} prevNode - The previous statement to count.
         * @param {ASTNode} nextNode - The current statement to count.
         * @returns {Array<Token[]>} The array of token pairs.
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
         * @param {ASTNode} node - The node to verify.
         * @returns {void}
         * @private
         */
        const verify = node => {
            const parentType = node.parent.type
            const validParent
                = astUtils.STATEMENT_LIST_PARENTS.has(parentType)
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
         * @param {ASTNode} node - The node to verify.
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
        "docs": {
            "category": "Stylistic Issues",
            "description": "Control padding lines between statements",
            "recommended": true,
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
const objectsRule = {
    "create": context => {
        const config = context.options[0] || "never"
        const sourceCode = context.getSourceCode()

        /**
         * Check for padding between two tokens and report/fix if incorrect.
         * @param {object} token1 - The first token.
         * @param {object} token2 - The second token.
         * @param {ASTNode} node - The node that's being checked.
         * @param {"normal"|"first"} position - The position inside the object.
         */
        const reportTwoTokens = (token1, token2, node, position = "normal") => {
            const isPadded = astUtils.isPaddingBetweenTokens(
                sourceCode, token1, token2)
            let messageId = "always"
            if (isPadded) {
                messageId = "never"
            }
            if (config === "always" && !isPadded
                || config === "never" && isPadded) {
                context.report({
                    "fix": fixer => {
                        const tokenAfterLastToken = sourceCode
                            .getTokenAfter(token1)
                        let tokenToLineBreakAfter = token1
                        if (tokenAfterLastToken.value === ",") {
                            tokenToLineBreakAfter = tokenAfterLastToken
                        }
                        if (isPadded) {
                            if (position === "normal") {
                                return fixer.replaceTextRange([token1.range[1],
                                    token2.range[0]], ",\n")
                            }
                            if (position === "first") {
                                return fixer.replaceTextRange([token1.range[1],
                                    token2.range[0]], "\n")
                            }
                        }
                        return fixer.insertTextAfter(
                            tokenToLineBreakAfter, "\n")
                    },
                    messageId,
                    node
                })
            }
        }

        /**
         * Handles the lines between object expresions.
         * @param {ASTNode} node - The node to be checked.
         */
        const objectExpression = node => {
            const {properties} = node
            try {
                const curFirst = sourceCode.getFirstToken(properties[0])
                const beforeFirst = sourceCode.getTokenBefore(curFirst)
                reportTwoTokens(beforeFirst, curFirst, properties[0], "first")
            } catch {
                // No lines before
            }
            for (let i = 0; i < properties.length - 1; i++) {
                const curLast = sourceCode.getLastToken(properties[i])
                const nextFirst = sourceCode.getFirstToken(properties[i + 1])
                reportTwoTokens(curLast, nextFirst, properties[i + 1])
            }
            try {
                const curLast = sourceCode.getLastToken(
                    properties[properties.length - 1])
                const afterLast = sourceCode.getTokenAfter(curLast)
                reportTwoTokens(curLast, afterLast,
                    properties[properties.length - 1])
            } catch {
                // No lines before
            }
        }

        return {"ObjectExpression": objectExpression}
    },
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

module.exports = {
    "rules": {
        "objects": objectsRule,
        "statements": statementsRule
    }
}
