export {
  C4_SUBTYPE_OPTIONS,
  C4_ELEMENT_KIND_OPTIONS,
  C4_ELEMENT_VARIANT_OPTIONS,
  C4_BOUNDARY_KIND_OPTIONS,
  C4_RELATION_TYPE_OPTIONS,
  createDefaultC4Data,
  sanitizeC4Id,
  createUniqueC4ElementId,
  createUniqueC4BoundaryId,
  createUniqueC4RelationId,
  collectC4BoundaryDescendantIds,
  resolveC4ElementMacroName,
  resolveC4BoundaryMacroName,
} from './c4/defaults.ts';
export { isValidC4Data, normalizeC4Data } from './c4/normalize.ts';
export { generateC4Code } from './c4/generator.ts';
export { parseC4CodeToGuiData } from './c4/parser.ts';
