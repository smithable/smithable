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
