import { Component, OnInit, OnDestroy, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

// Angular Material Imports
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule, MatTabGroup } from '@angular/material/tabs';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatBadgeModule } from '@angular/material/badge';
import { MatProgressBarModule } from '@angular/material/progress-bar';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

// Models
import { User } from '../../models/user.model';
import { CashRequest, RequestStatus } from '../../models/cash-request.model';
import { InventorySummary, LowStockAlert, AlertSeverity, NoteSeries, NoteDenomination } from '../../models/inventory.model';
import { SystemLog, LogSeverity } from '../../models/system-log.model';
import { Notification } from '../../models/notification.model';

// Services
import { UserService } from '../../services/user.service';
import { CashRequestService } from '../../services/cash-request.service';
import { InventoryService } from '../../services/inventory.service';
import { SystemLogService } from '../../services/system-log.service';
import { NotificationService } from '../../services/notification.service';
import { OverdueMonitoringService } from '../../services/overdue-monitoring.service';

// Components
import { NotificationPanelComponent } from '../notification-panel/notification-panel.component';
import { AddCashModalComponent } from '../add-cash-modal/add-cash-modal.component';
import { ProcessReturnsModalComponent } from '../process-returns-modal/process-returns-modal.component';
import { SystemLogsModalComponent } from '../system-logs-modal/system-logs-modal.component';
import { LogDetailsModalComponent } from '../log-details-modal/log-details-modal.component';
import { OverdueAlertComponent } from '../overdue-alert/overdue-alert.component';

@Component({
  selector: 'app-manager-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatMenuModule,
    MatDividerModule,
    MatTabsModule,
    MatTableModule,
    MatChipsModule,
    MatBadgeModule,
    MatProgressBarModule,
    MatSnackBarModule,
    MatDialogModule,
    NotificationPanelComponent,
    OverdueAlertComponent
  ],
  templateUrl: './manager-dashboard.component.html',
  styleUrls: ['./manager-dashboard.component.scss']
})
export class ManagerDashboardComponent implements OnInit, OnDestroy {
  @ViewChild('tabGroup') tabGroup!: MatTabGroup;

  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  selectedTabIndex = 0;

  // Dashboard Data
  inventorySummary: InventorySummary | null = null;
  activeRequests: CashRequest[] = [];
  overdueRequests: CashRequest[] = [];
  recentLogs: SystemLog[] = [];
  notifications: Notification[] = [];
  unreadNotificationCount = 0;

  // Statistics
  totalInventoryValue = 0;
  totalActiveRequests = 0;
  criticalAlerts = 0;

  // Display columns for tables
  requestColumns: string[] = ['id', 'requester', 'amount', 'status', 'deadline', 'actions'];
  alertColumns: string[] = ['series', 'denomination', 'quantity', 'threshold', 'severity'];
  logColumns: string[] = ['timestamp', 'type', 'severity', 'message'];

