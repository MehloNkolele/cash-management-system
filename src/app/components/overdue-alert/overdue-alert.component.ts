import { Component, OnInit, OnDestroy, Input } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatBadgeModule } from '@angular/material/badge';
import { MatTooltipModule } from '@angular/material/tooltip';
import { MatExpansionModule } from '@angular/material/expansion';
import { MatChipsModule } from '@angular/material/chips';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';
import { OverdueMonitoringService, OverdueAlert } from '../../services/overdue-monitoring.service';
import { Router } from '@angular/router';

@Component({
  selector: 'app-overdue-alert',
  standalone: true,
  imports: [
    CommonModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatBadgeModule,
    MatTooltipModule,
    MatExpansionModule,
    MatChipsModule
  ],
  template: `
    <div class="overdue-alerts-container" *ngIf="overdueAlerts.length > 0">
      <!-- Critical Alert Banner -->
      <mat-card class="alert-banner" [ngClass]="getBannerClass()">
        <mat-card-content>
          <div class="alert-header">
            <div class="alert-icon-section">
              <mat-icon class="alert-icon" [ngClass]="getIconClass()">
                {{ getCriticalAlerts().length > 0 ? 'error' : 'warning' }}
              </mat-icon>
              <div class="alert-text">
                <h3 class="alert-title">{{ getAlertTitle() }}</h3>
                <p class="alert-subtitle">{{ getAlertSubtitle() }}</p>
              </div>
            </div>
            <div class="alert-actions">
              <button mat-raised-button 
                      [color]="getCriticalAlerts().length > 0 ? 'warn' : 'accent'"
                      (click)="toggleExpanded()">
                <mat-icon>{{ isExpanded ? 'expand_less' : 'expand_more' }}</mat-icon>
                {{ isExpanded ? 'Hide Details' : 'View Details' }}
              </button>
              <button mat-icon-button 
                      [matTooltip]="allMuted ? 'Unmute All Alerts' : 'Mute All Alerts'"
                      (click)="toggleMuteAll()">
                <mat-icon>{{ allMuted ? 'volume_off' : 'volume_up' }}</mat-icon>
              </button>
            </div>
          </div>

          <!-- Expanded Details -->
          <div class="alert-details" *ngIf="isExpanded">
            <div class="alerts-list">
              <div class="alert-item" 
                   *ngFor="let alert of overdueAlerts" 
                   [ngClass]="'alert-' + alert.severity">
                <div class="alert-item-header">
                  <div class="alert-item-info">
                    <span class="request-id">{{ alert.requestId }}</span>
                    <span class="requester-name">{{ alert.requesterName }}</span>
                    <span class="department">{{ alert.department }}</span>
                  </div>
                  <div class="alert-item-status">
                    <mat-chip [ngClass]="'chip-' + alert.severity">
                      {{ alert.severity.toUpperCase() }}
                    </mat-chip>
                    <span class="overdue-time">
                      {{ alert.hoursOverdue }}h {{ alert.minutesOverdue }}m overdue
                    </span>
                  </div>
                </div>
                <div class="alert-item-details">
                  <span class="amount">Amount: R{{ alert.totalAmount.toLocaleString() }}</span>
                  <span class="last-alert">Last alert: {{ formatTime(alert.lastAlertTime) }}</span>
                </div>
                <div class="alert-item-actions">
                  <button mat-stroked-button 
                          color="primary"
                          (click)="viewRequest(alert.requestId)">
                    <mat-icon>visibility</mat-icon>
                    View Request
                  </button>
                  <button mat-icon-button 
                          [matTooltip]="alert.isBeeping ? 'Mute Alert' : 'Unmute Alert'"
                          (click)="toggleMute(alert)">
                    <mat-icon>{{ alert.isBeeping ? 'volume_off' : 'volume_up' }}</mat-icon>
                  </button>
                </div>
              </div>
            </div>
          </div>
        </mat-card-content>
      </mat-card>

      <!-- Floating Alert Indicator (when collapsed) -->
      <div class="floating-indicator" 
           *ngIf="!isExpanded && showFloatingIndicator"
           [ngClass]="getFloatingIndicatorClass()"
           (click)="toggleExpanded()">
        <mat-icon class="floating-icon">{{ getCriticalAlerts().length > 0 ? 'error' : 'warning' }}</mat-icon>
        <span class="floating-count" [matBadge]="overdueAlerts.length" matBadgeColor="warn">
          {{ getCriticalAlerts().length > 0 ? 'CRITICAL' : 'OVERDUE' }}
        </span>
      </div>
    </div>
  `,
  styles: [`
    .overdue-alerts-container {
      position: relative;
      z-index: 1000;
    }

    .alert-banner {
      margin-bottom: 16px;
      border-left: 4px solid;
      animation: pulse 2s infinite;
    }

    .alert-banner.critical {
      border-left-color: #f44336;
      background-color: #ffebee;
    }

    .alert-banner.warning {
      border-left-color: #ff9800;
      background-color: #fff3e0;
    }

    .alert-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
    }

    .alert-icon-section {
      display: flex;
      align-items: center;
      gap: 16px;
    }

    .alert-icon {
      font-size: 32px;
      width: 32px;
      height: 32px;
    }

    .alert-icon.critical {
      color: #f44336;
    }

    .alert-icon.warning {
      color: #ff9800;
    }

    .alert-text h3 {
      margin: 0;
      font-size: 18px;
      font-weight: 600;
    }

    .alert-text p {
      margin: 4px 0 0 0;
      color: #666;
      font-size: 14px;
    }

    .alert-actions {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .alert-details {
      margin-top: 16px;
      padding-top: 16px;
      border-top: 1px solid #e0e0e0;
    }

    .alerts-list {
      display: flex;
      flex-direction: column;
      gap: 12px;
    }

    .alert-item {
      padding: 12px;
      border-radius: 8px;
      border: 1px solid;
    }

    .alert-item.alert-critical {
      border-color: #f44336;
      background-color: #ffebee;
    }

    .alert-item.alert-warning {
      border-color: #ff9800;
      background-color: #fff3e0;
    }

    .alert-item-header {
      display: flex;
      justify-content: space-between;
      align-items: center;
      margin-bottom: 8px;
    }

    .alert-item-info {
      display: flex;
      gap: 12px;
      align-items: center;
    }

    .request-id {
      font-weight: 600;
      color: #1976d2;
    }

    .requester-name {
      font-weight: 500;
    }

    .department {
      color: #666;
      font-size: 14px;
    }

    .alert-item-status {
      display: flex;
      gap: 8px;
      align-items: center;
    }

    .chip-critical {
      background-color: #f44336 !important;
      color: white !important;
    }

    .chip-warning {
      background-color: #ff9800 !important;
      color: white !important;
    }

    .overdue-time {
      font-weight: 600;
      color: #d32f2f;
    }

    .alert-item-details {
      display: flex;
      gap: 16px;
      margin-bottom: 8px;
      font-size: 14px;
      color: #666;
    }

    .alert-item-actions {
      display: flex;
      gap: 8px;
      justify-content: flex-end;
    }

    .floating-indicator {
      position: fixed;
      top: 20px;
      right: 20px;
      padding: 12px 16px;
      border-radius: 24px;
      cursor: pointer;
      display: flex;
      align-items: center;
      gap: 8px;
      box-shadow: 0 4px 12px rgba(0,0,0,0.3);
      animation: bounce 1s infinite;
      z-index: 1001;
    }

    .floating-indicator.critical {
      background-color: #f44336;
      color: white;
    }

    .floating-indicator.warning {
      background-color: #ff9800;
      color: white;
    }

    .floating-icon {
      font-size: 20px;
      width: 20px;
      height: 20px;
    }

    .floating-count {
      font-weight: 600;
      font-size: 12px;
    }

    @keyframes pulse {
      0% { opacity: 1; }
      50% { opacity: 0.8; }
      100% { opacity: 1; }
    }

    @keyframes bounce {
      0%, 20%, 50%, 80%, 100% { transform: translateY(0); }
      40% { transform: translateY(-5px); }
      60% { transform: translateY(-3px); }
    }

    @media (max-width: 768px) {
      .alert-header {
        flex-direction: column;
        gap: 12px;
        align-items: flex-start;
      }

      .alert-item-header {
        flex-direction: column;
        align-items: flex-start;
        gap: 8px;
      }

      .floating-indicator {
        top: 10px;
        right: 10px;
        padding: 8px 12px;
      }
    }
  `]
})
export class OverdueAlertComponent implements OnInit, OnDestroy {
  @Input() showFloatingIndicator = true;
  @Input() autoExpand = false;

