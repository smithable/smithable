export type { Allowed, ModelAllowed } from "./access.js";
export { actionAccess, modelAccess, pageAccess, reviewRoles, uniquePerOwner } from "./access.js";
export type { OperationResult, ProjectFiles } from "./apply.js";
export {
  applyOperation,
  findOperation,
  OPERATIONS,
  operationsFor,
  parseOperationArgs,
  translationPath,
} from "./apply.js";
export { namesFor } from "./arguments.js";
export type {
  AssistantCaller,
  AssistantKind,
  AssistantOffer,
  AssistantTool,
  FieldFilter,
} from "./assistant.js";
export { asksWith, assistantOffer, refersToUser } from "./assistant.js";
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
  FILES_MAX,
  isFile,
  isFiles,
  isPicture,
  isPictures,
  isUpload,
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
  patternInfo,
} from "./patterns.js";
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
  fitSamples,
  type SamplePicture,
  type SampleRecordValue,
  type SamplesIR,
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
export { type NameKind, nameProblem } from "./sections/names.js";
export { outgoingText } from "./sections/outgoing.js";
export { searchableFields } from "./sections/pages.js";
export { EDITABLE_FILES, type EditableFile, emptyFile } from "./sections/spec-operations.js";
export type { SensitiveKind } from "./sensitive.js";
export { sensitiveKind } from "./sensitive.js";
export type { SpecFile, ValidateOptions, ValidateResult } from "./spec.js";
export { compareVersions, SECTIONS, SPEC_VERSION, validateSpec } from "./spec.js";
export type { Mode, ThemeIR, TokenName, Tokens } from "./theme.js";
export {
  BUILT_IN_THEMES,
  checkContrast,
  deriveTokens,
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
export { type GroupEdge, looseReferrers, type Referrer, trashGroup } from "./trash-group.js";
export type { Control, Icon, PageUx, ThemePreset, Tone, UxIR, Voice } from "./ux.js";
export {
  CONTROLS,
  controlUnfit,
  emptyUx,
  FONTS,
  ICONS,
  pageIcon,
  SECTION_LOOKS,
  THEME_PRESETS,
  TONES,
  UX_VERSION,
  VOICES,
  validateUx,
} from "./ux.js";
export { convertValue } from "./values.js";
