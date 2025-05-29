import { Component, OnInit, OnDestroy } from '@angular/core';
import { CommonModule } from '@angular/common';
import { Router } from '@angular/router';
import { Subject, takeUntil } from 'rxjs';

// Angular Material
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatCardModule } from '@angular/material/card';
import { MatIconModule } from '@angular/material/icon';
import { MatButtonModule } from '@angular/material/button';
import { MatTableModule } from '@angular/material/table';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatBadgeModule } from '@angular/material/badge';
import { MatDividerModule } from '@angular/material/divider';
import { MatDialog, MatDialogModule } from '@angular/material/dialog';
import { MatSnackBar, MatSnackBarModule } from '@angular/material/snack-bar';

// Models
import { User } from '../../models/user.model';
import { InventorySummary, LowStockAlert, AlertSeverity } from '../../models/inventory.model';

// Services
import { UserService } from '../../services/user.service';
import { InventoryService } from '../../services/inventory.service';

// Components
import { EditAlertModalComponent } from '../edit-alert-modal/edit-alert-modal.component';

@Component({
  selector: 'app-alerts-overview',
  standalone: true,
  imports: [
    CommonModule,
    MatToolbarModule,
    MatCardModule,
    MatIconModule,
    MatButtonModule,
    MatTableModule,
    MatChipsModule,
    MatMenuModule,
    MatBadgeModule,
    MatDividerModule,
    MatDialogModule,
    MatSnackBarModule
  ],
  templateUrl: './alerts-overview.component.html',
  styleUrl: './alerts-overview.component.scss'
})
export class AlertsOverviewComponent implements OnInit, OnDestroy {
  private destroy$ = new Subject<void>();

  currentUser: User | null = null;
  inventorySummary: InventorySummary | null = null;
  allAlerts: LowStockAlert[] = [];
  criticalAlerts: LowStockAlert[] = [];
  highAlerts: LowStockAlert[] = [];
  mediumAlerts: LowStockAlert[] = [];
  lowAlerts: LowStockAlert[] = [];

  // Table columns
  alertColumns: string[] = ['series', 'denomination', 'quantity', 'threshold', 'severity', 'actions'];

  constructor(
    private userService: UserService,
    private inventoryService: InventoryService,
    private router: Router,
    private dialog: MatDialog,
    private snackBar: MatSnackBar
  ) {}

  ngOnInit(): void {
    this.currentUser = this.userService.getCurrentUser();
    
    // Check if user has appropriate privileges
    if (!this.currentUser || !this.userService.hasManagerPrivileges()) {
      this.router.navigate(['/login']);
      return;
    }

    this.loadAlertsData();
    this.setupSubscriptions();
  }

  ngOnDestroy(): void {
    this.destroy$.next();
    this.destroy$.complete();
  }

  private setupSubscriptions(): void {
    this.inventoryService.inventory$
      .pipe(takeUntil(this.destroy$))
      .subscribe(() => {
        this.loadAlertsData();
      });
  }

  private loadAlertsData(): void {
    this.inventorySummary = this.inventoryService.getInventorySummary();
    this.allAlerts = this.inventorySummary.lowStockAlerts;
    
    // Categorize alerts by severity
    this.criticalAlerts = this.allAlerts.filter(alert => alert.severity === AlertSeverity.CRITICAL);
    this.highAlerts = this.allAlerts.filter(alert => alert.severity === AlertSeverity.HIGH);
    this.mediumAlerts = this.allAlerts.filter(alert => alert.severity === AlertSeverity.MEDIUM);
    this.lowAlerts = this.allAlerts.filter(alert => alert.severity === AlertSeverity.LOW);
  }

  goBack(): void {
    this.router.navigate(['/manager-dashboard']);
  }

  navigateToInventory(): void {
    this.router.navigate(['/inventory-management']);
  }

  onEditAlert(alert: LowStockAlert): void {
    const dialogRef = this.dialog.open(EditAlertModalComponent, {
      width: '600px',
      maxWidth: '95vw',
      maxHeight: '90vh',
      disableClose: false,
      data: { alert }
    });

    dialogRef.afterClosed().subscribe(result => {
      if (result?.success) {
        // Reload alerts data to reflect changes
        this.loadAlertsData();

        // Show success message based on action
        if (result.action === 'add_stock') {
          this.snackBar.open(
            `Successfully added ${result.quantity} notes to inventory`,
            'Close',
            { duration: 3000 }
          );
        } else if (result.action === 'update_threshold') {
          this.snackBar.open(
            `Successfully updated threshold to ${result.newThreshold}`,
            'Close',
            { duration: 3000 }
          );
        }
      }
    });
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

  formatCurrency(amount: number): string {
    return new Intl.NumberFormat('en-ZA', {
      style: 'currency',
      currency: 'ZAR'
    }).format(amount);
  }

  logout(): void {
    this.userService.logout();
    this.router.navigate(['/login']);
  }
}