  constructor(
    private userService: UserService,
    private cashRequestService: CashRequestService,
    private inventoryService: InventoryService,
    private systemLogService: SystemLogService,
    private notificationService: NotificationService,
    private overdueMonitoringService: OverdueMonitoringService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.currentUser = this.userService.getCurrentUser();

    // Check if user has manager privileges
    if (!this.currentUser || !this.userService.hasManagerPrivileges()) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadDashboardData();
    this.setupSubscriptions();

    // Log manager dashboard access
    this.systemLogService.logManagerAction('Dashboard Access', 'Accessed manager dashboard');

    // Create a test request if none exist (for demonstration)
    // this.createTestRequestIfNeeded();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSubscriptions(): void {
    // Subscribe to real-time updates
    this.cashRequestService.requests$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadRequestData();
      });

    this.inventoryService.inventory$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadInventoryData();
      });

    this.systemLogService.logs$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadLogData();
      });

    this.notificationService.notifications$
      .pipe(takeUntil(this.destroy$))
      .subscribe(notifications => {
        this.notifications = notifications.filter(n => n.recipientId === this.currentUser?.id);
        this.unreadNotificationCount = this.notifications.filter(n => !n.isRead).length;
      });
  }

  private loadDashboardData(): void {
    this.loadInventoryData();
    this.loadRequestData();
    this.loadLogData();
    this.loadNotifications();
  }

  private loadInventoryData(): void {
    this.inventorySummary = this.inventoryService.getInventorySummary();
    this.totalInventoryValue = this.inventorySummary.totalValue;
    this.criticalAlerts = this.inventorySummary.lowStockAlerts.filter(
      alert => alert.severity === AlertSeverity.CRITICAL || alert.severity === AlertSeverity.HIGH
    ).length;
  }

  private loadRequestData(): void {
    const allRequests = this.cashRequestService.getAllRequests();

    // Active requests (not completed, cancelled, or rejected)
    this.activeRequests = allRequests.filter(request =>
      ![RequestStatus.COMPLETED, RequestStatus.CANCELLED, RequestStatus.REJECTED].includes(request.status)
    );

    this.totalActiveRequests = this.activeRequests.length;

    // Overdue requests (past 3pm deadline)
    const now = new Date();
    this.overdueRequests = allRequests.filter(request => {
      if (!request.expectedReturnDate || request.status === RequestStatus.COMPLETED) {
        return false;
      }

      const deadline = new Date(request.expectedReturnDate);
      deadline.setHours(15, 0, 0, 0); // 3 PM deadline

      return now > deadline && request.status !== RequestStatus.RETURNED;
    });
  }

  private loadLogData(): void {
    const logSummary = this.systemLogService.getLogSummary(7); // Last 7 days
    this.recentLogs = logSummary.recentActivity.slice(0, 5);
  }

  private loadNotifications(): void {
    this.notifications = this.notificationService.getNotificationsForUser(this.currentUser?.id || '');
    this.unreadNotificationCount = this.notifications.filter(n => !n.isRead).length;


  }

  // Action Methods
  onAddCash(): void {
    const dialogRef = this.dialog.open(AddCashModalComponent, {
      width: '500px',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        this.loadDashboardData();
        this.snackBar.open(`Successfully added ${result.added} notes to inventory`, 'Close', { duration: 3000 });
      }
    });
  }

  onProcessReturns(): void {
    const dialogRef = this.dialog.open(ProcessReturnsModalComponent, {
      width: '1000px',
      maxWidth: '90vw',
      disableClose: true
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        this.loadDashboardData();
        this.snackBar.open(`Successfully processed ${result.processed} return(s)`, 'Close', { duration: 3000 });
      }
    });
  }

  onGenerateAuditReport(): void {
    try {
      const endDate = new Date();
      const startDate = new Date();
      startDate.setDate(startDate.getDate() - 30); // Last 30 days

      const report = this.systemLogService.generateAuditReport(startDate, endDate);

      this.snackBar.open('Audit report generated successfully', 'Close', { duration: 3000 });

      // TODO: Open audit report viewer or download
      console.log('Generated audit report:', report);
    } catch (error) {
      this.snackBar.open('Error generating audit report', 'Close', { duration: 3000 });
    }
  }

  onViewRequest(request: CashRequest): void {
    this.router.navigate(['/request-details', request.id]);
  }

  // Manager Request Management Methods
  onApproveRequest(request: CashRequest): void {
    if (!this.currentUser) return;

    try {
      const expectedReturnDate = new Date();
      expectedReturnDate.setDate(expectedReturnDate.getDate() + 1); // Default to tomorrow

      const updatedRequest = this.cashRequestService.approveRequest(
        request.id,
        this.currentUser.id,
        expectedReturnDate
      );

      if (updatedRequest) {
        this.systemLogService.logManagerAction(
          'Approve Cash Request',
          `Approved cash request ${request.id} from ${request.requesterName} for ${this.formatCurrency(this.calculateRequestTotal(request))}`
        );

        this.snackBar.open('Request approved successfully', 'Close', { duration: 3000 });
        this.loadRequestData();
      }
    } catch (error) {
      console.error('Error approving request:', error);
      this.snackBar.open('Error approving request', 'Close', { duration: 3000 });
    }
  }

  onRejectRequest(request: CashRequest): void {
    if (!this.currentUser) return;

    try {
      const updatedRequest = this.cashRequestService.cancelRequest(
        request.id,
        'Request rejected by manager'
      );

      if (updatedRequest) {
        this.systemLogService.logManagerAction(
          'Reject Cash Request',
          `Rejected cash request ${request.id} from ${request.requesterName} for ${this.formatCurrency(this.calculateRequestTotal(request))}`
        );

        this.snackBar.open('Request rejected successfully', 'Close', { duration: 3000 });
        this.loadRequestData();
      }
    } catch (error) {
      console.error('Error rejecting request:', error);
      this.snackBar.open('Error rejecting request', 'Close', { duration: 3000 });
    }
  }

  onIssueCash(request: CashRequest): void {
    if (!this.currentUser) return;

    try {
      const updatedRequest = this.cashRequestService.issueCash(request.id, true);

      if (updatedRequest) {
        this.systemLogService.logManagerAction(
          'Issue Cash',
          `Issued cash for request ${request.id} to ${request.requesterName} - ${this.formatCurrency(this.calculateRequestTotal(request))}`
        );

        this.snackBar.open('Cash issued successfully', 'Close', { duration: 3000 });
        this.loadRequestData();
      }
    } catch (error) {
      console.error('Error issuing cash:', error);
      this.snackBar.open('Error issuing cash', 'Close', { duration: 3000 });
    }
  }

  onCompleteRequest(request: CashRequest): void {
    if (!this.currentUser) return;

    try {
      const updatedRequest = this.cashRequestService.completeRequest(request.id);

      if (updatedRequest) {
        this.systemLogService.logManagerAction(
          'Complete Cash Request',
          `Completed cash request ${request.id} from ${request.requesterName}`
        );

        this.snackBar.open('Request completed successfully', 'Close', { duration: 3000 });
        this.loadRequestData();
      }
    } catch (error) {
      console.error('Error completing request:', error);
      this.snackBar.open('Error completing request', 'Close', { duration: 3000 });
    }
  }

  // Helper methods for request management
  canApprove(request: CashRequest): boolean {
    return request.status === RequestStatus.PENDING;
  }

  canIssue(request: CashRequest): boolean {
    return request.status === RequestStatus.APPROVED;
  }

  canComplete(request: CashRequest): boolean {
    return request.status === RequestStatus.RETURNED;
  }

  canReject(request: CashRequest): boolean {
    return request.status === RequestStatus.PENDING || request.status === RequestStatus.APPROVED;
  }

  onViewLogs(): void {
    const dialogRef = this.dialog.open(SystemLogsModalComponent, {
      width: '90vw',
      height: '80vh',
      maxWidth: '1200px',
      maxHeight: '800px'
    });

    dialogRef.afterClosed().subscribe(() => {
      // Refresh data in case any logs were exported or actions taken
      this.loadLogData();
    });
  }

  onViewInventory(): void {
    this.router.navigate(['/inventory-management']);
  }

  onRefreshData(): void {
    this.loadDashboardData();
    this.snackBar.open('Dashboard data refreshed', 'Close', { duration: 2000 });
  }

  // Notification Methods
  onNotificationClick(notification: Notification): void {
    this.notificationService.markAsRead(notification.id);

    if (notification.requestId) {
      this.router.navigate(['/request-details', notification.requestId]);
    }
  }

  markNotificationsAsRead(): void {
    const unreadIds = this.notifications.filter(n => !n.isRead).map(n => n.id);
    this.notificationService.markMultipleAsRead(unreadIds);
  }

  // Utility Methods
  getStatusClass(status: RequestStatus): string {
    return `status-${status.toLowerCase()}`;
  }

  getStatusColor(status: RequestStatus): string {
    switch (status) {
      case RequestStatus.PENDING:
        return 'warn';
      case RequestStatus.APPROVED:
        return 'accent';
      case RequestStatus.ISSUED:
        return 'primary';
      case RequestStatus.RETURNED:
        return 'accent';
      case RequestStatus.COMPLETED:
        return 'primary';
      case RequestStatus.CANCELLED:
        return 'warn';
      case RequestStatus.REJECTED:
        return 'warn';
      default:
        return '';
    }
  }

  getStatusIcon(status: RequestStatus): string {
    switch (status) {
      case RequestStatus.PENDING:
        return 'schedule';
      case RequestStatus.APPROVED:
        return 'check_circle';
      case RequestStatus.ISSUED:
        return 'payments';
      case RequestStatus.RETURNED:
        return 'assignment_return';
      case RequestStatus.COMPLETED:
        return 'done_all';
      case RequestStatus.CANCELLED:
        return 'cancel';
      case RequestStatus.REJECTED:
        return 'block';
      default:
        return 'help';
    }
  }

  getSeverityClass(severity: AlertSeverity | LogSeverity): string {
    return `severity-${severity.toLowerCase()}`;
  }

  getSeverityIcon(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL: return 'error';
      case AlertSeverity.HIGH: return 'warning';
      case AlertSeverity.MEDIUM: return 'info';
      case AlertSeverity.LOW: return 'check_circle';
      default: return 'info';
    }
  }

  getLogSeverityIcon(severity: LogSeverity): string {
    switch (severity) {
      case LogSeverity.CRITICAL: return 'error';
      case LogSeverity.ERROR: return 'error_outline';
      case LogSeverity.WARNING: return 'warning';
      case LogSeverity.INFO: return 'info';
      default: return 'info';
    }
  }

  formatCurrency(amount: number): string {
    // For large amounts, use compact notation for better display
    if (amount >= 1000000) {
      return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        notation: 'compact',
        maximumFractionDigits: 1
      }).format(amount);
    } else if (amount >= 10000) {
      return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR',
        maximumFractionDigits: 0
      }).format(amount);
    } else {
      return new Intl.NumberFormat('en-ZA', {
        style: 'currency',
        currency: 'ZAR'
      }).format(amount);
    }
  }

  formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }

  calculateRequestTotal(request: CashRequest): number {
    return request.bankNotes.reduce((sum, note) => sum + (note.denomination * note.quantity), 0);
  }

  // Tab Navigation Methods
  navigateToTab(tabIndex: number): void {
    console.log('Manager Dashboard - Navigating to tab:', tabIndex);
    this.selectedTabIndex = tabIndex;

    // Force change detection
    setTimeout(() => {
      if (this.tabGroup) {
        this.tabGroup.selectedIndex = tabIndex;
      }
    }, 0);
  }

  onTabChange(index: number): void {
    console.log('Manager Dashboard - Tab changed to:', index);
    this.selectedTabIndex = index;
  }

  // Navigation methods for metric cards
  navigateToActiveRequests(): void {
    this.navigateToTab(1); // Active Requests is the second tab (index 1)
  }

  navigateToInventory(): void {
    this.navigateToTab(0); // Inventory Overview is the first tab (index 0)
  }

  navigateToRecentActivity(): void {
    this.navigateToTab(2); // Recent Activity is the third tab (index 2)
  }

  navigateToCriticalAlerts(): void {
    this.router.navigate(['/alerts-overview']);
  }

  // Log Details Methods
  onLogClick(log: SystemLog): void {
    const dialogRef = this.dialog.open(LogDetailsModalComponent, {
      width: '90vw',
      maxWidth: '800px',
      maxHeight: '90vh',
      data: log
    });

    dialogRef.afterClosed().subscribe(() => {
      // Optional: Handle any actions after the details modal is closed
    });
  }

  logout(): void {
    this.systemLogService.logUserLogout(this.currentUser?.id || '', this.currentUser?.fullName || '');
    this.userService.logout();
    this.router.navigate(['/login']);
  }

  navigateToDashboard(): void {
    // Already on manager dashboard, but could refresh or scroll to top
    window.scrollTo(0, 0);
  }

  // Test method to create sample requests for demonstration
  private createTestRequestIfNeeded(): void {
    const allRequests = this.cashRequestService.getAllRequests();

    if (allRequests.length === 0) {
      // Get Bennet as the requester
      const bennet = this.userService.getUserById('3'); // Bennet's ID

      if (bennet) {
        // Temporarily set Bennet as current user to create request
        const originalUser = this.userService.getCurrentUser();
        this.userService.setCurrentUser(bennet);

        try {
          // Create a test request
          const testRequest = this.cashRequestService.createRequest({
            department: bennet.department,
            bankNotes: [
              { denomination: 100, quantity: 10 },
              { denomination: 200, quantity: 5 }
            ],
            dateRequested: new Date(),
            status: RequestStatus.PENDING
          });

          console.log('Created test request:', testRequest);

          // Restore original user
          if (originalUser) {
            this.userService.setCurrentUser(originalUser);
          }

          // Reload data to show the new request
          this.loadRequestData();
        } catch (error) {
          console.error('Error creating test request:', error);
          // Restore original user even if error occurs
          if (originalUser) {
            this.userService.setCurrentUser(originalUser);
          }
        }
      }
    }
  }

}
