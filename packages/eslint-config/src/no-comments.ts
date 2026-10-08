import type { Rule } from 'eslint';

const TOOL_DIRECTIVES = [/^\s*@ts-expect-error(?:\s|:|$)/, /^\s*prettier-ignore\s*$/];
const TRIPLE_SLASH_REFERENCE = /^\/\s*<reference\s/;

type SourceComment = { type: string; value: string };

const isToolDirective = (comment: SourceComment) =>
  comment.type === 'Shebang' ||
  (comment.type === 'Line' && TRIPLE_SLASH_REFERENCE.test(comment.value)) ||
  TOOL_DIRECTIVES.some((pattern) => pattern.test(comment.value));

export const noComments: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      comment:
        'Comments are banned. Move what this comment says into a name, a type or a test, and put a "why" worth keeping in docs/ or an ADR.',
    },
  },
  create(context) {
    return {
      Program() {
        for (const comment of context.sourceCode.getAllComments()) {
          if (!isToolDirective(comment) && comment.loc) {
            context.report({ loc: comment.loc, messageId: 'comment' });
          }
        }
      },
    };
  },
};
