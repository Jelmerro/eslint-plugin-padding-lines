/**
 * Checks if there is padding between two tokens.
 * @param {SourceCode} sourceCode - The ESLint source code object.
 * @param {Token} first - The first token.
 * @param {Token} second - The second token.
 * @returns {boolean} True if there is at least a line between the tokens.
 */
export const isPaddingBetweenTokens = (sourceCode, first, second) => {
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

/**
 * Create a newline reporter for either objects or arrays.
 * @param {"properties"|"elements"} nodelist
 * @param {"ObjectExpression"|"ArrayExpression"} expression
 * @param {object} context
 */
export const createNewLineReporter = (nodelist, expression, context) => {
    const config = context.options[0] || "never"
    const {sourceCode} = context
    /**
     * Check for padding between two tokens and report/fix if incorrect.
     * @param {Token} token1 - The first token.
     * @param {Token} token2 - The second token.
     * @param {ASTNode} node - The node that's being checked.
     * @param {"normal"|"first"} position - The position inside the object.
     */
    const reportTwoTokens = (token1, token2, node, position = "normal") => {
        const isPadded = isPaddingBetweenTokens(
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
    const expressionChecker = node => {
        const props = node[nodelist]
        try {
            const curFirst = sourceCode.getFirstToken(props[0])
            const beforeFirst = sourceCode.getTokenBefore(curFirst)
            reportTwoTokens(beforeFirst, curFirst, props[0], "first")
        } catch {
            // No lines before
        }
        for (let i = 0; i < props.length - 1; i++) {
            const curLast = sourceCode.getLastToken(props[i])
            const nextFirst = sourceCode.getFirstToken(props[i + 1])
            reportTwoTokens(curLast, nextFirst, props[i + 1])
        }
        try {
            const curLast = sourceCode.getLastToken(
                props.at(-1))
            const afterLast = sourceCode.getTokenAfter(curLast)
            reportTwoTokens(curLast, afterLast,
                props.at(-1))
        } catch {
            // No lines before
        }
    }

    const rule = {}
    rule[expression] = expressionChecker
    return rule
}
