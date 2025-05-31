import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable, interval, Subscription } from 'rxjs';
import { CashRequest, RequestStatus } from '../models/cash-request.model';
import { CashRequestService } from './cash-request.service';
import { NotificationService } from './notification.service';
import { SystemLogService } from './system-log.service';
import { TimeUtilityService } from './time-utility.service';
import { InventoryService } from './inventory.service';
import { UserService } from './user.service';

export interface OverdueAlert {
  id: string;
  requestId: string;
  requesterName: string;
  department: string;
  totalAmount: number;
  hoursOverdue: number;
  minutesOverdue: number;
  severity: 'warning' | 'critical';
  isBeeping: boolean;
  lastAlertTime: Date;
}

export interface WarningStage {
  minutesBefore: number;
  hasBeenTriggered: boolean;
  lastTriggered?: Date;
}

export interface AutoCancellationInfo {
  requestId: string;
  approvalDate: Date;
  cancellationDeadline: Date;
  hasBeenCancelled: boolean;
}

@Injectable({
  providedIn: 'root'
})
export class OverdueMonitoringService {
  private readonly CHECK_INTERVAL = 60000; // Check every minute
  private readonly BEEP_INTERVAL = 10000; // Beep every 10 seconds for overdue
  private readonly WARNING_STAGES = [30, 15, 5]; // Minutes before overdue

  private monitoringSubscription?: Subscription;
  private beepingSubscription?: Subscription;
  private userSubscription?: Subscription;
  private isMonitoring = false;

  private overdueAlertsSubject = new BehaviorSubject<OverdueAlert[]>([]);
  public overdueAlerts$ = this.overdueAlertsSubject.asObservable();

  private warningStagesMap = new Map<string, WarningStage[]>();
  private loggedOverdueRequests = new Set<string>();
  private autoCancellationMap = new Map<string, AutoCancellationInfo>();

  constructor(
    private cashRequestService: CashRequestService,
    private notificationService: NotificationService,
    private systemLogService: SystemLogService,
    private timeUtilityService: TimeUtilityService,
    private inventoryService: InventoryService,
    private userService: UserService
  ) {
    this.initializeUserSubscription();
    this.startMonitoring();
  }

  private initializeUserSubscription(): void {
    // Subscribe to user changes to stop monitoring when user logs out
    this.userSubscription = this.userService.currentUser$.subscribe(user => {
      if (!user) {
        // User logged out, stop monitoring
        this.stopMonitoring();
      } else if (!this.isMonitoring) {
        // User logged in, start monitoring
        this.startMonitoring();
      }
    });
  }

  startMonitoring(): void {
    if (this.isMonitoring) return;

    // Only start monitoring if there's a logged-in user
    const currentUser = this.userService.getCurrentUser();
    if (!currentUser) {
      return;
    }

    this.isMonitoring = true;
    console.log('Starting overdue monitoring service...');

    // Initial check
    this.checkForOverdueAndWarnings();

    // Set up periodic monitoring
    this.monitoringSubscription = interval(this.CHECK_INTERVAL).subscribe(() => {
      this.checkForOverdueAndWarnings();
    });

    // Set up beeping for overdue alerts
    this.beepingSubscription = interval(this.BEEP_INTERVAL).subscribe(() => {
      this.handleBeepingAlerts();
    });
  }

  stopMonitoring(): void {
    this.isMonitoring = false;

    if (this.monitoringSubscription) {
      this.monitoringSubscription.unsubscribe();
      this.monitoringSubscription = undefined;
    }

    if (this.beepingSubscription) {
      this.beepingSubscription.unsubscribe();
      this.beepingSubscription = undefined;
    }

    // Clear all alerts and stop beeping
    this.overdueAlertsSubject.next([]);

    // Clear tracking maps
    this.warningStagesMap.clear();
    this.loggedOverdueRequests.clear();
    this.autoCancellationMap.clear();

    console.log('Stopped overdue monitoring service');
  }

  private checkForOverdueAndWarnings(): void {
    // Only check if there's a logged-in user
    const currentUser = this.userService.getCurrentUser();
    if (!currentUser) {
      return;
    }

    // Only track ISSUED requests for overdue monitoring (cash has been physically given)
    const issuedRequests = this.cashRequestService.getActiveRequests()
      .filter(request => request.expectedReturnDate &&
        request.status === RequestStatus.ISSUED);

    // Check for approved requests that need auto-cancellation
    this.checkForAutoCancellation();

    const currentOverdueAlerts: OverdueAlert[] = [];
    const now = new Date();

    issuedRequests.forEach(request => {
      if (!request.expectedReturnDate) return;

      const timeInfo = this.timeUtilityService.getTimeUntilDeadline(request.expectedReturnDate);

      if (timeInfo.isOverdue) {
        // Handle overdue cash
        this.handleOverdueCash(request, timeInfo, currentOverdueAlerts);
      } else {
        // Handle warning stages
        this.handleWarningStages(request, timeInfo);
      }
    });

    // Update overdue alerts
    this.overdueAlertsSubject.next(currentOverdueAlerts);

    // Clean up warning stages for completed/returned requests
    this.cleanupWarningStages(issuedRequests);
  }

