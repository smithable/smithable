export type { Allowed, ModelAllowed } from "./access.js";
export {
  actionAccess,
  modelAccess,
  pageAccess,
  reviewRoles,
  uniquePerOwner,
  uniqueScope,
} from "./access.js";
export { writeActionGrants } from "./action-grants.js";
export type { OperationResult, ProjectFiles } from "./apply.js";
export {
  applyOperation,
  applyOperations,
  findOperation,
  OPERATIONS,
  operationsFor,
  parseOperationArgs,
  translationPath,
} from "./apply.js";
export { namesFor } from "./arguments.js";
export {
  ASK_ANSWERS,
  ASK_PATH,
  type AskAnswer,
  type AskExpectation,
  type AskIR,
  validateAsk,
} from "./ask-samples.js";
export type {
  AssistantCaller,
  AssistantKind,
  AssistantOffer,
  AssistantTool,
  FieldFilter,
} from "./assistant.js";
export { asksWith, assistantOffer, refersToUser } from "./assistant.js";
export { type AtRisk, EVERYDAY_WORDS, everyday, wordsAtRisk } from "./at-risk.js";
export type {
  ApiIR,
  ApiOffers,
  AssistantIR,
  AuthIR,
  GrantKey,
  GrantNames,
  Provider,
  RoleGrants,
  RoleIR,
  SignInIR,
} from "./auth.js";
export {
  AUTH_VERSION,
  apiOffers,
  GRANT_KEYS,
  PROVIDERS,
  reservedDomain,
  validateAuth,
} from "./auth.js";
export { clamp, contrast, gamutMap, hexOf, hexToRgb, rgbToHex, rgbToOklch } from "./color.js";
export { defaultColumns } from "./columns.js";
export { AUTH_SCHEMA, COMPANION_SCHEMAS, CONTENT_SCHEMA, UX_SCHEMA } from "./companion-schemas.js";
export {
  type Completion,
  completeSpec,
  type EditedFile,
  hoverSpec,
  type Known,
  type Suggestion,
} from "./complete.js";
export type { ConceptRules } from "./concepts.js";
export { conceptsWithRules, ruleId } from "./concepts.js";
export { conditionArgs, conditionText, readCondition } from "./condition.js";
export type {
  AssistantTexts,
  ContentImage,
  ContentIR,
  FieldContent,
  ModelContent,
  PageContent,
  SectionContent,
} from "./content.js";
export {
  ASSISTANT_TEXTS,
  CONTENT_VERSION,
  emptyContent,
  LANGUAGES,
  type Language,
  LOGO_SRC,
  placeholderProblem,
  RESERVE_TEXTS,
  textPaths,
  textsToTranslate,
  translationMap,
  validateContent,
} from "./content.js";
export {
  ANALYTICS,
  type AnalyticsProvider,
  type AnalyticsSetting,
  analyticsOf,
  CONTEXT_SCHEMA,
  validateContext,
} from "./context-file.js";
export { type DiffTable, dataDiffSql, restoreOrder } from "./data-diff.js";
export type { Diagnostic, Fix, Severity } from "./diagnostics.js";
export { fixCommand, formatDiagnostic, hasErrors } from "./diagnostics.js";
export type { YamlValue } from "./edit.js";
export { EditError, YamlEditor } from "./edit.js";
export { type EditRename, editAsRename } from "./edit-rename.js";
export { type EditOperation, type EditReading, editAsOperations } from "./edit-words.js";
export type {
  AccessExplanation,
  AccessReason,
  AccessResource,
  AccessScenario,
  AccessVerb,
} from "./explain-access.js";
export { explainAccess } from "./explain-access.js";
export { writeExplicit } from "./explicit.js";
export { formatSpec, sameContent } from "./format.js";
export type { Expr } from "./formula.js";
export { formatFormula, parseFormula } from "./formula.js";
export {
  daysOf,
  type Hours,
  hoursText,
  readSpan,
  type Span,
  WEEKDAYS,
  type Weekday,
} from "./hours.js";
export type * from "./ir.js";
export {
  ACCESS_OPERATIONS,
  DUE_WITHIN,
  FILES_MAX,
  isFile,
  isFiles,
  isPicture,
  isPictures,
  isUpload,
  mergeAsked,
  mergedFields,
  PICTURES_MAX,
  SCALAR_TYPES,
  SECTION_KINDS,
  storageOf,
  storesFiles,
  storesPictures,
  typeKey,
  USER_MODEL,
} from "./ir.js";
export type { MigrateResult, SpecMigration } from "./migrate.js";
export { MIGRATIONS, migrateSpec } from "./migrate.js";
export {
  type Actor,
  choose,
  coverageWalk,
  emptyMemory,
  type Memory,
  type Move,
  movesFor,
  REFUSAL_REST,
  type Slot,
  type SlotKind,
  type Step as MoveStep,
  seeded,
  type Variant,
  valueFor,
  variantsOf,
  walk,
  weightOf,
} from "./moves.js";
export { writeNamedBy } from "./named-by.js";
export {
  camel,
  capitalize,
  humanize,
  identifier,
  kebab,
  pascal,
  plural,
  snake,
  words,
} from "./naming.js";
export type {
  AnyOperation,
  ArgRef,
  Effect,
  Operation,
  OperationArgs,
  Refusal,
} from "./operation.js";
export { OperationError, refHint } from "./operation.js";
export type { PagePattern } from "./patterns.js";
export {
  LANDING_SECTIONS,
  PAGE_PATTERNS,
  PATTERN_KINDS,
  pageModel,
  pageModels,
  partSections,
  patternInfo,
} from "./patterns.js";
export {
  PACE_DEFAULT,
  PACE_MAX,
  PACE_MIN,
  PEOPLE_MAX,
  PEOPLE_PATH,
  type PersonIR,
  validatePeople,
} from "./people.js";
export type { Patch, PluginApi, PluginModule, SpecPlugin } from "./plugin.js";
export { checkJson, PLUGIN_API, resolvePlugin } from "./plugin.js";
export {
  IMPORT_MAX,
  type ImportRecords,
  type ImportRefusal,
  type ImportValue,
  parseCsv,
  readRecords,
} from "./records.js";
export {
  ASK_FILE,
  fitSamples,
  PEOPLE_FILE,
  type SamplePicture,
  type SampleRecordValue,
  type SamplesIR,
  sampleFileText,
  titleField,
  validateSamples,
} from "./samples.js";
export { buildJsonSchema } from "./schema.js";
export type { JsonSchema, SectionKey, SpecSection } from "./section.js";
export { parseFieldShorthand } from "./sections/field-type.js";
export { incomingText } from "./sections/incoming.js";
export {
  checkFilterFields,
  checkSortableFields,
  filterable,
  filterableFields,
  sortableBy,
} from "./sections/list-keys.js";
export { partText, readNamePart } from "./sections/name-parts.js";
export { type NameKind, nameProblem, RESERVED_WORDS } from "./sections/names.js";
export { notSendable, outgoingText } from "./sections/outgoing.js";
export { searchableFields } from "./sections/pages.js";
export { personaFor, sampleRoles } from "./sections/people-operations.js";
export { EDITABLE_FILES, type EditableFile, emptyFile } from "./sections/spec-operations.js";
export { cronText, timerText } from "./sections/timers.js";
export type { SensitiveKind } from "./sensitive.js";
export { sensitiveKind } from "./sensitive.js";
export type { SpecFile, ValidateOptions, ValidateResult } from "./spec.js";
export { compareVersions, SECTIONS, SPEC_VERSION, validateSpec } from "./spec.js";
export { fillText, placeholdersOf } from "./template.js";
export type { Mode, ThemeIR, TokenName, Tokens } from "./theme.js";
export {
  BUILT_IN_THEMES,
  bandLowContrast,
  checkContrast,
  deriveTokens,
  hardToRead,
  lowContrast,
  oppositeMode,
  parseTheme,
  SHADOWS,
  TOKEN_NAMES,
  themeNamed,
  themeNames,
  themeThumbnail,
  tokensOf,
  withBackground,
} from "./theme.js";
export { type Fit, themeFit } from "./theme-fit.js";
export {
  DEFAULT_STYLE,
  DISPLAY_FONTS,
  FONT_WEIGHTS,
  STYLE_VALUES,
  type ThemeStyle,
} from "./theme-style.js";
export { type ThreadBindings, threadBindings } from "./thread.js";
export { type GroupEdge, looseReferrers, type Referrer, trashGroup } from "./trash-group.js";
export { writeUniqueScopes } from "./unique-scopes.js";
export type {
  Band,
  Control,
  HeaderLook,
  Icon,
  PageUx,
  ThemePreset,
  Tone,
  UxIR,
  Voice,
} from "./ux.js";
export {
  BANDS,
  CONTROLS,
  controlUnfit,
  emptyUx,
  FONTS,
  HEADER_LOOKS,
  ICONS,
  pageIcon,
  SECTION_LOOKS,
  stagePage,
  THEME_PRESETS,
  TONES,
  UX_VERSION,
  VOICES,
  validateUx,
} from "./ux.js";
export { convertValue } from "./values.js";
