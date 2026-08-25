// Domain types
export {
  CharacterSchema,
  type Character,
  LineTypeSchema,
  type LineType,
  LineSchema,
  type Line,
  SceneSchema,
  type Scene,
  ScriptFormatSchema,
  type ScriptFormat,
  ScriptSchema,
  type Script,
} from "./script.js";

export {
  IssueTypeSchema,
  type IssueType,
  SeveritySchema,
  type Severity,
  IssueStatusSchema,
  type IssueStatus,
  SourceSchema,
  type Source,
  SourceConflictSchema,
  type SourceConflict,
  IssueSchema,
  type Issue,
  VALID_STATUS_TRANSITIONS,
  isValidTransition,
  compareSeverity,
} from "./issue.js";

// API types
export {
  UploadScriptRequestSchema,
  type UploadScriptRequest,
  UploadScriptResponseSchema,
  type UploadScriptResponse,
  GetScriptResponseSchema,
  type GetScriptResponse,
  ListIssuesQuerySchema,
  type ListIssuesQuery,
  ListIssuesResponseSchema,
  type ListIssuesResponse,
  UpdateIssueRequestSchema,
  type UpdateIssueRequest,
  UpdateIssueResponseSchema,
  type UpdateIssueResponse,
  AnalyzeRequestSchema,
  type AnalyzeRequest,
  JobStatusSchema,
  type JobStatus,
  AnalyzeResponseSchema,
  type AnalyzeResponse,
  JobStatusResponseSchema,
  type JobStatusResponse,
  RecheckRequestSchema,
  type RecheckRequest,
  RecheckResponseSchema,
  type RecheckResponse,
} from "./api.js";

// Job types
export { AnalysisJobSchema, type AnalysisJob } from "./job.js";

// Constants
export {
  ROSS_VERSION,
  MAX_SCRIPT_CHARS,
  MAX_SCENES_PER_SCRIPT,
  MAX_LINES_PER_SCENE,
  MAX_ISSUES_PER_SCRIPT,
  CONFIDENCE_THRESHOLD_HIGH,
  CONFIDENCE_THRESHOLD_MEDIUM,
  CONFIDENCE_THRESHOLD_LOW,
  type HealthStatus,
} from "./constants.js";
