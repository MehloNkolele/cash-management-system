export interface SystemLog {
  id: string;
  type: LogType;
  category: LogCategory;
  severity: LogSeverity;
  title: string;
  message: string;
  userId?: string;
  userName?: string;
  requestId?: string;
  inventoryId?: string;
  metadata?: { [key: string]: any };
  timestamp: Date;
  ipAddress?: string;
  userAgent?: string;
}

export enum LogType {
  USER_ACTION = 'user_action',
  SYSTEM_EVENT = 'system_event',
  SECURITY_EVENT = 'security_event',
  CASH_TRANSACTION = 'cash_transaction',
  INVENTORY_CHANGE = 'inventory_change',
  DEADLINE_VIOLATION = 'deadline_violation',
  DISCREPANCY = 'discrepancy',
  ERROR = 'error',
  ISSUE_REPORTED = 'issue_reported'
}

export enum LogCategory {
  AUTHENTICATION = 'authentication',
  CASH_REQUEST = 'cash_request',
  INVENTORY_MANAGEMENT = 'inventory_management',
  USER_MANAGEMENT = 'user_management',
  SYSTEM_CONFIGURATION = 'system_configuration',
  AUDIT_TRAIL = 'audit_trail',
  DEADLINE_MONITORING = 'deadline_monitoring',
  CASH_HANDLING = 'cash_handling',
  ISSUE_MANAGEMENT = 'issue_management'
}

export enum LogSeverity {
  INFO = 'info',
  WARNING = 'warning',
  ERROR = 'error',
  CRITICAL = 'critical'
}

export interface LogFilter {
  startDate?: Date;
  endDate?: Date;
  types?: LogType[];
  categories?: LogCategory[];
  severities?: LogSeverity[];
  userId?: string;
  requestId?: string;
  searchTerm?: string;
}

export interface LogSummary {
  totalLogs: number;
  criticalCount: number;
  errorCount: number;
  warningCount: number;
  infoCount: number;
  recentActivity: SystemLog[];
  topUsers: UserActivity[];
  categoryBreakdown: CategoryBreakdown[];
}

export interface UserActivity {
  userId: string;
  userName: string;
  actionCount: number;
  lastActivity: Date;
}

export interface CategoryBreakdown {
  category: LogCategory;
  count: number;
  percentage: number;
}

export interface AuditReport {
  id: string;
  title: string;
  description: string;
  generatedBy: string;
  generatedAt: Date;
  period: {
    startDate: Date;
    endDate: Date;
  };
  summary: LogSummary;
  logs: SystemLog[];
  statistics: AuditStatistics;
  recommendations: string[];
}

export interface AuditStatistics {
  totalRequests: number;
  completedRequests: number;
  lateReturns: number;
  discrepancies: number;
  averageProcessingTime: number;
  complianceScore: number;
  riskLevel: RiskLevel;
}

export enum RiskLevel {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export const LOG_TYPE_LABELS: { [key in LogType]: string } = {
  [LogType.USER_ACTION]: 'User Action',
  [LogType.SYSTEM_EVENT]: 'System Event',
  [LogType.SECURITY_EVENT]: 'Security Event',
  [LogType.CASH_TRANSACTION]: 'Cash Transaction',
  [LogType.INVENTORY_CHANGE]: 'Inventory Change',
  [LogType.DEADLINE_VIOLATION]: 'Deadline Violation',
  [LogType.DISCREPANCY]: 'Discrepancy',
  [LogType.ERROR]: 'Error',
  [LogType.ISSUE_REPORTED]: 'Issue Reported'
};

export const LOG_CATEGORY_LABELS: { [key in LogCategory]: string } = {
  [LogCategory.AUTHENTICATION]: 'Authentication',
  [LogCategory.CASH_REQUEST]: 'Cash Request',
  [LogCategory.INVENTORY_MANAGEMENT]: 'Inventory Management',
  [LogCategory.USER_MANAGEMENT]: 'User Management',
  [LogCategory.SYSTEM_CONFIGURATION]: 'System Configuration',
  [LogCategory.AUDIT_TRAIL]: 'Audit Trail',
  [LogCategory.DEADLINE_MONITORING]: 'Deadline Monitoring',
  [LogCategory.CASH_HANDLING]: 'Cash Handling',
  [LogCategory.ISSUE_MANAGEMENT]: 'Issue Management'
};

export const LOG_SEVERITY_LABELS: { [key in LogSeverity]: string } = {
  [LogSeverity.INFO]: 'Information',
  [LogSeverity.WARNING]: 'Warning',
  [LogSeverity.ERROR]: 'Error',
  [LogSeverity.CRITICAL]: 'Critical'
};
