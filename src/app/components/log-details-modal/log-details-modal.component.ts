import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

import { SystemLog, LogSeverity, LOG_TYPE_LABELS, LOG_CATEGORY_LABELS, LOG_SEVERITY_LABELS } from '../../models/system-log.model';

@Component({
  selector: 'app-log-details-modal',
  standalone: true,
  imports: [
    CommonModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule
  ],
  template: `
    <div class="log-details-modal">
      <h2 mat-dialog-title>
        <mat-icon>{{ getSeverityIcon(log.severity) }}</mat-icon>
        Log Details
        <mat-chip [class]="getSeverityClass(log.severity)" class="severity-chip">
          {{ LOG_SEVERITY_LABELS[log.severity] }}
        </mat-chip>
      </h2>

      <mat-dialog-content>
        <div class="log-details-content">
          <!-- Basic Information -->
          <mat-card class="info-card">
            <mat-card-header>
              <mat-card-title>Basic Information</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="info-grid">
                <div class="info-item">
                  <span class="label">Log ID:</span>
                  <span class="value">{{ log.id }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Timestamp:</span>
                  <span class="value">{{ formatDateTime(log.timestamp) }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Type:</span>
                  <span class="value">{{ LOG_TYPE_LABELS[log.type] }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Category:</span>
                  <span class="value">{{ LOG_CATEGORY_LABELS[log.category] }}</span>
                </div>
                <div class="info-item">
                  <span class="label">Severity:</span>
                  <mat-chip [class]="getSeverityClass(log.severity)">
                    <mat-icon>{{ getSeverityIcon(log.severity) }}</mat-icon>
                    {{ LOG_SEVERITY_LABELS[log.severity] }}
                  </mat-chip>
                </div>
                <div class="info-item" *ngIf="log.userName">
                  <span class="label">User:</span>
                  <span class="value">{{ log.userName }}</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Message Details -->
          <mat-card class="message-card">
            <mat-card-header>
              <mat-card-title>{{ log.title }}</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <p class="message-text">{{ log.message }}</p>
            </mat-card-content>
          </mat-card>

          <!-- Related Information -->
          <mat-card class="related-card" *ngIf="hasRelatedInfo()">
            <mat-card-header>
              <mat-card-title>Related Information</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="related-grid">
                <div class="related-item" *ngIf="log.requestId">
                  <span class="label">Request ID:</span>
                  <span class="value">{{ log.requestId }}</span>
                </div>
                <div class="related-item" *ngIf="log.inventoryId">
                  <span class="label">Inventory ID:</span>
                  <span class="value">{{ log.inventoryId }}</span>
                </div>
                <div class="related-item" *ngIf="log.ipAddress">
                  <span class="label">IP Address:</span>
                  <span class="value">{{ log.ipAddress }}</span>
                </div>
                <div class="related-item" *ngIf="log.userAgent">
                  <span class="label">User Agent:</span>
                  <span class="value user-agent">{{ log.userAgent }}</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>

          <!-- Metadata -->
          <mat-card class="metadata-card" *ngIf="log.metadata && hasMetadata()">
            <mat-card-header>
              <mat-card-title>Additional Metadata</mat-card-title>
            </mat-card-header>
            <mat-card-content>
              <div class="metadata-grid">
                <div class="metadata-item" *ngFor="let item of getMetadataEntries()">
                  <span class="label">{{ formatMetadataKey(item.key) }}:</span>
                  <span class="value">{{ formatMetadataValue(item.value) }}</span>
                </div>
              </div>
            </mat-card-content>
          </mat-card>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onClose()">Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .log-details-modal {
      width: 90vw;
      max-width: 800px;
      max-height: 90vh;
    }

    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--absa-dark-blue);
      margin-bottom: 1rem;

      .severity-chip {
        margin-left: auto;
        font-size: 0.8rem;
      }
    }

    .log-details-content {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      max-height: 70vh;
      overflow-y: auto;
    }

    .info-card,
    .message-card,
    .related-card,
    .metadata-card {
      border-radius: 8px;
      box-shadow: 0 2px 8px rgba(0,0,0,0.1);
    }

    .info-grid,
    .related-grid,
    .metadata-grid {
      display: grid;
      grid-template-columns: 1fr;
      gap: 0.75rem;

      @media (min-width: 600px) {
        grid-template-columns: repeat(2, 1fr);
      }
    }

    .info-item,
    .related-item,
    .metadata-item {
      display: flex;
      flex-direction: column;
      gap: 0.25rem;
      padding: 0.75rem;
      background-color: var(--absa-gray-light);
      border-radius: 6px;

      @media (min-width: 600px) {
        flex-direction: row;
        align-items: center;
        justify-content: space-between;
      }

      .label {
        font-weight: 600;
        color: var(--absa-gray-dark);
        min-width: 120px;
      }

      .value {
        color: var(--absa-dark-blue);
        word-break: break-word;

        &.user-agent {
          font-size: 0.85rem;
          max-width: 300px;
          overflow: hidden;
          text-overflow: ellipsis;
          white-space: nowrap;
        }
      }
    }

    .message-text {
      font-size: 1rem;
      line-height: 1.5;
      color: var(--absa-gray-dark);
      margin: 0;
      white-space: pre-wrap;
      word-break: break-word;
    }

    // Severity chip styles
    mat-chip {
      &.severity-critical {
        background-color: var(--alert-critical) !important;
        color: var(--absa-white) !important;
      }

      &.severity-error {
        background-color: var(--alert-critical) !important;
        color: var(--absa-white) !important;
      }

      &.severity-warning {
        background-color: var(--alert-medium) !important;
        color: var(--absa-white) !important;
      }

      &.severity-info {
        background-color: var(--alert-low) !important;
        color: var(--absa-white) !important;
      }

      mat-icon {
        color: var(--absa-white) !important;
      }
    }
  `]
})
export class LogDetailsModalComponent {
  LOG_TYPE_LABELS = LOG_TYPE_LABELS;
  LOG_CATEGORY_LABELS = LOG_CATEGORY_LABELS;
  LOG_SEVERITY_LABELS = LOG_SEVERITY_LABELS;

  constructor(
    private dialogRef: MatDialogRef<LogDetailsModalComponent>,
    @Inject(MAT_DIALOG_DATA) public log: SystemLog
  ) {}

  onClose(): void {
    this.dialogRef.close();
  }

  hasRelatedInfo(): boolean {
    return !!(this.log.requestId || this.log.inventoryId || this.log.ipAddress || this.log.userAgent);
  }

  hasMetadata(): boolean {
    return !!(this.log.metadata && Object.keys(this.log.metadata).length > 0);
  }

  getMetadataEntries(): { key: string; value: any }[] {
    if (!this.log.metadata) return [];
    return Object.entries(this.log.metadata).map(([key, value]) => ({ key, value }));
  }

  formatMetadataKey(key: string): string {
    return key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase());
  }

  formatMetadataValue(value: any): string {
    if (typeof value === 'object') {
      return JSON.stringify(value, null, 2);
    }
    return String(value);
  }

  formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('en-ZA', {
      year: 'numeric',
      month: 'long',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      timeZoneName: 'short'
    }).format(new Date(date));
  }

  getSeverityClass(severity: LogSeverity): string {
    return `severity-${severity.toLowerCase()}`;
  }

  getSeverityIcon(severity: LogSeverity): string {
    switch (severity) {
      case LogSeverity.CRITICAL: return 'error';
      case LogSeverity.ERROR: return 'error_outline';
      case LogSeverity.WARNING: return 'warning';
      case LogSeverity.INFO: return 'info';
      default: return 'info';
    }
  }
}
