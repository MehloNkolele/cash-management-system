import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatSelectModule } from '@angular/material/select';
import { MatInputModule } from '@angular/material/input';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatPaginatorModule, PageEvent } from '@angular/material/paginator';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { SystemLog, LogType, LogCategory, LogSeverity, LogFilter } from '../../models/system-log.model';
import { SystemLogService } from '../../services/system-log.service';
import { LogDetailsModalComponent } from '../log-details-modal/log-details-modal.component';

@Component({
  selector: 'app-system-logs-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatChipsModule,
    MatFormFieldModule,
    MatSelectModule,
    MatInputModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatPaginatorModule,
    MatSnackBarModule
  ],
  template: `
    <div class="system-logs-modal">
      <h2 mat-dialog-title>
        <mat-icon>list_alt</mat-icon>
        System Logs
        <span class="log-count">({{ filteredLogs.length }} entries)</span>
      </h2>
      
      <mat-dialog-content>
        <!-- Filters Section -->
        <div class="filters-section">
          <h3>Filters</h3>
          <div class="filters-grid">
            <mat-form-field appearance="outline">
              <mat-label>Start Date</mat-label>
              <input matInput [matDatepicker]="startPicker" [(ngModel)]="filter.startDate" (dateChange)="applyFilters()">
              <mat-datepicker-toggle matSuffix [for]="startPicker"></mat-datepicker-toggle>
              <mat-datepicker #startPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>End Date</mat-label>
              <input matInput [matDatepicker]="endPicker" [(ngModel)]="filter.endDate" (dateChange)="applyFilters()">
              <mat-datepicker-toggle matSuffix [for]="endPicker"></mat-datepicker-toggle>
              <mat-datepicker #endPicker></mat-datepicker>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Log Type</mat-label>
              <mat-select [(ngModel)]="selectedTypes" multiple (selectionChange)="applyFilters()">
                <mat-option *ngFor="let type of logTypes" [value]="type.value">
                  {{ type.label }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Severity</mat-label>
              <mat-select [(ngModel)]="selectedSeverities" multiple (selectionChange)="applyFilters()">
                <mat-option *ngFor="let severity of logSeverities" [value]="severity.value">
                  {{ severity.label }}
                </mat-option>
              </mat-select>
            </mat-form-field>

            <mat-form-field appearance="outline">
              <mat-label>Search</mat-label>
              <input matInput [(ngModel)]="filter.searchTerm" (input)="applyFilters()" placeholder="Search logs...">
              <mat-icon matSuffix>search</mat-icon>
            </mat-form-field>

            <button mat-stroked-button (click)="clearFilters()">
              <mat-icon>clear</mat-icon>
              Clear Filters
            </button>
          </div>
        </div>

        <!-- Logs Table -->
        <div class="logs-table-container">
          <table mat-table [dataSource]="paginatedLogs" class="logs-table">
            <ng-container matColumnDef="timestamp">
              <th mat-header-cell *matHeaderCellDef>Time</th>
              <td mat-cell *matCellDef="let log">{{ formatDateTime(log.timestamp) }}</td>
            </ng-container>

            <ng-container matColumnDef="severity">
              <th mat-header-cell *matHeaderCellDef>Severity</th>
              <td mat-cell *matCellDef="let log">
                <mat-chip [class]="getSeverityClass(log.severity)">
                  <mat-icon>{{ getSeverityIcon(log.severity) }}</mat-icon>
                  {{ log.severity | titlecase }}
                </mat-chip>
              </td>
            </ng-container>

            <ng-container matColumnDef="type">
              <th mat-header-cell *matHeaderCellDef>Type</th>
              <td mat-cell *matCellDef="let log">{{ log.type | titlecase }}</td>
            </ng-container>

            <ng-container matColumnDef="user">
              <th mat-header-cell *matHeaderCellDef>User</th>
              <td mat-cell *matCellDef="let log">{{ log.userName || 'System' }}</td>
            </ng-container>

            <ng-container matColumnDef="message">
              <th mat-header-cell *matHeaderCellDef>Message</th>
              <td mat-cell *matCellDef="let log" class="message-cell">{{ log.message }}</td>
            </ng-container>

            <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
            <tr mat-row *matRowDef="let row; columns: displayedColumns;"
                class="clickable-row"
                (click)="onLogClick(row)"
                title="Click to view full details"></tr>
          </table>

          <!-- Pagination -->
          <mat-paginator 
            [length]="filteredLogs.length"
            [pageSize]="pageSize"
            [pageSizeOptions]="[10, 25, 50, 100]"
            (page)="onPageChange($event)"
            showFirstLastButtons>
          </mat-paginator>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="exportLogs()">
          <mat-icon>download</mat-icon>
          Export CSV
        </button>
        <button mat-button (click)="onClose()">Close</button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .system-logs-modal {
      width: 90vw;
      max-width: 1200px;
      height: 80vh;
      max-height: 800px;
    }

    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--absa-dark-blue);
      margin-bottom: 1rem;

      .log-count {
        font-size: 0.8rem;
        color: var(--absa-gray-medium);
        font-weight: normal;
      }
    }

    .filters-section {
      background-color: var(--absa-gray-light);
      padding: 1rem;
      border-radius: 8px;
      margin-bottom: 1rem;

      h3 {
        margin: 0 0 1rem 0;
        color: var(--absa-dark-blue);
      }

      .filters-grid {
        display: grid;
        grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
        gap: 1rem;
        align-items: end;
      }
    }

    .logs-table-container {
      height: calc(100% - 200px);
      overflow: auto;
    }

    .logs-table {
      width: 100%;

      th {
        background-color: var(--absa-gray-light);
        color: var(--absa-dark-blue);
        font-weight: 600;
        position: sticky;
        top: 0;
        z-index: 1;
      }

      .message-cell {
        max-width: 300px;
        overflow: hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }

      .mat-row:hover {
        background-color: rgba(227, 24, 55, 0.05);
      }

      .clickable-row {
        cursor: pointer;
        transition: background-color 0.2s ease;

        &:hover {
          background-color: rgba(227, 24, 55, 0.08) !important;
        }

        &:active {
          background-color: rgba(227, 24, 55, 0.12) !important;
        }
      }
    }

    // Severity chip styling
    mat-chip {
      display: inline-flex !important; // Ensure chip itself behaves as inline-flex for content alignment
      align-items: center !important;
      gap: 0.25rem !important; // Add a small gap between icon and text
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
        font-size: 1rem;
        width: 1rem;
        height: 1rem;
        vertical-align: middle; // Ensure icon aligns well with text
      }

      // Ensure icon and text are on the same line and centered
      .mdc-chip__text-label, // For MDC based mat-chip
      span:not([class]), // For plain text nodes or simple spans if mat-chip wraps text
      span.mat-mdc-chip-action-label { // For mat-chip's text label span
        display: inline-flex;
        align-items: center;
        vertical-align: middle;
      }
    }

    mat-dialog-actions {
      padding: 1rem 0 0 0;
      gap: 0.5rem;
    }
  `]
})
export class SystemLogsModalComponent implements OnInit {
  allLogs: SystemLog[] = [];
  filteredLogs: SystemLog[] = [];
  paginatedLogs: SystemLog[] = [];
  
