import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  SystemLog,
  LogType,
  LogCategory,
  LogSeverity,
  LogFilter,
  LogSummary,
  UserActivity,
  CategoryBreakdown,
  AuditReport,
  AuditStatistics,
  RiskLevel
} from '../models/system-log.model';
import { CashRequest, RequestStatus } from '../models/cash-request.model';
import { LocalStorageService } from './local-storage.service';
import { UserService } from './user.service';
import { CashRequestService } from './cash-request.service';

@Injectable({
  providedIn: 'root'
})
export class SystemLogService {
  private readonly LOGS_KEY = 'cash_mgmt_system_logs';
  private readonly AUDIT_REPORTS_KEY = 'cash_mgmt_audit_reports';

  private logsSubject = new BehaviorSubject<SystemLog[]>([]);
  public logs$ = this.logsSubject.asObservable();

  private cashRequestService?: CashRequestService;

  constructor(
    private localStorageService: LocalStorageService,
    private userService: UserService
  ) {
    this.loadLogs();
  }

  private generateLogId(): string {
    return 'log_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private generateReportId(): string {
    return 'audit_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private loadLogs(): void {
    const logs = this.getAllLogs();
    this.logsSubject.next(logs);
  }

  getAllLogs(): SystemLog[] {
    const logs = this.localStorageService.getItem<SystemLog[]>(this.LOGS_KEY) || [];
    return logs.map(log => ({
      ...log,
      timestamp: new Date(log.timestamp)
    }));
  }

  createLog(logData: Partial<SystemLog>): SystemLog {
    const currentUser = this.userService.getCurrentUser();

    const newLog: SystemLog = {
      id: this.generateLogId(),
      type: logData.type || LogType.SYSTEM_EVENT,
      category: logData.category || LogCategory.SYSTEM_CONFIGURATION,
      severity: logData.severity || LogSeverity.INFO,
      title: logData.title || 'System Event',
      message: logData.message || '',
      userId: currentUser?.id,
      userName: currentUser?.fullName,
      timestamp: new Date(),
      ...logData
    };

    const logs = this.getAllLogs();
    logs.push(newLog);
    this.saveLogs(logs);

    return newLog;
  }

  // Specific logging methods for different events
  logUserLogin(userId: string, userName: string, success: boolean): void {
    this.createLog({
      type: LogType.USER_ACTION,
      category: LogCategory.AUTHENTICATION,
      severity: success ? LogSeverity.INFO : LogSeverity.WARNING,
      title: success ? 'User Login' : 'Failed Login Attempt',
      message: success
        ? `User ${userName} logged in successfully`
        : `Failed login attempt for user ${userName}`,
      userId,
      userName
    });
  }

  logUserLogout(userId: string, userName: string): void {
    this.createLog({
      type: LogType.USER_ACTION,
      category: LogCategory.AUTHENTICATION,
      severity: LogSeverity.INFO,
      title: 'User Logout',
      message: `User ${userName} logged out`,
      userId,
      userName
    });
  }

  logCashRequest(request: CashRequest, action: string): void {
    this.createLog({
      type: LogType.CASH_TRANSACTION,
      category: LogCategory.CASH_REQUEST,
      severity: LogSeverity.INFO,
      title: `Cash Request ${action}`,
      message: `Cash request ${request.id} ${action.toLowerCase()} by ${request.requesterName}`,
      requestId: request.id,
      metadata: {
        requesterId: request.requesterId,
        department: request.department,
        totalAmount: request.bankNotes.reduce((sum, note) => sum + (note.denomination * note.quantity), 0),
        status: request.status
      }
    });
  }

  logLateReturn(request: CashRequest): void {
    const currentTime = new Date();
    const deadline = new Date(request.expectedReturnDate || request.dateRequested);
    deadline.setHours(15, 0, 0, 0); // 3 PM deadline

    const hoursLate = Math.floor((currentTime.getTime() - deadline.getTime()) / (1000 * 60 * 60));

    this.createLog({
      type: LogType.DEADLINE_VIOLATION,
      category: LogCategory.DEADLINE_MONITORING,
      severity: hoursLate > 24 ? LogSeverity.CRITICAL : LogSeverity.WARNING,
      title: 'Late Cash Return',
      message: `Cash request ${request.id} returned ${hoursLate} hours late by ${request.requesterName}`,
      requestId: request.id,
      metadata: {
        requesterId: request.requesterId,
        expectedReturnDate: request.expectedReturnDate,
        actualReturnDate: request.actualReturnDate,
        hoursLate
      }
    });
  }

