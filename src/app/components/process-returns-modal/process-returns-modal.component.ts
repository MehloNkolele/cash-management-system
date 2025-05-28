import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatIconModule } from '@angular/material/icon';
import { MatChipsModule } from '@angular/material/chips';
import { MatCheckboxModule } from '@angular/material/checkbox';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { CashRequest, RequestStatus } from '../../models/cash-request.model';
import { CashRequestService } from '../../services/cash-request.service';
import { SystemLogService } from '../../services/system-log.service';
import { UserService } from '../../services/user.service';

@Component({
  selector: 'app-process-returns-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatTableModule,
    MatIconModule,
    MatChipsModule,
    MatCheckboxModule,
    MatFormFieldModule,
    MatInputModule,
    MatSnackBarModule
  ],
  template: `
    <div class="process-returns-modal">
      <h2 mat-dialog-title>
        <mat-icon>assignment_return</mat-icon>
        Process Cash Returns
      </h2>
      
      <mat-dialog-content>
        <div class="returns-content">
          <div class="pending-returns" *ngIf="pendingReturns.length > 0">
            <h3>Pending Returns ({{ pendingReturns.length }})</h3>
            
            <table mat-table [dataSource]="pendingReturns" class="returns-table">
              <ng-container matColumnDef="select">
                <th mat-header-cell *matHeaderCellDef>
                  <mat-checkbox (change)="toggleSelectAll($event.checked)"
                                [checked]="allSelected"
                                [indeterminate]="someSelected">
                  </mat-checkbox>
                </th>
                <td mat-cell *matCellDef="let request">
                  <mat-checkbox [(ngModel)]="request.selected"
                                (change)="updateSelection()">
                  </mat-checkbox>
                </td>
              </ng-container>

              <ng-container matColumnDef="requester">
                <th mat-header-cell *matHeaderCellDef>Requester</th>
                <td mat-cell *matCellDef="let request">{{ request.requesterName }}</td>
              </ng-container>

              <ng-container matColumnDef="amount">
                <th mat-header-cell *matHeaderCellDef>Amount</th>
                <td mat-cell *matCellDef="let request">{{ formatCurrency(calculateTotal(request)) }}</td>
              </ng-container>

              <ng-container matColumnDef="status">
                <th mat-header-cell *matHeaderCellDef>Status</th>
                <td mat-cell *matCellDef="let request">
                  <mat-chip [class]="getStatusClass(request.status)">
                    {{ request.status | titlecase }}
                  </mat-chip>
                </td>
              </ng-container>

              <ng-container matColumnDef="deadline">
                <th mat-header-cell *matHeaderCellDef>Expected Return</th>
                <td mat-cell *matCellDef="let request">
                  {{ request.expectedReturnDate ? formatDateTime(request.expectedReturnDate) : 'N/A' }}
                </td>
              </ng-container>

              <tr mat-header-row *matHeaderRowDef="displayedColumns"></tr>
              <tr mat-row *matRowDef="let row; columns: displayedColumns;" 
                  [class.overdue]="isOverdue(row)"></tr>
            </table>

            <div class="process-options" *ngIf="selectedReturns.length > 0">
              <h4>Process Selected Returns ({{ selectedReturns.length }})</h4>
              
              <div class="options-grid">
                <mat-checkbox [(ngModel)]="cashCountedOnReturn">
                  Cash counted and verified
                </mat-checkbox>
                
                <mat-form-field appearance="outline" class="full-width">
                  <mat-label>Comments (optional)</mat-label>
                  <input matInput [(ngModel)]="comments" placeholder="Any discrepancies or notes">
                </mat-form-field>
              </div>
            </div>
          </div>

          <div class="no-returns" *ngIf="pendingReturns.length === 0">
            <mat-icon>check_circle</mat-icon>
            <p>No pending returns to process</p>
          </div>
        </div>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-raised-button 
                color="primary" 
                (click)="onProcessReturns()" 
                [disabled]="selectedReturns.length === 0">
          <mat-icon>check</mat-icon>
          Process Returns ({{ selectedReturns.length }})
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .process-returns-modal {
      min-width: 800px;
      max-width: 1000px;
      max-height: 80vh;
    }

    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--absa-dark-blue);
      margin-bottom: 1rem;
    }

    .returns-content {
      max-height: 60vh;
      overflow-y: auto;
    }

    .pending-returns h3 {
      color: var(--absa-dark-blue);
      margin-bottom: 1rem;
    }

    .returns-table {
      width: 100%;
      margin-bottom: 2rem;

      .mat-row.overdue {
        background-color: rgba(227, 24, 55, 0.1);
      }

      th {
        background-color: var(--absa-gray-light);
        color: var(--absa-dark-blue);
        font-weight: 600;
      }
    }

    .process-options {
      background-color: var(--absa-gray-light);
      padding: 1rem;
      border-radius: 8px;
      border-left: 4px solid var(--absa-red);

      h4 {
        margin: 0 0 1rem 0;
        color: var(--absa-dark-blue);
      }

      .options-grid {
        display: flex;
        flex-direction: column;
        gap: 1rem;
      }

      .full-width {
        width: 100%;
      }
    }

    .no-returns {
      text-align: center;
      padding: 3rem 1rem;
      color: var(--absa-gray-medium);

      mat-icon {
        font-size: 4rem;
        width: 4rem;
        height: 4rem;
        margin-bottom: 1rem;
        color: var(--absa-green);
      }

      p {
        font-size: 1.1rem;
        margin: 0;
      }
    }

    mat-dialog-actions {
      padding: 1rem 0 0 0;
      gap: 0.5rem;
    }

    // Status chip styling
    mat-chip {
      &.status-returned {
        background-color: var(--status-returned) !important;
        color: var(--absa-white) !important;
      }

      &.status-issued {
        background-color: var(--status-issued) !important;
        color: var(--absa-white) !important;
      }
    }
  `]
})
export class ProcessReturnsModalComponent implements OnInit {
  pendingReturns: (CashRequest & { selected?: boolean })[] = [];
  displayedColumns: string[] = ['select', 'requester', 'amount', 'status', 'deadline'];
  
