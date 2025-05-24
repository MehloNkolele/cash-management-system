import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import { Notification, NotificationType } from '../models/notification.model';
import { CashRequest } from '../models/cash-request.model';
import { LocalStorageService } from './local-storage.service';
import { UserService } from './user.service';

@Injectable({
  providedIn: 'root'
})
export class NotificationService {
  private readonly NOTIFICATIONS_KEY = 'cash_mgmt_notifications';
  
  private notificationsSubject = new BehaviorSubject<Notification[]>([]);
  public notifications$ = this.notificationsSubject.asObservable();

  constructor(
    private localStorageService: LocalStorageService,
    private userService: UserService
  ) {
    this.loadNotifications();
    this.checkScheduledNotifications();
  }

  private loadNotifications(): void {
    const notifications = this.getAllNotifications();
    this.notificationsSubject.next(notifications);
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

    return newNotification;
  }

  markAsRead(notificationId: string): void {
    const notifications = this.getAllNotifications();
    const notification = notifications.find(n => n.id === notificationId);
    
    if (notification) {
      notification.isRead = true;
      this.saveNotifications(notifications);
    }
  }

  markAllAsReadForUser(userId: string): void {
    const notifications = this.getAllNotifications();
    const userNotifications = notifications.filter(n => n.recipientId === userId);
    
    userNotifications.forEach(notification => {
      notification.isRead = true;
    });
    
    this.saveNotifications(notifications);
  }

  // Specific notification methods for cash management
  notifyNewRequest(request: CashRequest): void {
    const issuers = this.userService.getIssuers();
    
    issuers.forEach(issuer => {
      this.createNotification({
        type: NotificationType.NEW_REQUEST,
        title: 'New Cash Request',
        message: `${request.requesterName} has submitted a new cash request for ${this.formatAmount(request)}`,
        recipientId: issuer.id,
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
    this.createNotification({
      type: NotificationType.CASH_ISSUED,
      title: 'Cash Issued',
      message: `Cash has been issued for your request. Expected return: ${this.formatDate(request.expectedReturnDate)}`,
      recipientId: request.requesterId,
      requestId: request.id
    });
  }

  scheduleReturnReminder(request: CashRequest): void {
    if (!request.expectedReturnDate) return;

    // Schedule reminder 30 minutes before return deadline
    const reminderTime = new Date(request.expectedReturnDate.getTime() - (30 * 60 * 1000));
    
    // Only schedule if reminder time is in the future
    if (reminderTime > new Date()) {
      // Notify requester
      this.createNotification({
        type: NotificationType.RETURN_REMINDER,
        title: 'Cash Return Reminder',
        message: `Reminder: Your cash is due to be returned in 30 minutes (${this.formatDate(request.expectedReturnDate)})`,
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
            message: `Reminder: Cash issued to ${request.requesterName} is due to be returned in 30 minutes`,
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

    // Notify issuer
    if (request.issuedBy) {
      const issuer = this.userService.getIssuers().find(i => i.fullName === request.issuedBy);
      if (issuer) {
        this.createNotification({
          type: NotificationType.REQUEST_COMPLETED,
          title: 'Request Completed',
          message: `Cash request from ${request.requesterName} has been completed.`,
          recipientId: issuer.id,
          requestId: request.id
        });
      }
    }
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

  private saveNotifications(notifications: Notification[]): void {
    this.localStorageService.setItem(this.NOTIFICATIONS_KEY, notifications);
    this.notificationsSubject.next(notifications);
  }
}
