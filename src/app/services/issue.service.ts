import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  Issue,
  IssueComment,
  IssueCategory,
  IssuePriority,
  IssueStatus,
  IssueFilter,
  IssueSummary
} from '../models/issue.model';
import { LocalStorageService } from './local-storage.service';
import { UserService } from './user.service';
import { NotificationService } from './notification.service';
import { SystemLogService } from './system-log.service';
import { LogType, LogCategory, LogSeverity } from '../models/system-log.model';
import { NotificationType } from '../models/notification.model';

@Injectable({
  providedIn: 'root'
})
export class IssueService {
  private readonly ISSUES_KEY = 'cash_mgmt_issues';
  private readonly COMMENTS_KEY = 'cash_mgmt_issue_comments';

  private issuesSubject = new BehaviorSubject<Issue[]>([]);
  public issues$ = this.issuesSubject.asObservable();

  constructor(
    private localStorageService: LocalStorageService,
    private userService: UserService,
    private notificationService: NotificationService,
    private systemLogService: SystemLogService
  ) {
    this.loadIssues();
  }

  private generateIssueId(): string {
    return 'issue_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  }

  private generateCommentId(): string {
    return 'comment_' + Date.now() + '_' + Math.random().toString(36).substring(2, 11);
  }

  private loadIssues(): void {
    const issues = this.getAllIssues();
    this.issuesSubject.next(issues);
  }

  getAllIssues(): Issue[] {
    const issues = this.localStorageService.getItem<Issue[]>(this.ISSUES_KEY) || [];
    return issues.map(issue => ({
      ...issue,
      reportedAt: new Date(issue.reportedAt),
      resolvedAt: issue.resolvedAt ? new Date(issue.resolvedAt) : undefined,
      comments: issue.comments?.map(comment => ({
        ...comment,
        createdAt: new Date(comment.createdAt)
      })) || []
    }));
  }

  getIssueById(id: string): Issue | null {
    const issues = this.getAllIssues();
    return issues.find(issue => issue.id === id) || null;
  }

  createIssue(issueData: {
    title: string;
    description: string;
    category: IssueCategory;
    priority: IssuePriority;
    requestId?: string;
  }): Issue {
    const currentUser = this.userService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be logged in to report an issue');
    }

    const newIssue: Issue = {
      id: this.generateIssueId(),
      title: issueData.title,
      description: issueData.description,
      category: issueData.category,
      priority: issueData.priority,
      status: IssueStatus.OPEN,
      reportedBy: currentUser.id,
      reportedByName: currentUser.fullName,
      reportedAt: new Date(),
      requestId: issueData.requestId,
      comments: [],
      metadata: {
        reporterRole: currentUser.role,
        reporterDepartment: currentUser.department
      }
    };

    const issues = this.getAllIssues();
    issues.push(newIssue);
    this.saveIssues(issues);

    // Log the issue creation
    this.systemLogService.createLog({
      type: LogType.ISSUE_REPORTED,
      category: LogCategory.ISSUE_MANAGEMENT,
      severity: this.getPriorityToSeverityMapping(issueData.priority),
      title: 'Issue Reported',
      message: `${currentUser.fullName} reported an issue: ${issueData.title}`,
      metadata: {
        issueId: newIssue.id,
        category: issueData.category,
        priority: issueData.priority,
        requestId: issueData.requestId
      }
    });

    // Notify managers about the new issue
    this.notifyManagersAboutNewIssue(newIssue);

    return newIssue;
  }

  updateIssue(id: string, updates: Partial<Issue>): Issue | null {
    const issues = this.getAllIssues();
    const issueIndex = issues.findIndex(issue => issue.id === id);

    if (issueIndex === -1) {
      return null;
    }

    const currentUser = this.userService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be logged in to update an issue');
    }

    const originalIssue = issues[issueIndex];
    const updatedIssue = { ...originalIssue, ...updates };

    // Handle status changes
    if (updates.status && updates.status !== originalIssue.status) {
      if (updates.status === IssueStatus.RESOLVED) {
        updatedIssue.resolvedBy = currentUser.id;
        updatedIssue.resolvedByName = currentUser.fullName;
        updatedIssue.resolvedAt = new Date();
      }
    }

    issues[issueIndex] = updatedIssue;
    this.saveIssues(issues);

    // Log the update
    this.systemLogService.createLog({
      type: LogType.USER_ACTION,
      category: LogCategory.ISSUE_MANAGEMENT,
      severity: LogSeverity.INFO,
      title: 'Issue Updated',
      message: `${currentUser.fullName} updated issue: ${updatedIssue.title}`,
      metadata: {
        issueId: id,
        updates: Object.keys(updates)
      }
    });

