export { describeChange } from "./change-words.js";
export type { ContextOptions, ContextSlice } from "./context.js";
export { buildContext, estimateTokens } from "./context.js";
export type { PhraseMatch, PhraseOperation } from "./phrases.js";
export { matchRequest } from "./phrases.js";
export type {
  ConceptInfo,
  FileRef,
  FileRole,
  GeneratedEntry,
  IndexInput,
  ProjectIndex,
  RuleInfo,
  RuleStatus,
  SourceFile,
} from "./project-index.js";
export {
  buildIndex,
  conceptsAt,
  findImplementation,
  findTests,
  hashRule,
  inspect,
} from "./project-index.js";
export type { SummarySection } from "./summary.js";
export { summarize, wordsFor } from "./summary.js";
export type { SummaryOperation } from "./summary-edit.js";
export { readSummaryEdit } from "./summary-edit.js";