  logOverdueCash(request: CashRequest): void {
    const currentTime = new Date();
    const deadline = new Date(request.expectedReturnDate || request.dateRequested);
    deadline.setHours(15, 0, 0, 0); // 3 PM deadline

    const hoursOverdue = Math.floor((currentTime.getTime() - deadline.getTime()) / (1000 * 60 * 60));
    const minutesOverdue = Math.floor(((currentTime.getTime() - deadline.getTime()) % (1000 * 60 * 60)) / (1000 * 60));

    this.createLog({
      type: LogType.DEADLINE_VIOLATION,
      category: LogCategory.DEADLINE_MONITORING,
      severity: hoursOverdue > 24 ? LogSeverity.CRITICAL : LogSeverity.ERROR,
      title: 'Overdue Cash Detected',
      message: `Cash request ${request.id} is overdue by ${hoursOverdue}h ${minutesOverdue}m. Requester: ${request.requesterName}`,
      requestId: request.id,
      metadata: {
        requesterId: request.requesterId,
        requesterName: request.requesterName,
        department: request.department,
        expectedReturnDate: request.expectedReturnDate,
        hoursOverdue,
        minutesOverdue,
        totalAmount: request.bankNotes.reduce((sum, note) => sum + (note.denomination * note.quantity), 0),
        issuedBy: request.issuedBy
      }
    });
  }

  logOverdueWarning(request: CashRequest, minutesUntilOverdue: number): void {
    this.createLog({
      type: LogType.SYSTEM_EVENT,
      category: LogCategory.DEADLINE_MONITORING,
      severity: minutesUntilOverdue <= 5 ? LogSeverity.WARNING : LogSeverity.INFO,
      title: `Overdue Warning - ${minutesUntilOverdue} minutes remaining`,
      message: `Cash request ${request.id} will be overdue in ${minutesUntilOverdue} minutes. Requester: ${request.requesterName}`,
      requestId: request.id,
      metadata: {
        requesterId: request.requesterId,
        requesterName: request.requesterName,
        department: request.department,
        expectedReturnDate: request.expectedReturnDate,
        minutesUntilOverdue,
        totalAmount: request.bankNotes.reduce((sum, note) => sum + (note.denomination * note.quantity), 0),
        issuedBy: request.issuedBy
      }
    });
  }

  logAutoCancellation(request: CashRequest, cancellationInfo: any): void {
    const totalAmount = request.bankNotes.reduce((sum, note) => sum + (note.denomination * note.quantity), 0);
    const approvalDate = new Date(request.dateApproved || '');
    const cancellationDate = new Date();
    const hoursUncollected = Math.floor((cancellationDate.getTime() - approvalDate.getTime()) / (1000 * 60 * 60));

    this.createLog({
      type: LogType.SYSTEM_EVENT,
      category: LogCategory.CASH_REQUEST,
      severity: LogSeverity.WARNING,
      title: 'Auto-Cancellation: Uncollected Approved Cash',
      message: `Cash request ${request.id} auto-cancelled after ${hoursUncollected}h uncollected. Requester: ${request.requesterName}, Amount: R${totalAmount.toLocaleString()}`,
      requestId: request.id,
      metadata: {
        requesterId: request.requesterId,
        requesterName: request.requesterName,
        department: request.department,
        totalAmount,
        approvalDate: request.dateApproved,
        cancellationDate: request.dateCancelled,
        cancellationReason: request.cancellationReason,
        hoursUncollected,
        cancellationDeadline: cancellationInfo.cancellationDeadline,
        bankNotes: request.bankNotes,
        approvedBy: request.approvedBy,
        autoCancellation: true,
        isAutoCancelled: request.isAutoCancelled
      }
    });
  }

  logCashDiscrepancy(request: CashRequest, discrepancyDetails: string): void {
    this.createLog({
      type: LogType.DISCREPANCY,
      category: LogCategory.CASH_HANDLING,
      severity: LogSeverity.ERROR,
      title: 'Cash Discrepancy Detected',
      message: `Discrepancy found in cash request ${request.id}: ${discrepancyDetails}`,
      requestId: request.id,
      metadata: {
        requesterId: request.requesterId,
        discrepancyDetails,
        cashReceivedBy: request.cashReceivedBy
      }
    });
  }