    return updatedIssue;
  }

  addComment(issueId: string, comment: string, isInternal: boolean = false): IssueComment | null {
    const currentUser = this.userService.getCurrentUser();
    if (!currentUser) {
      throw new Error('User must be logged in to add a comment');
    }

    const issue = this.getIssueById(issueId);
    if (!issue) {
      return null;
    }

    const newComment: IssueComment = {
      id: this.generateCommentId(),
      issueId,
      userId: currentUser.id,
      userName: currentUser.fullName,
      comment,
      createdAt: new Date(),
      isInternal
    };

    issue.comments = issue.comments || [];
    issue.comments.push(newComment);

    this.updateIssue(issueId, { comments: issue.comments });

    return newComment;
  }

  getFilteredIssues(filter: IssueFilter): Issue[] {
    let issues = this.getAllIssues();

    if (filter.status && filter.status.length > 0) {
      issues = issues.filter(issue => filter.status!.includes(issue.status));
    }

    if (filter.category && filter.category.length > 0) {
      issues = issues.filter(issue => filter.category!.includes(issue.category));
    }

    if (filter.priority && filter.priority.length > 0) {
      issues = issues.filter(issue => filter.priority!.includes(issue.priority));
    }

    if (filter.reportedBy) {
      issues = issues.filter(issue => issue.reportedBy === filter.reportedBy);
    }

    if (filter.assignedTo) {
      issues = issues.filter(issue => issue.assignedTo === filter.assignedTo);
    }

    if (filter.startDate) {
      issues = issues.filter(issue => issue.reportedAt >= filter.startDate!);
    }

    if (filter.endDate) {
      issues = issues.filter(issue => issue.reportedAt <= filter.endDate!);
    }

    if (filter.searchTerm) {
      const searchTerm = filter.searchTerm.toLowerCase();
      issues = issues.filter(issue =>
        issue.title.toLowerCase().includes(searchTerm) ||
        issue.description.toLowerCase().includes(searchTerm) ||
        issue.reportedByName.toLowerCase().includes(searchTerm)
      );
    }

    return issues.sort((a, b) => b.reportedAt.getTime() - a.reportedAt.getTime());
  }

  getIssueSummary(): IssueSummary {
    const issues = this.getAllIssues();

    const totalIssues = issues.length;
    const openIssues = issues.filter(i => i.status === IssueStatus.OPEN).length;
    const inProgressIssues = issues.filter(i => i.status === IssueStatus.IN_PROGRESS).length;
    const resolvedIssues = issues.filter(i => i.status === IssueStatus.RESOLVED).length;
    const closedIssues = issues.filter(i => i.status === IssueStatus.CLOSED).length;
    const criticalIssues = issues.filter(i => i.priority === IssuePriority.CRITICAL).length;
    const highPriorityIssues = issues.filter(i => i.priority === IssuePriority.HIGH).length;

    // Calculate average resolution time
    const resolvedWithTime = issues.filter(i => i.resolvedAt && i.reportedAt);
    const averageResolutionTime = resolvedWithTime.length > 0
      ? resolvedWithTime.reduce((sum, issue) => {
          const resolutionTime = (issue.resolvedAt!.getTime() - issue.reportedAt.getTime()) / (1000 * 60 * 60);
          return sum + resolutionTime;
        }, 0) / resolvedWithTime.length
      : 0;

    // Category breakdown
    const categoryMap = new Map<IssueCategory, number>();
    issues.forEach(issue => {
      categoryMap.set(issue.category, (categoryMap.get(issue.category) || 0) + 1);
    });

    const categoryBreakdown = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count
    }));

    return {
      totalIssues,
      openIssues,
      inProgressIssues,
      resolvedIssues,
      closedIssues,
      criticalIssues,
      highPriorityIssues,
      averageResolutionTime,
      categoryBreakdown
    };
  }

  private getPriorityToSeverityMapping(priority: IssuePriority): LogSeverity {
    switch (priority) {
      case IssuePriority.CRITICAL:
        return LogSeverity.CRITICAL;
      case IssuePriority.HIGH:
        return LogSeverity.ERROR;
      case IssuePriority.MEDIUM:
        return LogSeverity.WARNING;
      case IssuePriority.LOW:
      default:
        return LogSeverity.INFO;
    }
  }

  private notifyManagersAboutNewIssue(issue: Issue): void {
    const managers = this.userService.getManagers();

    managers.forEach(manager => {
      this.notificationService.createNotification({
        type: NotificationType.ISSUE_REPORTED,
        title: 'New Issue Reported',
        message: `${issue.reportedByName} reported: ${issue.title}`,
        recipientId: manager.id
      });
    });
  }

  private saveIssues(issues: Issue[]): void {
    this.localStorageService.setItem(this.ISSUES_KEY, issues);
    this.issuesSubject.next(issues);
  }
}