  private handleOverdueCash(request: CashRequest, timeInfo: any, currentOverdueAlerts: OverdueAlert[]): void {
    const totalAmount = request.bankNotes.reduce((sum, note) => sum + (note.denomination * note.quantity), 0);

    // Log overdue cash if not already logged
    if (!this.loggedOverdueRequests.has(request.id)) {
      this.systemLogService.logOverdueCash(request);
      this.loggedOverdueRequests.add(request.id);

      // Send overdue notifications
      this.notificationService.notifyOverdueReturn(request);
    }

    // Create overdue alert
    const hoursOverdue = Math.floor(Math.abs(timeInfo.hoursRemaining));
    const minutesOverdue = Math.floor(Math.abs(timeInfo.minutesRemaining));

    const overdueAlert: OverdueAlert = {
      id: `overdue_${request.id}`,
      requestId: request.id,
      requesterName: request.requesterName,
      department: request.department,
      totalAmount,
      hoursOverdue,
      minutesOverdue,
      severity: hoursOverdue > 24 ? 'critical' : 'warning',
      isBeeping: true,
      lastAlertTime: new Date()
    };

    currentOverdueAlerts.push(overdueAlert);
  }

  private handleWarningStages(request: CashRequest, timeInfo: any): void {
    if (!this.warningStagesMap.has(request.id)) {
      this.warningStagesMap.set(request.id, this.WARNING_STAGES.map(minutes => ({
        minutesBefore: minutes,
        hasBeenTriggered: false
      })));
    }

    const warningStages = this.warningStagesMap.get(request.id)!;
    const minutesRemaining = timeInfo.hoursRemaining * 60 + timeInfo.minutesRemaining;

    warningStages.forEach(stage => {
      if (!stage.hasBeenTriggered && minutesRemaining <= stage.minutesBefore) {
        // Trigger warning
        this.triggerWarning(request, stage.minutesBefore);
        stage.hasBeenTriggered = true;
        stage.lastTriggered = new Date();
      }
    });
  }

  private triggerWarning(request: CashRequest, minutesUntilOverdue: number): void {
    // Log the warning
    this.systemLogService.logOverdueWarning(request, minutesUntilOverdue);

    // Send warning notifications
    this.notificationService.notifyUpcomingOverdue(request, minutesUntilOverdue);
  }

  private checkForAutoCancellation(): void {
    const approvedRequests = this.cashRequestService.getActiveRequests()
      .filter(request => request.status === RequestStatus.APPROVED);

    const now = new Date();

    approvedRequests.forEach(request => {
      if (!request.dateApproved) return;

      // Track approved requests for auto-cancellation
      if (!this.autoCancellationMap.has(request.id)) {
        const approvalDate = new Date(request.dateApproved);
        const cancellationDeadline = new Date(approvalDate);
        cancellationDeadline.setHours(15, 0, 0, 0); // 3:00 PM on the same day

        // If approved after 2:30 PM, give 30-minute grace period
        if (approvalDate.getHours() >= 14 && approvalDate.getMinutes() >= 30) {
          cancellationDeadline.setMinutes(cancellationDeadline.getMinutes() + 30);
        }

        this.autoCancellationMap.set(request.id, {
          requestId: request.id,
          approvalDate,
          cancellationDeadline,
          hasBeenCancelled: false
        });
      }

      const cancellationInfo = this.autoCancellationMap.get(request.id)!;

      // Check if cancellation deadline has passed
      if (now >= cancellationInfo.cancellationDeadline && !cancellationInfo.hasBeenCancelled) {
        this.performAutoCancellation(request, cancellationInfo);
      }
    });

    // Clean up auto-cancellation tracking for requests that are no longer approved
    const approvedRequestIds = new Set(approvedRequests.map(r => r.id));
    for (const requestId of this.autoCancellationMap.keys()) {
      if (!approvedRequestIds.has(requestId)) {
        this.autoCancellationMap.delete(requestId);
      }
    }
  }

