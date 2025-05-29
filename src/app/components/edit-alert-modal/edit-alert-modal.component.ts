import { Component, Inject, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { MAT_DIALOG_DATA, MatDialogRef, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Angular Material
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatCardModule } from '@angular/material/card';
import { MatChipsModule } from '@angular/material/chips';
import { MatDividerModule } from '@angular/material/divider';

// Models
import { LowStockAlert, AlertSeverity, NoteSeries, NoteDenomination, NOTE_SERIES_LABELS, DENOMINATION_LABELS } from '../../models/inventory.model';

// Services
import { InventoryService } from '../../services/inventory.service';
import { SystemLogService } from '../../services/system-log.service';

@Component({
  selector: 'app-edit-alert-modal',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatDialogModule,
    MatButtonModule,
    MatIconModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatCardModule,
    MatChipsModule,
    MatDividerModule,
    MatSnackBarModule
  ],
  templateUrl: './edit-alert-modal.component.html',
  styleUrl: './edit-alert-modal.component.scss'
})
export class EditAlertModalComponent implements OnInit {
  alert: LowStockAlert;
  newQuantity: number = 0;
  newThreshold: number = 0;
  addQuantity: number = 0;
  
  // Enums for template
  AlertSeverity = AlertSeverity;
  NOTE_SERIES_LABELS = NOTE_SERIES_LABELS;
  DENOMINATION_LABELS = DENOMINATION_LABELS;

  constructor(
    public dialogRef: MatDialogRef<EditAlertModalComponent>,
    @Inject(MAT_DIALOG_DATA) public data: { alert: LowStockAlert },
    private inventoryService: InventoryService,
    private systemLogService: SystemLogService,
    private snackBar: MatSnackBar
  ) {
    this.alert = { ...data.alert };
    this.newQuantity = this.alert.currentQuantity;
    this.newThreshold = this.alert.minimumThreshold;
  }

  ngOnInit(): void {
    // Initialize form values
  }

  getSeverityClass(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL: return 'severity-critical';
      case AlertSeverity.HIGH: return 'severity-high';
      case AlertSeverity.MEDIUM: return 'severity-medium';
      case AlertSeverity.LOW: return 'severity-low';
      default: return 'severity-low';
    }
  }

  getSeverityIcon(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL: return 'error';
      case AlertSeverity.HIGH: return 'warning';
      case AlertSeverity.MEDIUM: return 'info';
      case AlertSeverity.LOW: return 'check_circle';
      default: return 'info';
    }
  }

  getSeverityColor(severity: AlertSeverity): string {
    switch (severity) {
      case AlertSeverity.CRITICAL: return '#CC0000';
      case AlertSeverity.HIGH: return '#E31837';
      case AlertSeverity.MEDIUM: return '#FFB81C';
      case AlertSeverity.LOW: return '#0066CC';
      default: return '#0066CC';
    }
  }

  onAddStock(): void {
    if (this.addQuantity <= 0) {
      this.snackBar.open('Please enter a valid quantity to add', 'Close', { duration: 3000 });
      return;
    }

    try {
      const success = this.inventoryService.addCash(
        this.alert.series,
        this.alert.denomination,
        this.addQuantity,
        `Stock replenishment for low stock alert - ${this.alert.series} R${this.alert.denomination}`
      );

      if (success) {
        this.systemLogService.logManagerAction(
          'Stock Replenishment',
          `Added ${this.addQuantity} x R${this.alert.denomination} (${this.alert.series}) to resolve low stock alert`
        );

        this.snackBar.open(
          `Successfully added ${this.addQuantity} x R${this.alert.denomination} notes`,
          'Close',
          { duration: 3000 }
        );

        this.dialogRef.close({ success: true, action: 'add_stock', quantity: this.addQuantity });
      } else {
        this.snackBar.open('Failed to add stock', 'Close', { duration: 3000 });
      }
    } catch (error: any) {
      this.snackBar.open(error.message || 'Error adding stock', 'Close', { duration: 3000 });
    }
  }

  onUpdateThreshold(): void {
    if (this.newThreshold < 0) {
      this.snackBar.open('Threshold cannot be negative', 'Close', { duration: 3000 });
      return;
    }

    try {
      const success = this.inventoryService.updateLowStockThreshold(
        this.alert.denomination,
        this.newThreshold
      );

      if (success) {
        this.systemLogService.logManagerAction(
          'Update Stock Threshold',
          `Updated minimum threshold for R${this.alert.denomination} from ${this.alert.minimumThreshold} to ${this.newThreshold}`
        );

        this.snackBar.open(
          `Successfully updated threshold for R${this.alert.denomination}`,
          'Close',
          { duration: 3000 }
        );

        this.dialogRef.close({ success: true, action: 'update_threshold', newThreshold: this.newThreshold });
      } else {
        this.snackBar.open('Failed to update threshold', 'Close', { duration: 3000 });
      }
    } catch (error: any) {
      this.snackBar.open(error.message || 'Error updating threshold', 'Close', { duration: 3000 });
    }
  }

  onCancel(): void {
    this.dialogRef.close();
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  }

  isAddStockValid(): boolean {
    return this.addQuantity > 0;
  }

  isUpdateThresholdValid(): boolean {
    return this.newThreshold >= 0 && this.newThreshold !== this.alert.minimumThreshold;
  }
}