  private destroy$ = new Subject<void>();

  overdueAlerts: OverdueAlert[] = [];
  isExpanded = false;
  allMuted = false;

  constructor(
    private overdueMonitoringService: OverdueMonitoringService,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.overdueMonitoringService.overdueAlerts$
      .pipe(takeUntil(this.destroy$))
      .subscribe(alerts => {
        this.overdueAlerts = alerts;
        this.updateMuteStatus();
        
        if (this.autoExpand && alerts.length > 0) {
          this.isExpanded = true;
        }
      });
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  getCriticalAlerts(): OverdueAlert[] {
    return this.overdueAlerts.filter(alert => alert.severity === 'critical');
  }

  getWarningAlerts(): OverdueAlert[] {
    return this.overdueAlerts.filter(alert => alert.severity === 'warning');
  }

  getBannerClass(): string {
    return this.getCriticalAlerts().length > 0 ? 'critical' : 'warning';
  }

  getIconClass(): string {
    return this.getCriticalAlerts().length > 0 ? 'critical' : 'warning';
  }

  getFloatingIndicatorClass(): string {
    return this.getCriticalAlerts().length > 0 ? 'critical' : 'warning';
  }

  getAlertTitle(): string {
    const criticalCount = this.getCriticalAlerts().length;
    const warningCount = this.getWarningAlerts().length;

    if (criticalCount > 0) {
      return `${criticalCount} Critical Overdue Alert${criticalCount > 1 ? 's' : ''}`;
    }
    return `${warningCount} Overdue Alert${warningCount > 1 ? 's' : ''}`;
  }

  getAlertSubtitle(): string {
    const criticalCount = this.getCriticalAlerts().length;
    const warningCount = this.getWarningAlerts().length;

    if (criticalCount > 0 && warningCount > 0) {
      return `${criticalCount} critical, ${warningCount} warning - Immediate action required`;
    } else if (criticalCount > 0) {
      return 'Cash overdue for more than 24 hours - Immediate action required';
    }
    return 'Cash return deadline has passed - Action required';
  }

  toggleExpanded(): void {
    this.isExpanded = !this.isExpanded;
  }

  toggleMute(alert: OverdueAlert): void {
    if (alert.isBeeping) {
      this.overdueMonitoringService.muteAlert(alert.id);
    } else {
      this.overdueMonitoringService.unmuteAlert(alert.id);
    }
    this.updateMuteStatus();
  }

  toggleMuteAll(): void {
    if (this.allMuted) {
      this.overdueMonitoringService.unmuteAllAlerts();
    } else {
      this.overdueMonitoringService.muteAllAlerts();
    }
    this.updateMuteStatus();
  }

  private updateMuteStatus(): void {
    this.allMuted = this.overdueAlerts.length > 0 && 
                    this.overdueAlerts.every(alert => !alert.isBeeping);
  }

  viewRequest(requestId: string): void {
    this.router.navigate(['/request-details', requestId]);
  }

  formatTime(date: Date): string {
    return date.toLocaleTimeString('en-US', { 
      hour: '2-digit', 
      minute: '2-digit',
      hour12: true 
    });
  }
}
