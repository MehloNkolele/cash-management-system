import { Component, OnInit, ViewChild } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTabsModule, MatTabGroup } from '@angular/material/tabs';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';

import { NotificationPanelComponent } from '../notification-panel/notification-panel.component';

import { User } from '../../models/user.model';
import { CashRequest, RequestStatus, InventoryAvailability, InventoryValidationResult } from '../../models/cash-request.model';
import { Notification } from '../../models/notification.model';
import { UserService } from '../../services/user.service';
import { CashRequestService } from '../../services/cash-request.service';
import { InventoryService } from '../../services/inventory.service';
import { NotificationService } from '../../services/notification.service';
import { SystemLogService } from '../../services/system-log.service';
import { IssueService } from '../../services/issue.service';
import { ReportIssueModalComponent } from '../report-issue-modal/report-issue-modal.component';

@Component({
  selector: 'app-issuer-dashboard',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatTableModule,
    MatChipsModule,
    MatMenuModule,
    MatBadgeModule,
    MatTabsModule,
    MatDividerModule,
    MatDialogModule,
    NotificationPanelComponent
  ],
  templateUrl: './issuer-dashboard.component.html',
  styleUrl: './issuer-dashboard.component.scss'
})
export class IssuerDashboardComponent implements OnInit {
  @ViewChild('tabGroup') tabGroup!: MatTabGroup;

  currentUser: User | null = null;
  pendingRequests: CashRequest[] = [];
  activeRequests: CashRequest[] = [];
  allRequests: CashRequest[] = [];
  notifications: Notification[] = [];
  unreadNotificationCount = 0;
  selectedTabIndex = 0;

  // Inventory data for approvers
  inventoryAvailability: InventoryAvailability[] = [];
  totalInventoryValue: number = 0;
  totalInventoryNotes: number = 0;

  displayedColumns: string[] = ['requester', 'department', 'amount', 'inventory', 'dateRequested', 'status', 'actions'];

  constructor(
    private userService: UserService,
    private cashRequestService: CashRequestService,
    private inventoryService: InventoryService,
    private notificationService: NotificationService,
    private systemLogService: SystemLogService,
    private issueService: IssueService,
    private dialog: MatDialog,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.userService.getCurrentUser();
    if (!this.currentUser || !this.userService.isIssuer()) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadRequests();
    this.loadNotifications();
    this.loadInventoryData();

    // Subscribe to notification updates for real-time updates
    this.notificationService.notifications$.subscribe(() => {
      this.loadNotifications();
    });

    // Set up automatic refresh every 30 seconds
    setInterval(() => {
      this.refreshData();
    }, 30000);
  }

  private loadRequests(): void {
    this.allRequests = this.cashRequestService.getAllRequests();
    this.pendingRequests = this.cashRequestService.getPendingRequests();
    this.activeRequests = this.cashRequestService.getActiveRequests();
  }

  private loadNotifications(): void {
    if (this.currentUser) {
      this.notifications = this.notificationService.getNotificationsForUser(this.currentUser.id);
      this.unreadNotificationCount = this.notificationService.getUnreadNotificationsForUser(this.currentUser.id).length;


    }
  }

  private loadInventoryData(): void {
    // Load detailed inventory data for approvers
    this.inventoryAvailability = this.inventoryService.getInventoryAvailabilityForApprovers();

    const inventorySummary = this.inventoryService.getInventorySummary();
    this.totalInventoryValue = inventorySummary.totalValue;
    this.totalInventoryNotes = inventorySummary.totalNotes;
  }

  viewRequestDetails(request: CashRequest): void {
    this.router.navigate(['/request-details', request.id]);
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

  calculateTotalAmount(request: CashRequest): number {
    return request.bankNotes.reduce((total, note) => total + (note.denomination * note.quantity), 0);
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

  getPendingRequestsCount(): number {
    return this.pendingRequests.length;
  }

  getActiveRequestsCount(): number {
    return this.activeRequests.length;
  }

  getTotalRequestsCount(): number {
    return this.allRequests.length;
  }

  logout(): void {
    // Log user logout
    if (this.currentUser) {
      this.systemLogService.logUserLogout(this.currentUser.id, this.currentUser.fullName);
    }

    this.userService.logout();
    this.router.navigate(['/login']);
  }

  markNotificationsAsRead(): void {
    if (this.currentUser) {
      this.notificationService.markAllAsReadForUser(this.currentUser.id);
      this.unreadNotificationCount = 0;
    }
  }

  onNotificationClick(notification: Notification): void {
    // Navigate to request details if notification has requestId
    if (notification.requestId) {
      this.router.navigate(['/request-details', notification.requestId]);
    }
  }

  refreshData(): void {
    this.loadRequests();
    this.loadNotifications();
    this.loadInventoryData();
  }

  navigateToTab(tabIndex: number): void {
    console.log('Navigating to tab:', tabIndex);
    this.selectedTabIndex = tabIndex;

    // Force change detection
    setTimeout(() => {
      if (this.tabGroup) {
        this.tabGroup.selectedIndex = tabIndex;
      }
    }, 0);
  }

  onTabChange(index: number): void {
    console.log('Tab changed to:', index);
    this.selectedTabIndex = index;
  }

  onViewInventory(): void {
    this.router.navigate(['/inventory-management']);
  }

  // Get inventory validation for a specific request
  getInventoryValidation(request: CashRequest): InventoryValidationResult {
    return this.inventoryService.validateCashRequest(request.bankNotes);
  }

  // Check if request has inventory warnings
  hasInventoryWarnings(request: CashRequest): boolean {
    const validation = this.getInventoryValidation(request);
    return validation.warnings.length > 0;
  }

  // Check if request has inventory errors
  hasInventoryErrors(request: CashRequest): boolean {
    const validation = this.getInventoryValidation(request);
    return validation.errors.length > 0;
  }

  // Get inventory status for a denomination
  getInventoryStatusForDenomination(denomination: number): string {
    const availability = this.inventoryAvailability.find(item => item.denomination === denomination);
    return availability?.status || 'unknown';
  }

  // Format inventory numbers
  formatInventoryNumber(num: number): string {
    return new Intl.NumberFormat('en-ZA').format(num);
  }

  navigateToDashboard(): void {
    // Already on issuer dashboard, but could refresh or scroll to top
    window.scrollTo(0, 0);
  }

  onReportIssue(): void {
    const dialogRef = this.dialog.open(ReportIssueModalComponent, {
      width: '700px',
      disableClose: true,
      data: {
        // Could pass current request context if needed
      }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        // Refresh data to show any updates
        this.refreshData();
      }
    });
  }
}