  cashCountedOnReturn: boolean = true;
  comments: string = '';
  
  allSelected = false;
  someSelected = false;

  constructor(
    private dialogRef: MatDialogRef<ProcessReturnsModalComponent>,
    private cashRequestService: CashRequestService,
    private systemLogService: SystemLogService,
    private userService: UserService,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.loadPendingReturns();
  }

  private loadPendingReturns(): void {
    const allRequests = this.cashRequestService.getAllRequests();
    this.pendingReturns = allRequests
      .filter(request => request.status === RequestStatus.RETURNED)
      .map(request => ({ ...request, selected: false }));
  }

  get selectedReturns(): CashRequest[] {
    return this.pendingReturns.filter(request => request.selected);
  }

  toggleSelectAll(checked: boolean): void {
    this.pendingReturns.forEach(request => request.selected = checked);
    this.updateSelection();
  }

  updateSelection(): void {
    const selectedCount = this.selectedReturns.length;
    const totalCount = this.pendingReturns.length;
    
    this.allSelected = selectedCount === totalCount && totalCount > 0;
    this.someSelected = selectedCount > 0 && selectedCount < totalCount;
  }

  isOverdue(request: CashRequest): boolean {
    if (!request.expectedReturnDate) return false;
    
    const deadline = new Date(request.expectedReturnDate);
    deadline.setHours(15, 0, 0, 0); // 3 PM deadline
    
    return new Date() > deadline;
  }

  onProcessReturns(): void {
    if (this.selectedReturns.length === 0) {
      this.snackBar.open('Please select at least one return to process', 'Close', { duration: 3000 });
      return;
    }

    const currentUser = this.userService.getCurrentUser();
    if (!currentUser) {
      this.snackBar.open('User not found', 'Close', { duration: 3000 });
      return;
    }

    let processedCount = 0;
    let errorCount = 0;

    this.selectedReturns.forEach(request => {
      try {
        const result = this.cashRequestService.returnCash(
          request.id,
          this.cashCountedOnReturn,
          currentUser.fullName,
          this.comments || undefined
        );

        if (result) {
          processedCount++;
          
          // Log the return processing
          this.systemLogService.logManagerAction(
            'Process Cash Return',
            `Processed return for request ${request.id} from ${request.requesterName}`
          );

          // Check if return was late
          if (this.isOverdue(request)) {
            this.systemLogService.logLateReturn(request);
          }

          // Log any discrepancies
          if (this.comments && this.comments.toLowerCase().includes('discrepancy')) {
            this.systemLogService.logCashDiscrepancy(request, this.comments);
          }
        } else {
          errorCount++;
        }
      } catch (error) {
        console.error('Error processing return:', error);
        errorCount++;
      }
    });

    if (processedCount > 0) {
      this.snackBar.open(
        `Successfully processed ${processedCount} return(s)${errorCount > 0 ? ` (${errorCount} failed)` : ''}`,
        'Close',
        { duration: 3000 }
      );

      this.dialogRef.close({ success: true, processed: processedCount });
    } else {
      this.snackBar.open('Failed to process returns', 'Close', { duration: 3000 });
    }
  }

  onCancel(): void {
    this.dialogRef.close({ success: false });
  }

  calculateTotal(request: CashRequest): number {
    return request.bankNotes.reduce((sum, note) => sum + (note.denomination * note.quantity), 0);
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  }

  formatDateTime(date: Date): string {
    return new Intl.DateTimeFormat('en-ZA', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    }).format(new Date(date));
  }

  getStatusClass(status: RequestStatus): string {
    return `status-${status.toLowerCase()}`;
  }
}