  logInventoryChange(inventoryId: string, action: string, quantityChange: number, performedBy: string): void {
    this.createLog({
      type: LogType.INVENTORY_CHANGE,
      category: LogCategory.INVENTORY_MANAGEMENT,
      severity: LogSeverity.INFO,
      title: 'Inventory Updated',
      message: `Inventory ${inventoryId} ${action}: ${quantityChange > 0 ? '+' : ''}${quantityChange} units by ${performedBy}`,
      inventoryId,
      metadata: {
        action,
        quantityChange,
        performedBy
      }
    });
  }

  logManagerAction(action: string, details: string): void {
    const currentUser = this.userService.getCurrentUser();

    this.createLog({
      type: LogType.USER_ACTION,
      category: LogCategory.AUDIT_TRAIL,
      severity: LogSeverity.INFO,
      title: `Manager Action: ${action}`,
      message: `Manager ${currentUser?.fullName} performed: ${details}`,
      metadata: {
        action,
        details
      }
    });
  }

  getFilteredLogs(filter: LogFilter): SystemLog[] {
    let logs = this.getAllLogs();

    if (filter.startDate) {
      logs = logs.filter(log => log.timestamp >= filter.startDate!);
    }

    if (filter.endDate) {
      logs = logs.filter(log => log.timestamp <= filter.endDate!);
    }

    if (filter.types && filter.types.length > 0) {
      logs = logs.filter(log => filter.types!.includes(log.type));
    }

    if (filter.categories && filter.categories.length > 0) {
      logs = logs.filter(log => filter.categories!.includes(log.category));
    }

    if (filter.severities && filter.severities.length > 0) {
      logs = logs.filter(log => filter.severities!.includes(log.severity));
    }

    if (filter.userId) {
      logs = logs.filter(log => log.userId === filter.userId);
    }

    if (filter.requestId) {
      logs = logs.filter(log => log.requestId === filter.requestId);
    }

    if (filter.searchTerm) {
      const searchTerm = filter.searchTerm.toLowerCase();
      logs = logs.filter(log =>
        log.title.toLowerCase().includes(searchTerm) ||
        log.message.toLowerCase().includes(searchTerm) ||
        log.userName?.toLowerCase().includes(searchTerm)
      );
    }

    return logs.sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime());
  }

  getLogSummary(days: number = 30): LogSummary {
    const startDate = new Date();
    startDate.setDate(startDate.getDate() - days);

    const logs = this.getFilteredLogs({ startDate });

    const totalLogs = logs.length;
    const criticalCount = logs.filter(log => log.severity === LogSeverity.CRITICAL).length;
    const errorCount = logs.filter(log => log.severity === LogSeverity.ERROR).length;
    const warningCount = logs.filter(log => log.severity === LogSeverity.WARNING).length;
    const infoCount = logs.filter(log => log.severity === LogSeverity.INFO).length;

    const recentActivity = logs.slice(0, 10);

    // Calculate user activity
    const userActivityMap = new Map<string, UserActivity>();
    logs.forEach(log => {
      if (log.userId && log.userName) {
        if (!userActivityMap.has(log.userId)) {
          userActivityMap.set(log.userId, {
            userId: log.userId,
            userName: log.userName,
            actionCount: 0,
            lastActivity: log.timestamp
          });
        }
        const activity = userActivityMap.get(log.userId)!;
        activity.actionCount++;
        if (log.timestamp > activity.lastActivity) {
          activity.lastActivity = log.timestamp;
        }
      }
    });

    const topUsers = Array.from(userActivityMap.values())
      .sort((a, b) => b.actionCount - a.actionCount)
      .slice(0, 5);

    // Calculate category breakdown
    const categoryMap = new Map<LogCategory, number>();
    logs.forEach(log => {
      categoryMap.set(log.category, (categoryMap.get(log.category) || 0) + 1);
    });

    const categoryBreakdown: CategoryBreakdown[] = Array.from(categoryMap.entries()).map(([category, count]) => ({
      category,
      count,
      percentage: totalLogs > 0 ? (count / totalLogs) * 100 : 0
    }));

    return {
      totalLogs,
      criticalCount,
      errorCount,
      warningCount,
      infoCount,
      recentActivity,
      topUsers,
      categoryBreakdown
    };
  }

  generateAuditReport(startDate: Date, endDate: Date, title?: string): AuditReport {
    const currentUser = this.userService.getCurrentUser();
    if (!currentUser || !this.userService.hasManagerPrivileges()) {
      throw new Error('Insufficient privileges to generate audit report');
    }

    const logs = this.getFilteredLogs({ startDate, endDate });
    const summary = this.getLogSummary();

    // Calculate audit statistics
    const requestLogs = logs.filter(log => log.category === LogCategory.CASH_REQUEST);
    const totalRequests = new Set(requestLogs.map(log => log.requestId)).size;
    const completedRequests = requestLogs.filter(log =>
      log.message.includes('completed') || log.message.includes('returned')
    ).length;
    const lateReturns = logs.filter(log => log.type === LogType.DEADLINE_VIOLATION).length;
    const discrepancies = logs.filter(log => log.type === LogType.DISCREPANCY).length;

    const statistics: AuditStatistics = {
      totalRequests,
      completedRequests,
      lateReturns,
      discrepancies,
      averageProcessingTime: 0, // Would need more detailed tracking
      complianceScore: totalRequests > 0 ? ((totalRequests - lateReturns - discrepancies) / totalRequests) * 100 : 100,
      riskLevel: this.calculateRiskLevel(lateReturns, discrepancies, totalRequests)
    };

    const recommendations = this.generateRecommendations(statistics);

    const report: AuditReport = {
      id: this.generateReportId(),
      title: title || `Audit Report - ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
      description: `Comprehensive audit report covering system activity from ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`,
      generatedBy: currentUser.fullName,
      generatedAt: new Date(),
      period: { startDate, endDate },
      summary,
      logs,
      statistics,
      recommendations
    };

    // Save audit report
    this.saveAuditReport(report);

    // Log the audit report generation
    this.logManagerAction('Generate Audit Report', `Generated audit report for period ${startDate.toLocaleDateString()} to ${endDate.toLocaleDateString()}`);

    return report;
  }

  private calculateRiskLevel(lateReturns: number, discrepancies: number, totalRequests: number): RiskLevel {
    if (totalRequests === 0) return RiskLevel.LOW;

    const riskScore = ((lateReturns + discrepancies * 2) / totalRequests) * 100;

    if (riskScore >= 20) return RiskLevel.CRITICAL;
    if (riskScore >= 10) return RiskLevel.HIGH;
    if (riskScore >= 5) return RiskLevel.MEDIUM;
    return RiskLevel.LOW;
  }

  private generateRecommendations(statistics: AuditStatistics): string[] {
    const recommendations: string[] = [];

    if (statistics.lateReturns > 0) {
      recommendations.push('Implement stricter deadline monitoring and automated reminders');
    }

    if (statistics.discrepancies > 0) {
      recommendations.push('Review cash counting procedures and implement additional verification steps');
    }

    if (statistics.complianceScore < 90) {
      recommendations.push('Conduct additional training for cash handlers and requesters');
    }

    if (statistics.riskLevel === RiskLevel.HIGH || statistics.riskLevel === RiskLevel.CRITICAL) {
      recommendations.push('Immediate review of cash management processes required');
    }

    if (recommendations.length === 0) {
      recommendations.push('System operating within acceptable parameters - continue current procedures');
    }

    return recommendations;
  }

  private saveLogs(logs: SystemLog[]): void {
    this.localStorageService.setItem(this.LOGS_KEY, logs);
    this.logsSubject.next(logs);
  }

  private saveAuditReport(report: AuditReport): void {
    const reports = this.getAllAuditReports();
    reports.push(report);
    this.localStorageService.setItem(this.AUDIT_REPORTS_KEY, reports);
  }

  getAllAuditReports(): AuditReport[] {
    const reports = this.localStorageService.getItem<AuditReport[]>(this.AUDIT_REPORTS_KEY) || [];
    return reports.map(report => ({
      ...report,
      generatedAt: new Date(report.generatedAt),
      period: {
        startDate: new Date(report.period.startDate),
        endDate: new Date(report.period.endDate)
      }
    }));
  }

  exportLogs(filter?: LogFilter): string {
    const logs = filter ? this.getFilteredLogs(filter) : this.getAllLogs();

    const csvHeader = 'Timestamp,Type,Category,Severity,Title,Message,User,Request ID\n';
    const csvData = logs.map(log =>
      `"${log.timestamp.toISOString()}","${log.type}","${log.category}","${log.severity}","${log.title}","${log.message}","${log.userName || ''}","${log.requestId || ''}"`
    ).join('\n');

    return csvHeader + csvData;
  }
}
