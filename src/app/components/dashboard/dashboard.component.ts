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
import { MatDividerModule } from '@angular/material/divider';
import { MatTabsModule, MatTabGroup } from '@angular/material/tabs';

import { NotificationPanelComponent } from '../notification-panel/notification-panel.component';

import { User } from '../../models/user.model';
import { CashRequest, RequestStatus } from '../../models/cash-request.model';
import { Notification } from '../../models/notification.model';
import { UserService } from '../../services/user.service';
import { CashRequestService } from '../../services/cash-request.service';
import { NotificationService } from '../../services/notification.service';
import { SystemLogService } from '../../services/system-log.service';

@Component({
  selector: 'app-dashboard',
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
    MatDividerModule,
    MatTabsModule,
    NotificationPanelComponent
  ],
  templateUrl: './dashboard.component.html',
  styleUrl: './dashboard.component.scss'
})
export class DashboardComponent implements OnInit {
  @ViewChild('tabGroup') tabGroup!: MatTabGroup;

  currentUser: User | null = null;
  userRequests: CashRequest[] = [];
  pendingRequests: CashRequest[] = [];
  activeRequests: CashRequest[] = [];
  completedRequests: CashRequest[] = [];
  notifications: Notification[] = [];
  unreadNotificationCount = 0;
  selectedTabIndex = 0;

  displayedColumns: string[] = ['id', 'dateRequested', 'amount', 'status', 'expectedReturn', 'actions'];

  constructor(
    private userService: UserService,
    private cashRequestService: CashRequestService,
    private notificationService: NotificationService,
    private systemLogService: SystemLogService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.userService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadUserRequests();
    this.loadNotifications();

    // Set up automatic refresh every 30 seconds
    setInterval(() => {
      this.refreshData();
    }, 30000);
  }

  private loadUserRequests(): void {
    if (this.currentUser) {
      this.userRequests = this.cashRequestService.getRequestsByUser(this.currentUser.id);
      this.pendingRequests = this.userRequests.filter(request => request.status === RequestStatus.PENDING);
      this.activeRequests = this.userRequests.filter(request =>
        [RequestStatus.APPROVED, RequestStatus.ISSUED].includes(request.status)
      );
      this.completedRequests = this.userRequests.filter(request =>
        [RequestStatus.RETURNED, RequestStatus.COMPLETED].includes(request.status)
      );
    }
  }

  private loadNotifications(): void {
    if (this.currentUser) {
      this.notifications = this.notificationService.getNotificationsForUser(this.currentUser.id);
      this.unreadNotificationCount = this.notificationService.getUnreadNotificationsForUser(this.currentUser.id).length;
    }
  }

  createNewRequest(): void {
    this.router.navigate(['/request-form']);
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
    return `R${amount.toLocaleString()}`;
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

  getPendingRequestsCount(): number {
    return this.pendingRequests.length;
  }

  getActiveRequestsCount(): number {
    return this.activeRequests.length;
  }

  getCompletedRequestsCount(): number {
    return this.completedRequests.length;
  }

  getTotalRequestsCount(): number {
    return this.userRequests.length;
  }

  navigateToTab(tabIndex: number): void {
    console.log('Dashboard - Navigating to tab:', tabIndex);
    this.selectedTabIndex = tabIndex;

    // Force change detection
    setTimeout(() => {
      if (this.tabGroup) {
        this.tabGroup.selectedIndex = tabIndex;
      }
    }, 0);
  }

  onTabChange(index: number): void {
    console.log('Dashboard - Tab changed to:', index);
    this.selectedTabIndex = index;
  }

  refreshData(): void {
    this.loadUserRequests();
    this.loadNotifications();
  }

  navigateToDashboard(): void {
    // Already on dashboard, but could refresh or scroll to top
    window.scrollTo(0, 0);
  }
}
