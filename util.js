"use strict"

const LINEBREAKS = new Set(["\r\n", "\r", "\n", "\u2028", "\u2029"])
const STATEMENT_LIST_PARENTS = new Set(
    ["Program", "BlockStatement", "StaticBlock", "SwitchCase"]
)
const anyFunctionPattern = /^(?:Function(?:Declaration|Expression)|ArrowFunctionExpression)$/u

/**
 * Checks whether a given node is a function node or not.
 * The following types are function nodes:
 *
 * - ArrowFunctionExpression
 * - FunctionDeclaration
 * - FunctionExpression.
 * @param {ASTNode|null} node - A node to check.
 * @returns {boolean} `true` if the node is a function node.
 */
const isFunction = node => Boolean(node && anyFunctionPattern.test(node.type))
/**
 * Retrieve `expression` value if the given node a `ChainExpression` node.
 * Otherwise, pass through it.
 * @param {ASTNode} node - The node to address.
 * @returns {ASTNode} The node or the sub-expression.
 */

const skipChainExpression = node => {
    if (node && node.type === "ChainExpression") {
        return node.expression
    }
    return node
}

/**
 * Checks if the given token is a semicolon token or not.
 * @param {Token} token - The token to check.
 * @returns {boolean} `true` if the token is a semicolon token.
 */
const isSemicolonToken = token => token.value === ";"
    && token.type === "Punctuator"

/**
 * Checks if the given token is a semicolon token or not.
 * @param {Token} token - The token to check.
 * @returns {boolean} `true` if the token is a semicolon token.
 */
const isNotSemicolonToken = token => !isSemicolonToken(token)

/**
 * Checks if the given token is a closing brace token or not.
 * @param {Token} token - The token to check.
 * @returns {boolean} `true` if the token is a closing brace token.
 */
const isClosingBraceToken = token => token.value === "}"
    && token.type === "Punctuator"

/**
 * Determines if a node is surrounded by parentheses.
 * @param {SourceCode} sourceCode - The ESLint source code object.
 * @param {ASTNode} node - The node to be checked.
 * @returns {boolean} True if the node is parenthesised.
 * @private
 */
const isParenthesised = (sourceCode, node) => {
    const previousToken = sourceCode.getTokenBefore(node)
    const nextToken = sourceCode.getTokenAfter(node)
    return Boolean(previousToken && nextToken)
        && previousToken.value === "("
        && previousToken.range[1] <= node.range[0]
        && nextToken.value === ")" && nextToken.range[0] >= node.range[1]
}

/**
 * Determines whether two adjacent tokens are on the same line.
 * @param {object} left - The left token object.
 * @param {object} right - The right token object.
 * @returns {boolean} Whether or not the tokens are on the same line.
 * @public
 */
const isTokenOnSameLine = (
    left, right) => left.loc.end.line === right.loc.start.line

/**
 * Checks if there is padding between two tokens.
 * @param {SourceCode} sourceCode - The ESLint source code object.
 * @param {Token} first - The first token.
 * @param {Token} second - The second token.
 * @returns {boolean} True if there is at least a line between the tokens.
 */
const isPaddingBetweenTokens = (sourceCode, first, second) => {
    const comments = sourceCode.getCommentsBefore(second)
    const len = comments.length
    // If there is no comments
    if (len === 0) {
        const linesBetweenFstAndSnd = second.loc.start.line
            - first.loc.end.line - 1
        return linesBetweenFstAndSnd >= 1
    }
    // If there are comments
    let sumOfCommentLines = 0
    let prevCommentLineNum = -1
    for (let i = 0; i < len; i++) {
        const commentLinesOfThisComment = comments[i].loc.end.line
            - comments[i].loc.start.line + 1
        sumOfCommentLines += commentLinesOfThisComment
        /*
         * If this comment and the previous comment are in the same line,
         * the count of comment lines is duplicated. So decrement once.
         */
        if (prevCommentLineNum === comments[i].loc.start.line) {
            sumOfCommentLines -= 1
        }
        prevCommentLineNum = comments[i].loc.end.line
    }
    /*
     * If the first block and the first comment are in the same line,
     * the count of comment lines is duplicated. So decrement sumOfCommentLines.
     */
    if (first.loc.end.line === comments[0].loc.start.line) {
        sumOfCommentLines -= 1
    }
    /*
     * If the last comment and the second block are in the same line,
     * the count of comment lines is duplicated. So decrement sumOfCommentLines.
     */
    if (comments[len - 1].loc.end.line === second.loc.start.line) {
        sumOfCommentLines -= 1
    }
    const linesBetweenFstAndSnd = second.loc.start.line - first.loc.end.line - 1
    return linesBetweenFstAndSnd - sumOfCommentLines >= 1
}

module.exports = {
    LINEBREAKS,
    STATEMENT_LIST_PARENTS,
    isClosingBraceToken,
    isFunction,
    isNotSemicolonToken,
    isPaddingBetweenTokens,
    isParenthesised,
    isSemicolonToken,
    isTokenOnSameLine,
    skipChainExpression
}
