import type { Rule, Scope } from 'eslint';
import type { Node } from 'estree';

const EFFECT_HOOKS = new Set(['useEffect', 'useLayoutEffect', 'useInsertionEffect']);

const keyName = (key: Node, computed: boolean) => {
  if (key.type === 'Literal') return String(key.value);
  if (key.type === 'Identifier' && !computed) return key.name;
  return null;
};

export const noEffectHooks: Rule.RuleModule = {
  meta: {
    type: 'problem',
    schema: [],
    messages: {
      effect:
        '{{name}} is banned. Use useMountEffect, useEventListener or useInterval from @niko464/react-kit, a key, a ref callback, deriving the value during render, or Motion for animation. A case none of these covers becomes a new hook in @niko464/react-kit, through a PR.',
    },
  },
  create(context) {
    const reportIfEffect = (node: Node, name: string | null) => {
      if (name !== null && EFFECT_HOOKS.has(name)) {
        context.report({ node, messageId: 'effect', data: { name } });
      }
    };

    const reportNamespaceUse = (reference: Scope.Reference) => {
      const identifier = reference.identifier;
      const parent: Node | null = (identifier as Rule.Node).parent;
      if (parent?.type === 'MemberExpression' && parent.object === identifier) {
        reportIfEffect(parent, keyName(parent.property, parent.computed));
      }
      if (
        parent?.type === 'VariableDeclarator' &&
        parent.init === identifier &&
        parent.id.type === 'ObjectPattern'
      ) {
        for (const property of parent.id.properties) {
          if (property.type === 'Property') {
            reportIfEffect(property, keyName(property.key, property.computed));
          }
        }
      }
    };

    return {
      ImportDeclaration(node) {
        if (node.source.value !== 'react') return;
        for (const specifier of node.specifiers) {
          const imported =
            specifier.type === 'ImportSpecifier' ? keyName(specifier.imported, false) : 'default';
          if (imported !== 'default') {
            reportIfEffect(specifier, imported);
            continue;
          }
          for (const variable of context.sourceCode.getDeclaredVariables(specifier)) {
            variable.references.forEach(reportNamespaceUse);
          }
        }
      },
      ExportNamedDeclaration(node) {
        if (node.source?.value !== 'react') return;
        for (const specifier of node.specifiers) {
          reportIfEffect(specifier, keyName(specifier.local, false));
        }
      },
    };
  },
};
