export interface Notification {
  id: string;
  type: NotificationType;
  title: string;
  message: string;
  recipientId: string;
  requestId?: string;
  isRead: boolean;
  createdAt: Date;
  scheduledFor?: Date;
}

export enum NotificationType {
  NEW_REQUEST = 'new_request',
  REQUEST_APPROVED = 'request_approved',
  CASH_ISSUED = 'cash_issued',
  RETURN_REMINDER = 'return_reminder',
  CASH_RETURNED = 'cash_returned',
  REQUEST_COMPLETED = 'request_completed',
  REQUEST_REJECTED = 'request_rejected',
  REQUEST_CANCELLED = 'request_cancelled'
}

export interface NotificationSettings {
  emailNotifications: boolean;
  reminderMinutes: number; // Minutes before return deadline
}
