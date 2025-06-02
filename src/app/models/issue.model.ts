export interface Issue {
  id: string;
  title: string;
  description: string;
  category: IssueCategory;
  priority: IssuePriority;
  status: IssueStatus;
  reportedBy: string;
  reportedByName: string;
  reportedAt: Date;
  assignedTo?: string;
  assignedToName?: string;
  resolvedBy?: string;
  resolvedByName?: string;
  resolvedAt?: Date;
  resolution?: string;
  requestId?: string; // Associated cash request if applicable
  attachments?: string[]; // File paths or URLs
  comments?: IssueComment[];
  metadata?: { [key: string]: any };
}

export interface IssueComment {
  id: string;
  issueId: string;
  userId: string;
  userName: string;
  comment: string;
  createdAt: Date;
  isInternal?: boolean; // For manager-only comments
}

export enum IssueCategory {
  MISSING_NOTES = 'missing_notes',
  DAMAGED_NOTES = 'damaged_notes',
  COUNTERFEIT_NOTES = 'counterfeit_notes',
  COUNTING_DISCREPANCY = 'counting_discrepancy',
  EQUIPMENT_MALFUNCTION = 'equipment_malfunction',
  SECURITY_CONCERN = 'security_concern',
  PROCESS_VIOLATION = 'process_violation',
  OTHER = 'other'
}

export enum IssuePriority {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export enum IssueStatus {
  OPEN = 'open',
  IN_PROGRESS = 'in_progress',
  RESOLVED = 'resolved',
  CLOSED = 'closed'
}

export const ISSUE_CATEGORY_LABELS: { [key in IssueCategory]: string } = {
  [IssueCategory.MISSING_NOTES]: 'Missing Notes',
  [IssueCategory.DAMAGED_NOTES]: 'Damaged/Destroyed Notes',
  [IssueCategory.COUNTERFEIT_NOTES]: 'Counterfeit Notes',
  [IssueCategory.COUNTING_DISCREPANCY]: 'Counting Discrepancy',
  [IssueCategory.EQUIPMENT_MALFUNCTION]: 'Equipment Malfunction',
  [IssueCategory.SECURITY_CONCERN]: 'Security Concern',
  [IssueCategory.PROCESS_VIOLATION]: 'Process Violation',
  [IssueCategory.OTHER]: 'Other'
};

export const ISSUE_PRIORITY_LABELS: { [key in IssuePriority]: string } = {
  [IssuePriority.LOW]: 'Low',
  [IssuePriority.MEDIUM]: 'Medium',
  [IssuePriority.HIGH]: 'High',
  [IssuePriority.CRITICAL]: 'Critical'
};

export const ISSUE_STATUS_LABELS: { [key in IssueStatus]: string } = {
  [IssueStatus.OPEN]: 'Open',
  [IssueStatus.IN_PROGRESS]: 'In Progress',
  [IssueStatus.RESOLVED]: 'Resolved',
  [IssueStatus.CLOSED]: 'Closed'
};

export interface IssueFilter {
  status?: IssueStatus[];
  category?: IssueCategory[];
  priority?: IssuePriority[];
  reportedBy?: string;
  assignedTo?: string;
  startDate?: Date;
  endDate?: Date;
  searchTerm?: string;
}

export interface IssueSummary {
  totalIssues: number;
  openIssues: number;
  inProgressIssues: number;
  resolvedIssues: number;
  closedIssues: number;
  criticalIssues: number;
  highPriorityIssues: number;
  averageResolutionTime: number; // in hours
  categoryBreakdown: { category: IssueCategory; count: number }[];
}
