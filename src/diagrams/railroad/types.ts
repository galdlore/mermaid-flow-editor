export type RailroadSyntax =
  | 'railroad-beta'
  | 'railroad-ebnf-beta'
  | 'railroad-abnf-beta'
  | 'railroad-peg-beta';

export type RailroadExprKind =
  | 'terminal'
  | 'nonterminal'
  | 'special'
  | 'sequence'
  | 'choice'
  | 'optional'
  | 'oneOrMore'
  | 'zeroOrMore';

export interface RailroadExprNode {
  id: string;
  kind: RailroadExprKind;
  value?: string;
  children?: RailroadExprNode[];
}

export interface RailroadRuleData {
  id: string;
  name: string;
  root: RailroadExprNode;
}

export interface RailroadDiagramData {
  diagramType: 'railroad';
  syntax: RailroadSyntax;
  title?: string;
  rules: RailroadRuleData[];
  comments?: string[];
}
