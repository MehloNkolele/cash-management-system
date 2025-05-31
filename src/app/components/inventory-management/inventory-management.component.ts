import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject } from 'rxjs';
import { takeUntil } from 'rxjs/operators';

// Angular Material Imports
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatTabsModule } from '@angular/material/tabs';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';
import { MatBadgeModule } from '@angular/material/badge';

// Models
import { User } from '../../models/user.model';
import { CashInventory, NoteSeries, NoteDenomination, NOTE_SERIES_LABELS, DENOMINATION_LABELS, InventorySummary, LowStockAlert, AlertSeverity } from '../../models/inventory.model';

// Services
import { UserService } from '../../services/user.service';
import { InventoryService } from '../../services/inventory.service';

// Components
import { AddCashModalComponent } from '../add-cash-modal/add-cash-modal.component';

@Component({
  selector: 'app-inventory-management',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatCardModule,
    MatButtonModule,
    MatIconModule,
    MatTableModule,
    MatChipsModule,
    MatTabsModule,
    MatSnackBarModule,
    MatDialogModule,
    MatMenuModule,
    MatDividerModule,
    MatBadgeModule
  ],
  templateUrl: './inventory-management.component.html',
  styleUrls: ['./inventory-management.component.scss']
})
export class InventoryManagementComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  inventoryBreakdown: { [key in NoteSeries]: CashInventory[] } = {
    [NoteSeries.MANDELA]: [],
    [NoteSeries.BIG_5]: [],
    [NoteSeries.COMMEMORATIVE]: [],
    [NoteSeries.V6]: []
  };
  inventorySummary: InventorySummary | null = null;

  // Constants for templates
  NOTE_SERIES_LABELS = NOTE_SERIES_LABELS;
  DENOMINATION_LABELS = DENOMINATION_LABELS;
  NoteSeries = NoteSeries;

  // Table columns
  displayedColumns: string[] = ['denomination', 'quantity', 'value', 'status', 'actions'];

  constructor(
    public userService: UserService,
    private inventoryService: InventoryService,
    private router: Router,
    private snackBar: MatSnackBar,
    private dialog: MatDialog
  ) {}

  ngOnInit(): void {
    this.currentUser = this.userService.getCurrentUser();

    if (!this.currentUser || !this.hasInventoryAccess()) {
      this.router.navigate(['/login']);
      return;
    }

    this.setupSubscriptions();
    this.loadInventoryData();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private hasInventoryAccess(): boolean {
    return this.userService.hasManagerPrivileges() || this.currentUser?.role === 'issuer';
  }

  private setupSubscriptions(): void {
    this.inventoryService.inventory$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadInventoryData();
      });
  }

  private loadInventoryData(): void {
    this.inventoryBreakdown = this.inventoryService.getDetailedInventoryBreakdown();
    this.inventorySummary = this.inventoryService.getInventorySummary();
  }

  getSeriesArray(): NoteSeries[] {
    return Object.values(NoteSeries);
  }

  getSeriesTotal(series: NoteSeries): { quantity: number; value: number } {
    const items = this.inventoryBreakdown[series];
    return {
      quantity: items.reduce((sum, item) => sum + item.quantity, 0),
      value: items.reduce((sum, item) => sum + item.value, 0)
    };
  }

  getStockStatus(item: CashInventory): { status: string; class: string } {
    if (!this.inventorySummary) return { status: 'Unknown', class: 'status-unknown' };

    const alert = this.inventorySummary.lowStockAlerts.find(a => a.inventoryId === item.id);

    if (!alert) {
      return { status: 'In Stock', class: 'status-in-stock' };
    }

    switch (alert.severity) {
      case AlertSeverity.CRITICAL:
        return { status: 'Critical', class: 'status-critical' };
      case AlertSeverity.HIGH:
        return { status: 'Low Stock', class: 'status-low' };
      case AlertSeverity.MEDIUM:
        return { status: 'Medium', class: 'status-medium' };
      case AlertSeverity.LOW:
        return { status: 'Watch', class: 'status-watch' };
      default:
        return { status: 'In Stock', class: 'status-in-stock' };
    }
  }

  onAddCash(series?: NoteSeries, denomination?: NoteDenomination): void {
    if (!this.userService.hasManagerPrivileges()) {
      this.snackBar.open('Insufficient privileges to add cash', 'Close', { duration: 3000 });
      return;
    }

    const dialogRef = this.dialog.open(AddCashModalComponent, {
      width: '500px',
      disableClose: true,
      data: { series, denomination }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        this.loadInventoryData();
        this.snackBar.open(`Successfully added ${result.added} notes to inventory`, 'Close', { duration: 3000 });
      }
    });
  }

  onResetInventory(): void {
    if (!this.userService.hasManagerPrivileges()) {
      this.snackBar.open('Insufficient privileges to reset inventory', 'Close', { duration: 3000 });
      return;
    }

    if (confirm('Are you sure you want to reset inventory to initial values? This action cannot be undone.')) {
      try {
        this.inventoryService.resetInventoryToInitialValues();
        this.loadInventoryData();
        this.snackBar.open('Inventory reset to initial values successfully', 'Close', { duration: 3000 });
      } catch (error) {
        console.error('Error resetting inventory:', error);
        this.snackBar.open('Error resetting inventory', 'Close', { duration: 3000 });
      }
    }
  }

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  }

  formatNumber(num: number): string {
    return new Intl.NumberFormat('en-ZA').format(num);
  }

  getDenominationLabel(denomination: NoteDenomination): string {
    return DENOMINATION_LABELS[denomination];
  }

  goBack(): void {
    if (this.userService.hasManagerPrivileges()) {
      this.router.navigate(['/manager-dashboard']);
    } else if (this.currentUser?.role === 'issuer') {
      this.router.navigate(['/issuer-dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  navigateToDashboard(): void {
    if (this.userService.hasManagerPrivileges()) {
      this.router.navigate(['/manager-dashboard']);
    } else if (this.currentUser?.role === 'issuer') {
      this.router.navigate(['/issuer-dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  logout(): void {
    this.userService.logout();
    this.router.navigate(['/login']);
  }
}
