import { Component, Inject } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MatDialogRef, MAT_DIALOG_DATA, MatDialogModule } from '@angular/material/dialog';
import { MatButtonModule } from '@angular/material/button';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatIconModule } from '@angular/material/icon';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

import { NoteSeries, NoteDenomination, NOTE_SERIES_LABELS, DENOMINATION_LABELS } from '../../models/inventory.model';
import { InventoryService } from '../../services/inventory.service';
import { SystemLogService } from '../../services/system-log.service';

export interface AddCashData {
  series?: NoteSeries;
  denomination?: NoteDenomination;
}

@Component({
  selector: 'app-add-cash-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatIconModule,
    MatSnackBarModule
  ],
  template: `
    <div class="add-cash-modal">
      <h2 mat-dialog-title>
        <mat-icon>add_circle</mat-icon>
        Add Cash Inventory
      </h2>

      <mat-dialog-content>
        <form #addCashForm="ngForm" class="add-cash-form">
          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Note Series</mat-label>
            <mat-select [(ngModel)]="selectedSeries" name="series" required>
              <mat-option *ngFor="let series of availableSeries" [value]="series.value">
                {{ series.label }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Denomination</mat-label>
            <mat-select [(ngModel)]="selectedDenomination" name="denomination" required>
              <mat-option *ngFor="let denom of availableDenominations" [value]="denom.value">
                {{ denom.label }}
              </mat-option>
            </mat-select>
          </mat-form-field>

          <div class="quantity-inputs">
            <mat-form-field appearance="outline" class="batch-field">
              <mat-label>Batches (100 notes each)</mat-label>
              <input matInput
                     type="number"
                     [(ngModel)]="batches"
                     name="batches"
                     min="0"
                     placeholder="0">
            </mat-form-field>

            <mat-form-field appearance="outline" class="singles-field">
              <mat-label>Singles</mat-label>
              <input matInput
                     type="number"
                     [(ngModel)]="singles"
                     name="singles"
                     min="0"
                     max="99"
                     placeholder="0">
            </mat-form-field>
          </div>

          <mat-form-field appearance="outline" class="full-width">
            <mat-label>Reason</mat-label>
            <input matInput
                   [(ngModel)]="reason"
                   name="reason"
                   required
                   placeholder="Enter reason for adding cash">
          </mat-form-field>

          <div class="summary-section" *ngIf="selectedDenomination && totalQuantity > 0">
            <h4>Summary</h4>
            <div class="summary-item">
              <span>Total Notes:</span>
              <span class="value">{{ totalQuantity }} notes</span>
            </div>
            <div class="summary-item">
              <span>Total Value:</span>
              <span class="value">{{ formatCurrency(selectedDenomination * totalQuantity) }}</span>
            </div>
          </div>
        </form>
      </mat-dialog-content>

      <mat-dialog-actions align="end">
        <button mat-button (click)="onCancel()">Cancel</button>
        <button mat-raised-button
                color="primary"
                (click)="onAddCash()"
                [disabled]="!isFormValid()">
          <mat-icon>add</mat-icon>
          Add Cash
        </button>
      </mat-dialog-actions>
    </div>
  `,
  styles: [`
    .add-cash-modal {
      min-width: 400px;
      max-width: 500px;
    }

    h2[mat-dialog-title] {
      display: flex;
      align-items: center;
      gap: 0.5rem;
      color: var(--absa-dark-blue);
      margin-bottom: 1rem;
    }

    .add-cash-form {
      display: flex;
      flex-direction: column;
      gap: 1rem;
      padding: 1rem 0;
    }

    .full-width {
      width: 100%;
    }

    .quantity-inputs {
      display: flex;
      gap: 1rem;
      align-items: flex-start;

      .batch-field, .singles-field {
        flex: 1;
      }

      .batch-field {
        min-width: 200px;
      }

      .singles-field {
        min-width: 120px;
      }
    }

    .summary-section {
      background-color: var(--absa-gray-light);
      padding: 1rem;
      border-radius: 8px;
      border-left: 4px solid var(--absa-red);

      h4 {
        margin: 0 0 0.5rem 0;
        color: var(--absa-dark-blue);
      }

      .summary-item {
        display: flex;
        justify-content: space-between;
        align-items: center;
        margin-bottom: 0.5rem;

        &:last-child {
          margin-bottom: 0;
        }

        .value {
          font-weight: 600;
          color: var(--absa-red);
          font-size: 1.1rem;
        }
      }
    }

    mat-dialog-actions {
      padding: 1rem 0 0 0;
      gap: 0.5rem;
    }
  `]
})
export class AddCashModalComponent {
  selectedSeries: NoteSeries | null = null;
  selectedDenomination: NoteDenomination | null = null;
  batches: number = 0;
  singles: number = 0;
  reason: string = '';

  // Computed property for total quantity
  get totalQuantity(): number {
    return (this.batches * 100) + this.singles;
  }

  availableSeries = Object.values(NoteSeries).map(series => ({
    value: series,
    label: NOTE_SERIES_LABELS[series]
  }));

  availableDenominations = Object.values(NoteDenomination)
    .filter(d => typeof d === 'number')
    .map(denom => ({
      value: denom as NoteDenomination,
      label: DENOMINATION_LABELS[denom as NoteDenomination]
    }));

  constructor(
    private dialogRef: MatDialogRef<AddCashModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: AddCashData,
    private inventoryService: InventoryService,
    private systemLogService: SystemLogService,
    private snackBar: MatSnackBar
  ) {
    // Pre-populate if data provided
    if (data?.series) {
      this.selectedSeries = data.series;
    }
    if (data?.denomination) {
      this.selectedDenomination = data.denomination;
    }
  }

  isFormValid(): boolean {
    return !!(this.selectedSeries &&
              this.selectedDenomination &&
              this.totalQuantity > 0 &&
              this.reason.trim());
  }

  onAddCash(): void {
    if (!this.isFormValid()) {
      this.snackBar.open('Please fill in all required fields', 'Close', { duration: 3000 });
      return;
    }

    try {
      const success = this.inventoryService.addCash(
        this.selectedSeries!,
        this.selectedDenomination!,
        this.totalQuantity,
        this.reason
      );

      if (success) {
        // Create descriptive message for logging
        const batchDescription = this.batches > 0 ? `${this.batches} batch${this.batches !== 1 ? 'es' : ''}` : '';
        const singlesDescription = this.singles > 0 ? `${this.singles} single${this.singles !== 1 ? 's' : ''}` : '';
        const quantityDescription = [batchDescription, singlesDescription].filter(Boolean).join(' + ');

        // Log the action
        this.systemLogService.logManagerAction(
          'Add Cash Inventory',
          `Added ${quantityDescription} (${this.totalQuantity} total) x ${DENOMINATION_LABELS[this.selectedDenomination!]} (${NOTE_SERIES_LABELS[this.selectedSeries!]}) - ${this.reason}`
        );

        this.snackBar.open(
          `Successfully added ${quantityDescription} (${this.totalQuantity} notes) x ${DENOMINATION_LABELS[this.selectedDenomination!]}`,
          'Close',
          { duration: 4000 }
        );

        this.dialogRef.close({ success: true, added: this.totalQuantity });
      } else {
        this.snackBar.open('Failed to add cash inventory', 'Close', { duration: 3000 });
      }
    } catch (error) {
      console.error('Error adding cash:', error);
      this.snackBar.open('Error adding cash inventory', 'Close', { duration: 3000 });
    }
  }

  onCancel(): void {
    this.dialogRef.close({ success: false });
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  }
}