  private performAutoCancellation(request: CashRequest, cancellationInfo: AutoCancellationInfo): void {
    try {
      // Prepare the updates for the request
      const updates: Partial<CashRequest> = {
        status: RequestStatus.CANCELLED,
        dateCancelled: new Date(),
        cancellationReason: 'Auto-cancelled: Cash not collected by 3:00 PM deadline',
        cancelledBy: 'SYSTEM',
        isAutoCancelled: true
      };

      // Update the request in the service
      const updatedRequest = this.cashRequestService.updateRequest(request.id, updates);

      if (!updatedRequest) {
        console.error(`Failed to update request ${request.id} for auto-cancellation`);
        return;
      }

      // Return reserved inventory back to available inventory
      this.returnReservedInventory(updatedRequest);

      // Log the auto-cancellation
      this.systemLogService.logAutoCancellation(updatedRequest, cancellationInfo);

      // Send notifications
      this.notificationService.notifyAutoCancellation(updatedRequest, cancellationInfo);

      // Mark as cancelled in tracking
      cancellationInfo.hasBeenCancelled = true;

      console.log(`Auto-cancelled request ${request.id} - not collected by deadline`);
    } catch (error) {
      console.error('Error performing auto-cancellation:', error);
    }
  }

  private returnReservedInventory(request: CashRequest): void {
    try {
      // Return reserved cash back to inventory using the inventory service
      const success = this.inventoryService.returnReservedCash(
        request.bankNotes,
        request.id,
        'SYSTEM'
      );

      if (success) {
        console.log(`Successfully returned reserved cash for request ${request.id} to inventory`);
      } else {
        console.error(`Failed to return reserved cash for request ${request.id} to inventory`);
      }
    } catch (error) {
      console.error('Error returning reserved inventory:', error);
    }
  }

  private cleanupWarningStages(activeRequests: CashRequest[]): void {
    const activeRequestIds = new Set(activeRequests.map(r => r.id));

    // Remove warning stages for requests that are no longer active
    for (const requestId of this.warningStagesMap.keys()) {
      if (!activeRequestIds.has(requestId)) {
        this.warningStagesMap.delete(requestId);
        this.loggedOverdueRequests.delete(requestId);
      }
    }
  }

  private handleBeepingAlerts(): void {
    // Only beep if there's a logged-in user
    const currentUser = this.userService.getCurrentUser();
    if (!currentUser) {
      return;
    }

    const currentAlerts = this.overdueAlertsSubject.value;
    const beepingAlerts = currentAlerts.filter(alert => alert.isBeeping);

    if (beepingAlerts.length > 0) {
      // Trigger audio alert
      this.playBeepSound();

      // Update last alert time
      beepingAlerts.forEach(alert => {
        alert.lastAlertTime = new Date();
      });
    }
  }

  private playBeepSound(): void {
    try {
      // Create audio context for beep sound
      const audioContext = new (window.AudioContext || (window as any).webkitAudioContext)();
      const oscillator = audioContext.createOscillator();
      const gainNode = audioContext.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(audioContext.destination);

      oscillator.frequency.value = 800; // 800 Hz beep
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, audioContext.currentTime);
      gainNode.gain.exponentialRampToValueAtTime(0.01, audioContext.currentTime + 0.5);

      oscillator.start(audioContext.currentTime);
      oscillator.stop(audioContext.currentTime + 0.5);
    } catch (error) {
      console.warn('Could not play beep sound:', error);
    }
  }

  // Public methods for components
  getOverdueAlerts(): OverdueAlert[] {
    return this.overdueAlertsSubject.value;
  }

  muteAlert(alertId: string): void {
    const alerts = this.overdueAlertsSubject.value;
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.isBeeping = false;
    }
  }

  unmuteAlert(alertId: string): void {
    const alerts = this.overdueAlertsSubject.value;
    const alert = alerts.find(a => a.id === alertId);
    if (alert) {
      alert.isBeeping = true;
    }
  }

  muteAllAlerts(): void {
    const alerts = this.overdueAlertsSubject.value;
    alerts.forEach(alert => alert.isBeeping = false);
  }

  unmuteAllAlerts(): void {
    const alerts = this.overdueAlertsSubject.value;
    alerts.forEach(alert => alert.isBeeping = true);
  }

  // Force a manual check (useful for testing)
  forceCheck(): void {
    this.checkForOverdueAndWarnings();
  }

  // Get auto-cancellation info for testing/debugging
  getAutoCancellationInfo(): Map<string, AutoCancellationInfo> {
    return new Map(this.autoCancellationMap);
  }

  // Force auto-cancellation check (useful for testing)
  forceAutoCancellationCheck(): void {
    this.checkForAutoCancellation();
  }

  // Get current monitoring status
  getMonitoringStatus(): {
    isMonitoring: boolean;
    overdueAlertsCount: number;
    trackedWarningStages: number;
    trackedAutoCancellations: number;
  } {
    return {
      isMonitoring: this.isMonitoring,
      overdueAlertsCount: this.overdueAlertsSubject.value.length,
      trackedWarningStages: this.warningStagesMap.size,
      trackedAutoCancellations: this.autoCancellationMap.size
    };
  }

  ngOnDestroy(): void {
    this.stopMonitoring();

    if (this.userSubscription) {
      this.userSubscription.unsubscribe();
      this.userSubscription = undefined;
    }
  }
}
