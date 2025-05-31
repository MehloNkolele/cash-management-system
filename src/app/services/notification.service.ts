import { Injectable, Inject, forwardRef } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notification, NotificationType } from '../models/notification.model';
import { CashRequest, RejectionResult } from '../models/cash-request.model';
import { LocalStorageService } from './local-storage.service';
import { UserService } from './user.service';
import { TimeUtilityService } from './time-utility.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly NOTIFICATIONS_KEY = 'cash_mgmt_notifications';
  private readonly DELETED_NOTIFICATIONS_KEY = 'cash_mgmt_deleted_notifications';

  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  private deletedNotifications: Notification[] = [];
  private undoTimers: Map<string, any> = new Map();

  private cashRequestService: any = null;

  constructor(
    private localStorageService: LocalStorageService,
    private userService: UserService,
    private timeUtilityService: TimeUtilityService
  ) {
    this.loadNotifications();
    this.loadDeletedNotifications();
    this.checkScheduledNotifications();
  }

  // Method to set the cash request service to avoid circular dependency
  setCashRequestService(cashRequestService: any): void {
    this.cashRequestService = cashRequestService;
  }

  private loadNotifications(): void {
    const notifications = this.getAllNotifications();
    this.notificationsSubject.next(notifications);
  }

  private loadDeletedNotifications(): void {
    this.deletedNotifications = this.localStorageService.getItem<Notification[]>(this.DELETED_NOTIFICATIONS_KEY) || [];
  }

  private saveDeletedNotifications(): void {
    this.localStorageService.setItem(this.DELETED_NOTIFICATIONS_KEY, this.deletedNotifications);
  }

  private generateId(): string {
    return 'notif_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  getAllNotifications(): Notification[] {
    const notifications = this.localStorageService.getItem<Notification[]>(this.NOTIFICATIONS_KEY) || [];
    // Convert date strings back to Date objects
    return notifications.map(notification => ({
      ...notification,
      createdAt: new Date(notification.createdAt),
      scheduledFor: notification.scheduledFor ? new Date(notification.scheduledFor) : undefined
    }));
  }

  getNotificationsForUser(userId: string): Notification[] {
    return this.getAllNotifications()
      .filter(notification => notification.recipientId === userId)
      .sort((a, b) => b.createdAt.getTime() - a.createdAt.getTime());
  }

  getUnreadNotificationsForUser(userId: string): Notification[] {
    return this.getNotificationsForUser(userId).filter(notification => !notification.isRead);
  }

  createNotification(notification: Omit<Notification, 'id' | 'createdAt' | 'isRead'>): Notification {
    const newNotification: Notification = {
      ...notification,
      id: this.generateId(),
      isRead: false,
      createdAt: new Date()
    };

    const notifications = this.getAllNotifications();
    notifications.push(newNotification);
    this.saveNotifications(notifications);

    // Trigger the observable to notify subscribers
    this.notificationsSubject.next(notifications);

    return newNotification;
  }

  markAsRead(notificationId: string): void {
    const notifications = this.getAllNotifications();
    const notification = notifications.find(n => n.id === notificationId);

    if (notification) {
      notification.isRead = true;
      this.saveNotifications(notifications);
      this.notificationsSubject.next(notifications);
    }
  }

  markMultipleAsRead(notificationIds: string[]): void {
    const notifications = this.getAllNotifications();
    let updated = false;

    notificationIds.forEach(id => {
      const notification = notifications.find(n => n.id === id);
      if (notification && !notification.isRead) {
        notification.isRead = true;
        updated = true;
      }
    });

    if (updated) {
      this.saveNotifications(notifications);
      this.notificationsSubject.next(notifications);
    }
  }

  markAllAsReadForUser(userId: string): void {
    const notifications = this.getAllNotifications();
    const userNotifications = notifications.filter(n => n.recipientId === userId);

    userNotifications.forEach(notification => {
      notification.isRead = true;
    });

    this.saveNotifications(notifications);
    this.notificationsSubject.next(notifications);
  }

  deleteNotification(notificationId: string): { success: boolean; notification?: Notification } {
    const notifications = this.getAllNotifications();
    const notificationIndex = notifications.findIndex(n => n.id === notificationId);

    if (notificationIndex === -1) {
      return { success: false };
    }

    const deletedNotification = notifications[notificationIndex];

    // Remove from active notifications
    notifications.splice(notificationIndex, 1);
    this.saveNotifications(notifications);

    // Add to deleted notifications for undo functionality
    this.deletedNotifications.push(deletedNotification);
    this.saveDeletedNotifications();

    // Set up auto-permanent delete after 3 seconds
    const timer = setTimeout(() => {
      this.permanentlyDeleteNotification(notificationId);
    }, 3000);

    this.undoTimers.set(notificationId, timer);

    return { success: true, notification: deletedNotification };
  }

  undoDeleteNotification(notificationId: string): boolean {
    // Clear the timer
    const timer = this.undoTimers.get(notificationId);
    if (timer) {
      clearTimeout(timer);
      this.undoTimers.delete(notificationId);
    }

    // Find the notification in deleted notifications
    const deletedIndex = this.deletedNotifications.findIndex(n => n.id === notificationId);
    if (deletedIndex === -1) {
      return false;
    }

    const notification = this.deletedNotifications[deletedIndex];

    // Remove from deleted notifications
    this.deletedNotifications.splice(deletedIndex, 1);
    this.saveDeletedNotifications();

    // Add back to active notifications
    const notifications = this.getAllNotifications();
    notifications.push(notification);
    this.saveNotifications(notifications);

    return true;
  }

  private permanentlyDeleteNotification(notificationId: string): void {
    const deletedIndex = this.deletedNotifications.findIndex(n => n.id === notificationId);
    if (deletedIndex !== -1) {
      this.deletedNotifications.splice(deletedIndex, 1);
      this.saveDeletedNotifications();
    }
    this.undoTimers.delete(notificationId);
  }

  clearAllNotificationsForUser(userId: string): { success: boolean; deletedCount: number; notifications: Notification[] } {
    const notifications = this.getAllNotifications();
    const userNotifications = notifications.filter(n => n.recipientId === userId);
    const otherNotifications = notifications.filter(n => n.recipientId !== userId);

    if (userNotifications.length === 0) {
      return { success: false, deletedCount: 0, notifications: [] };
    }

    // Save only non-user notifications
    this.saveNotifications(otherNotifications);

    // Add user notifications to deleted for undo functionality
    userNotifications.forEach(notification => {
      this.deletedNotifications.push(notification);

      // Set up auto-permanent delete after 3 seconds
      const timer = setTimeout(() => {
        this.permanentlyDeleteNotification(notification.id);
      }, 3000);

      this.undoTimers.set(notification.id, timer);
    });

    this.saveDeletedNotifications();

    return {
      success: true,
      deletedCount: userNotifications.length,
      notifications: userNotifications
    };
  }

  undoClearAllNotifications(notifications: Notification[]): boolean {
    if (!notifications || notifications.length === 0) {
      return false;
    }

    // Clear all timers for these notifications
    notifications.forEach(notification => {
      const timer = this.undoTimers.get(notification.id);
      if (timer) {
        clearTimeout(timer);
        this.undoTimers.delete(notification.id);
      }
    });

    // Remove from deleted notifications
    notifications.forEach(notification => {
      const deletedIndex = this.deletedNotifications.findIndex(n => n.id === notification.id);
      if (deletedIndex !== -1) {
        this.deletedNotifications.splice(deletedIndex, 1);
      }
    });
    this.saveDeletedNotifications();

    // Add back to active notifications
    const activeNotifications = this.getAllNotifications();
    activeNotifications.push(...notifications);
    this.saveNotifications(activeNotifications);

    return true;
  }

  // Specific notification methods for cash management
  notifyNewRequest(request: CashRequest): void {
    const issuers = this.userService.getIssuers();
    const managers = this.userService.getManagers();
    const recipients = [...issuers, ...managers];

    recipients.forEach(recipient => {
      this.createNotification({
        type: NotificationType.NEW_REQUEST,
        title: 'New Cash Request',
        message: `${request.requesterName} has submitted a new cash request for ${this.formatAmount(request)}`,
        recipientId: recipient.id,
        requestId: request.id
      });
    });
  }

  notifyRequestApproved(request: CashRequest): void {
    this.createNotification({
      type: NotificationType.REQUEST_APPROVED,
      title: 'Request Approved',
      message: `Your cash request has been approved by ${request.issuedBy}. Please collect your cash from the Lab.`,
      recipientId: request.requesterId,
      requestId: request.id
    });
  }

  notifyCashIssued(request: CashRequest): void {
    const returnDeadline = request.expectedReturnDate
      ? this.timeUtilityService.formatReturnDeadline(request.expectedReturnDate)
      : 'Not specified';

    this.createNotification({
      type: NotificationType.CASH_ISSUED,
      title: 'Cash Issued',
      message: `Cash has been issued for your request. Must be returned by: ${returnDeadline}`,
      recipientId: request.requesterId,
      requestId: request.id
    });
  }

  scheduleReturnReminder(request: CashRequest): void {
    if (!request.expectedReturnDate) return;

    // Ensure the return date is set to 3PM
    const returnDeadline = this.timeUtilityService.setTimeTo3PM(request.expectedReturnDate);

    // Schedule reminder 30 minutes before 3PM deadline (2:30 PM)
    const reminderTime = new Date(returnDeadline.getTime() - (30 * 60 * 1000));

    // Only schedule if reminder time is in the future
    if (reminderTime > new Date()) {
      const deadlineMessage = this.timeUtilityService.formatReturnDeadline(returnDeadline);

      // Notify requester
      this.createNotification({
        type: NotificationType.RETURN_REMINDER,
        title: 'Cash Return Reminder',
        message: `Reminder: Your cash must be returned by ${deadlineMessage}`,
        recipientId: request.requesterId,
        requestId: request.id,
        scheduledFor: reminderTime
      });

      // Notify issuer
      if (request.issuedBy) {
        const issuer = this.userService.getIssuers().find(i => i.fullName === request.issuedBy);
        if (issuer) {
          this.createNotification({
            type: NotificationType.RETURN_REMINDER,
            title: 'Cash Return Reminder',
            message: `Reminder: Cash issued to ${request.requesterName} must be returned by ${deadlineMessage}`,
            recipientId: issuer.id,
            requestId: request.id,
            scheduledFor: reminderTime
          });
        }
      }
    }
  }

  notifyRequestCompleted(request: CashRequest): void {
    // Notify requester
    this.createNotification({
      type: NotificationType.REQUEST_COMPLETED,
      title: 'Request Completed',
      message: 'Your cash request has been completed successfully.',
      recipientId: request.requesterId,
      requestId: request.id
    });

    // Notify issuer and managers
    if (request.issuedBy) {
      const issuers = this.userService.getIssuers();
      const managers = this.userService.getManagers();
      const recipients = [...issuers, ...managers];

      const issuer = recipients.find(r => r.fullName === request.issuedBy);
      if (issuer) {
        this.createNotification({
          type: NotificationType.REQUEST_COMPLETED,
          title: 'Request Completed',
          message: `Cash request from ${request.requesterName} has been completed.`,
          recipientId: issuer.id,
          requestId: request.id
        });
      }

      // Notify all managers about completion
      managers.forEach(manager => {
        if (manager.fullName !== request.issuedBy) {
          this.createNotification({
            type: NotificationType.REQUEST_COMPLETED,
            title: 'Request Completed',
            message: `Cash request from ${request.requesterName} has been completed by ${request.issuedBy}.`,
            recipientId: manager.id,
            requestId: request.id
          });
        }
      });
    }
  }

  notifyRequestRejected(request: CashRequest, rejectionResult: RejectionResult): void {
    const totalAmount = this.formatAmount(request);

    // Create detailed rejection message for requester
    let requesterMessage = `Your cash request for ${totalAmount} has been rejected.`;

    if (request.isAutoRejected) {
      requesterMessage += ` Reason: ${rejectionResult.reason}`;

      if (rejectionResult.suggestedAlternatives && rejectionResult.suggestedAlternatives.length > 0) {
        requesterMessage += `\n\nSuggested alternatives:\n${rejectionResult.suggestedAlternatives.map(alt => `• ${alt}`).join('\n')}`;
      }

      if (rejectionResult.insufficientDenominations.length > 0) {
        requesterMessage += `\n\nInventory shortages:\n${rejectionResult.insufficientDenominations.map(d =>
          `• R${d.denomination}: Requested ${d.requested}, Available ${d.available} (Short by ${d.shortage})`
        ).join('\n')}`;
      }
    } else {
      requesterMessage += ` Reason: ${request.rejectionReason || 'No reason provided'}`;
      requesterMessage += `\n\nRejected by: ${request.rejectedBy}`;
    }

    // Notify requester
    this.createNotification({
      type: NotificationType.REQUEST_REJECTED,
      title: request.isAutoRejected ? 'Request Auto-Rejected' : 'Request Rejected',
      message: requesterMessage,
      recipientId: request.requesterId,
      requestId: request.id
    });

    // Create message for issuers and managers
    let staffMessage = `Cash request by ${request.requesterName} for ${totalAmount} has been ${request.isAutoRejected ? 'automatically ' : ''}rejected.`;

    if (request.isAutoRejected) {
      staffMessage += ` Reason: Insufficient inventory.`;

      if (rejectionResult.insufficientDenominations.length > 0) {
        staffMessage += `\n\nInventory shortages:\n${rejectionResult.insufficientDenominations.map(d =>
          `• R${d.denomination}: Requested ${d.requested}, Available ${d.available}`
        ).join('\n')}`;
      }
    } else {
      staffMessage += ` Reason: ${request.rejectionReason || 'No reason provided'}`;
      staffMessage += `\nRejected by: ${request.rejectedBy}`;
    }

    // Notify all issuers and managers
    const issuers = this.userService.getIssuers();
    const managers = this.userService.getManagers();
    const recipients = [...issuers, ...managers];

    recipients.forEach(recipient => {
      this.createNotification({
        type: NotificationType.REQUEST_REJECTED,
        title: request.isAutoRejected ? 'Request Auto-Rejected' : 'Request Rejected',
        message: staffMessage,
        recipientId: recipient.id,
        requestId: request.id
      });
    });
  }

  notifyOverdueReturn(request: CashRequest): void {
    if (!request.expectedReturnDate) return;

    const timeInfo = this.timeUtilityService.getTimeUntilDeadline(request.expectedReturnDate);

    if (timeInfo.isOverdue) {
      // Notify requester
      this.createNotification({
        type: NotificationType.RETURN_REMINDER,
        title: 'OVERDUE: Cash Return Required!',
        message: `Your cash return is ${timeInfo.message}. Please return immediately!`,
        recipientId: request.requesterId,
        requestId: request.id
      });

      // Notify issuer and managers
      if (request.issuedBy) {
        const issuers = this.userService.getIssuers();
        const managers = this.userService.getManagers();
        const recipients = [...issuers, ...managers];

        recipients.forEach(recipient => {
          this.createNotification({
            type: NotificationType.RETURN_REMINDER,
            title: 'OVERDUE: Cash Return Required!',
            message: `Cash issued to ${request.requesterName} is ${timeInfo.message}. Follow up required!`,
            recipientId: recipient.id,
            requestId: request.id
          });
        });
      }
    }
  }

  notifyUpcomingOverdue(request: CashRequest, minutesUntilOverdue: number): void {
    if (!request.expectedReturnDate) return;

    const deadlineMessage = this.timeUtilityService.formatReturnDeadline(request.expectedReturnDate);
    const urgencyLevel = minutesUntilOverdue <= 5 ? 'URGENT' : 'WARNING';

    // Notify requester
    this.createNotification({
      type: NotificationType.RETURN_REMINDER,
      title: `${urgencyLevel}: Cash Return Due in ${minutesUntilOverdue} minutes!`,
      message: `Your cash must be returned by ${deadlineMessage}. Only ${minutesUntilOverdue} minutes remaining!`,
      recipientId: request.requesterId,
      requestId: request.id
    });

    // Notify issuer and managers
    const issuers = this.userService.getIssuers();
    const managers = this.userService.getManagers();
    const recipients = [...issuers, ...managers];

    recipients.forEach(recipient => {
      this.createNotification({
        type: NotificationType.RETURN_REMINDER,
        title: `${urgencyLevel}: Cash Return Due in ${minutesUntilOverdue} minutes!`,
        message: `Cash issued to ${request.requesterName} must be returned by ${deadlineMessage}. Only ${minutesUntilOverdue} minutes remaining!`,
        recipientId: recipient.id,
        requestId: request.id
      });
    });
  }

  notifyAutoCancellation(request: CashRequest, cancellationInfo: any): void {
    const totalAmount = request.bankNotes.reduce((sum, note) => sum + (note.denomination * note.quantity), 0);
    const approvalTime = new Date(request.dateApproved || '').toLocaleTimeString('en-US', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: true
    });

    // Notify requester
    this.createNotification({
      type: NotificationType.REQUEST_CANCELLED,
      title: 'Cash Request Auto-Cancelled',
      message: `Your cash request (R${totalAmount.toLocaleString()}) approved at ${approvalTime} was automatically cancelled as it was not collected by the 3:00 PM deadline. Please submit a new request if you still need the cash.`,
      recipientId: request.requesterId,
      requestId: request.id
    });

    // Notify issuer and managers
    const issuers = this.userService.getIssuers();
    const managers = this.userService.getManagers();
    const recipients = [...issuers, ...managers];

    recipients.forEach(recipient => {
      this.createNotification({
        type: NotificationType.REQUEST_CANCELLED,
        title: 'Cash Request Auto-Cancelled - Uncollected',
        message: `Cash request by ${request.requesterName} (${request.department}) for R${totalAmount.toLocaleString()} was auto-cancelled. Approved at ${approvalTime} but not collected by 3:00 PM deadline. Reserved inventory has been returned.`,
        recipientId: recipient.id,
        requestId: request.id
      });
    });
  }

  private checkScheduledNotifications(): void {
    // Check for scheduled notifications every minute
    setInterval(() => {
      const now = new Date();
      const notifications = this.getAllNotifications();

      notifications.forEach(notification => {
        if (notification.scheduledFor &&
            notification.scheduledFor <= now &&
            !notification.isRead) {
          // This notification should be "delivered" now
          // In a real app, this would trigger an actual notification
          console.log('Scheduled notification delivered:', notification);
        }
      });
    }, 60000); // Check every minute
  }

  private formatAmount(request: CashRequest): string {
    const total = request.bankNotes.reduce((sum, note) => sum + (note.denomination * note.quantity), 0);
    return `R${total.toLocaleString()}`;
  }

  private formatDate(date: Date | undefined): string {
    if (!date) return 'Not specified';
    return date.toLocaleString();
  }

  /**
   * Gets dynamic notification content based on current time
   * This updates the notification message to show accurate time remaining
   */
  getDynamicNotificationContent(notification: Notification): { title: string; message: string } {
    // Only update return reminder notifications
    if (notification.type !== NotificationType.RETURN_REMINDER || !notification.requestId) {
      return { title: notification.title, message: notification.message };
    }

    // Get the associated cash request to calculate current time remaining
    if (!this.cashRequestService) {
      // Fallback to original content if service not available
      return { title: notification.title, message: notification.message };
    }

    try {
      const request = this.cashRequestService.getRequestById(notification.requestId);
      if (!request || !request.expectedReturnDate) {
        return { title: notification.title, message: notification.message };
      }

      // Calculate current time until deadline
      const timeInfo = this.timeUtilityService.getTimeUntilDeadline(request.expectedReturnDate);
      const deadlineMessage = this.timeUtilityService.formatReturnDeadline(request.expectedReturnDate);

      if (timeInfo.isOverdue) {
        return {
          title: 'OVERDUE: Cash Return Required!',
          message: `Your cash return is ${timeInfo.message}. Please return immediately! Due: ${deadlineMessage}`
        };
      } else {
        // Show accurate time remaining
        return {
          title: `Cash Return Reminder - ${timeInfo.message}`,
          message: `Reminder: Your cash must be returned by ${deadlineMessage}`
        };
      }
    } catch (error) {
      // Fallback to original content if there's an error
      console.warn('Error getting dynamic notification content:', error);
      return { title: notification.title, message: notification.message };
    }
  }

  private saveNotifications(notifications: Notification[]): void {
    this.localStorageService.setItem(this.NOTIFICATIONS_KEY, notifications);
    this.notificationsSubject.next(notifications);
  }
}