  displayedColumns: string[] = ['timestamp', 'severity', 'type', 'user', 'message'];
  
  filter: LogFilter = {};
  selectedTypes: LogType[] = [];
  selectedSeverities: LogSeverity[] = [];
  
  pageSize = 25;
  currentPage = 0;

  logTypes = Object.values(LogType).map(type => ({
    value: type,
    label: type.replace(/_/g, ' ').replace(/\b\w/g, l => l.toUpperCase())
  }));

  logSeverities = Object.values(LogSeverity).map(severity => ({
    value: severity,
    label: severity.charAt(0).toUpperCase() + severity.slice(1)
  }));

  constructor(
    private dialogRef: MatDialogRef<SystemLogsModalComponent>,
    private systemLogService: SystemLogService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.loadLogs();
  }

  private loadLogs(): void {
    this.allLogs = this.systemLogService.getAllLogs();
    this.applyFilters();
  }

  applyFilters(): void {
    this.filter.types = this.selectedTypes.length > 0 ? this.selectedTypes : undefined;
    this.filter.severities = this.selectedSeverities.length > 0 ? this.selectedSeverities : undefined;
    
    this.filteredLogs = this.systemLogService.getFilteredLogs(this.filter);
    this.currentPage = 0;
    this.updatePaginatedLogs();
  }

  clearFilters(): void {
    this.filter = {};
    this.selectedTypes = [];
    this.selectedSeverities = [];
    this.applyFilters();
  }

  onPageChange(event: PageEvent): void {
    this.pageSize = event.pageSize;
    this.currentPage = event.pageIndex;
    this.updatePaginatedLogs();
  }

  private updatePaginatedLogs(): void {
    const startIndex = this.currentPage * this.pageSize;
    const endIndex = startIndex + this.pageSize;
    this.paginatedLogs = this.filteredLogs.slice(startIndex, endIndex);
  }

  exportLogs(): void {
    try {
      const csvData = this.systemLogService.exportLogs(this.filter);
      const blob = new Blob([csvData], { type: 'text/csv' });
      const url = window.URL.createObjectURL(blob);
      const link = document.createElement('a');
      link.href = url;
      link.download = `system-logs-${new Date().toISOString().split('T')[0]}.csv`;
      link.click();
      window.URL.revokeObjectURL(url);
      
      this.snackBar.open('Logs exported successfully', 'Close', { duration: 3000 });
    } catch (error) {
      console.error('Error exporting logs:', error);
      this.snackBar.open('Error exporting logs', 'Close', { duration: 3000 });
    }
  }

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

  onClose(): void {
    this.dialogRef.close();
  }

  formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit'
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
