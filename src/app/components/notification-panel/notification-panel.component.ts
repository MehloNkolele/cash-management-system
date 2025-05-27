import { Component, Input, Output, EventEmitter, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatMenuModule } from '@angular/material/menu';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatRippleModule } from '@angular/material/core';

import { Notification, NotificationType } from '../../models/notification.model';
import { NotificationService } from '../../services/notification.service';

@Component({
  selector: 'app-notification-panel',
  standalone: true,
  imports: [
    CommonModule,
    MatMenuModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatDividerModule,
    MatSnackBarModule,
    MatTooltipModule,
    MatRippleModule
  ],
  templateUrl: './notification-panel.component.html',
  styleUrl: './notification-panel.component.scss'
})
export class NotificationPanelComponent implements OnInit, OnDestroy {
  @Input() notifications: Notification[] = [];
  @Input() unreadCount: number = 0;
  @Input() userId: string = '';
  @Output() notificationClick = new EventEmitter<Notification>();
  @Output() markAllAsRead = new EventEmitter<void>();

  private deletedNotificationsForUndo: Notification[] = [];

  constructor(
    private notificationService: NotificationService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    // Subscribe to notification changes
    this.notificationService.notifications$.subscribe(notifications => {
      if (this.userId) {
        this.notifications = notifications.filter(n => n.recipientId === this.userId)
          .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
      }
    });

    // Refresh notifications every minute to update time remaining
    setInterval(() => {
      // Force change detection by creating a new array reference
      this.notifications = [...this.notifications];
    }, 60000); // Update every minute
  }

  ngOnDestroy(): void {
    // Clean up any pending undo operations
    this.deletedNotificationsForUndo = [];
  }

  onNotificationClick(notification: Notification): void {
    if (!notification.isRead) {
      this.notificationService.markAsRead(notification.id);
    }
    this.notificationClick.emit(notification);
  }

  onMarkAllAsRead(): void {
    this.markAllAsRead.emit();
  }

  deleteNotification(event: Event, notification: Notification): void {
    event.stopPropagation();

    const result = this.notificationService.deleteNotification(notification.id);

    if (result.success && result.notification) {
      // Show undo snackbar
      const snackBarRef = this.snackBar.open(
        `Notification deleted`,
        'UNDO',
        {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['notification-snackbar']
        }
      );

      snackBarRef.onAction().subscribe(() => {
        this.undoDeleteNotification(notification.id);
      });
    }
  }

  clearAllNotifications(): void {
    const result = this.notificationService.clearAllNotificationsForUser(this.userId);

    if (result.success) {
      this.deletedNotificationsForUndo = result.notifications;

      // Show undo snackbar
      const snackBarRef = this.snackBar.open(
        `${result.deletedCount} notifications cleared`,
        'UNDO',
        {
          duration: 3000,
          horizontalPosition: 'right',
          verticalPosition: 'top',
          panelClass: ['notification-snackbar']
        }
      );

      snackBarRef.onAction().subscribe(() => {
        this.undoClearAllNotifications();
      });
    }
  }

  private undoDeleteNotification(notificationId: string): void {
    const success = this.notificationService.undoDeleteNotification(notificationId);
    if (success) {
      this.snackBar.open('Notification restored', '', {
        duration: 2000,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['success-snackbar']
      });
    }
  }

  private undoClearAllNotifications(): void {
    const success = this.notificationService.undoClearAllNotifications(this.deletedNotificationsForUndo);
    if (success) {
      this.snackBar.open('All notifications restored', '', {
        duration: 2000,
        horizontalPosition: 'right',
        verticalPosition: 'top',
        panelClass: ['success-snackbar']
      });
      this.deletedNotificationsForUndo = [];
    }
  }

  getNotificationIcon(type: NotificationType): string {
    switch (type) {
      case NotificationType.NEW_REQUEST:
        return 'mail';
      case NotificationType.REQUEST_APPROVED:
        return 'check_circle';
      case NotificationType.CASH_ISSUED:
        return 'payments';
      case NotificationType.RETURN_REMINDER:
        return 'schedule';
      case NotificationType.CASH_RETURNED:
        return 'assignment_return';
      case NotificationType.REQUEST_COMPLETED:
        return 'done_all';
      default:
        return 'info';
    }
  }

  getNotificationColor(type: NotificationType): string {
    switch (type) {
      case NotificationType.NEW_REQUEST:
        return 'primary';
      case NotificationType.REQUEST_APPROVED:
        return 'accent';
      case NotificationType.CASH_ISSUED:
        return 'primary';
      case NotificationType.RETURN_REMINDER:
        return 'warn';
      case NotificationType.CASH_RETURNED:
        return 'accent';
      case NotificationType.REQUEST_COMPLETED:
        return 'primary';
      default:
        return '';
    }
  }

  getTimeAgo(date: Date): string {
    const now = new Date();
    const diffInMinutes = Math.floor((now.getTime() - date.getTime()) / (1000 * 60));

    if (diffInMinutes < 1) {
      return 'Just now';
    } else if (diffInMinutes < 60) {
      return `${diffInMinutes}m ago`;
    } else if (diffInMinutes < 1440) {
      const hours = Math.floor(diffInMinutes / 60);
      return `${hours}h ago`;
    } else {
      const days = Math.floor(diffInMinutes / 1440);
      return `${days}d ago`;
    }
  }

  hasNotifications(): boolean {
    return this.notifications && this.notifications.length > 0;
  }

  getDisplayNotifications(): Notification[] {
    return this.notifications.slice(0, 10); // Show max 10 notifications
  }

  trackByNotificationId(index: number, notification: Notification): string {
    return notification.id;
  }

  getNotificationTypeLabel(type: NotificationType): string {
    switch (type) {
      case NotificationType.NEW_REQUEST:
        return 'New Request';
      case NotificationType.REQUEST_APPROVED:
        return 'Approved';
      case NotificationType.CASH_ISSUED:
        return 'Cash Issued';
      case NotificationType.RETURN_REMINDER:
        return 'Reminder';
      case NotificationType.CASH_RETURNED:
        return 'Returned';
      case NotificationType.REQUEST_COMPLETED:
        return 'Completed';
      default:
        return 'Notification';
    }
  }

  /**
   * Gets dynamic notification content that updates based on current time
   */
  getDynamicNotificationContent(notification: Notification): { title: string; message: string } {
    return this.notificationService.getDynamicNotificationContent(notification);
  }
}
