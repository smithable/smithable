export { describeChange } from "./change-words.js";
export type { ContextOptions, ContextSlice } from "./context.js";
export { buildContext, estimateTokens } from "./context.js";
export type { PhraseMatch, PhraseOperation, PhraseRefusal } from "./phrases.js";
export { matchRequest, refusalOf } from "./phrases.js";
export { type Part, present } from "./present.js";
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
export type { Answer } from "./questions.js";
export { answerQuestion, looksLikeQuestion } from "./questions.js";
export type { SummarySection } from "./summary.js";
export { summarize, wordsFor } from "./summary.js";
