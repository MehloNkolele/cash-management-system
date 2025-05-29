import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { ActivatedRoute, Router } from '@angular/router';
import { MatToolbarModule } from '@angular/material/toolbar';
import { MatButtonModule } from '@angular/material/button';
import { MatIconModule } from '@angular/material/icon';
import { MatCardModule } from '@angular/material/card';
import { MatFormFieldModule } from '@angular/material/form-field';
import { MatInputModule } from '@angular/material/input';
import { MatSelectModule } from '@angular/material/select';
import { MatDatepickerModule } from '@angular/material/datepicker';
import { MatNativeDateModule } from '@angular/material/core';
import { MatSnackBarModule, MatSnackBar } from '@angular/material/snack-bar';
import { MatChipsModule } from '@angular/material/chips';
import { MatMenuModule } from '@angular/material/menu';
import { MatDialogModule, MatDialog } from '@angular/material/dialog';
import { MatDividerModule } from '@angular/material/divider';

import { User } from '../../models/user.model';
import { CashRequest, RequestStatus } from '../../models/cash-request.model';
import { NoteSeries } from '../../models/inventory.model';
import { UserService } from '../../services/user.service';
import { CashRequestService } from '../../services/cash-request.service';
import { InventoryService } from '../../services/inventory.service';
import { TimeUtilityService } from '../../services/time-utility.service';

@Component({
  selector: 'app-request-details',
  standalone: true,
  imports: [
    CommonModule,
    FormsModule,
    MatToolbarModule,
    MatButtonModule,
    MatIconModule,
    MatCardModule,
    MatFormFieldModule,
    MatInputModule,
    MatSelectModule,
    MatDatepickerModule,
    MatNativeDateModule,
    MatSnackBarModule,
    MatChipsModule,
    MatMenuModule,
    MatDialogModule,
    MatDividerModule
  ],
  templateUrl: './request-details.component.html',
  styleUrl: './request-details.component.scss'
})
export class RequestDetailsComponent implements OnInit {
  currentUser: User | null = null;
  request: CashRequest | null = null;
  isIssuer: boolean = false;
  isRequester: boolean = false;

  // Form fields for issuer actions
  expectedReturnDate: Date = new Date();
  cashCountedBeforeIssuance: boolean = false;
  cashCountedOnReturn: boolean = false;
  cashReceivedBy: string = '';
  comments: string = '';

  // 3PM deadline related properties
  returnDateValidation: { isValid: boolean; message: string } = { isValid: true, message: '' };
  timeUntilDeadline: { isOverdue: boolean; hoursRemaining: number; minutesRemaining: number; message: string } | null = null;



  constructor(
    private route: ActivatedRoute,
    private router: Router,
    private userService: UserService,
    private cashRequestService: CashRequestService,
    private inventoryService: InventoryService,
    private snackBar: MatSnackBar,
    private dialog: MatDialog,
    private timeUtilityService: TimeUtilityService
  ) {}

  ngOnInit(): void {
    this.currentUser = this.userService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.isIssuer = this.userService.isIssuer() || this.userService.isManager();
    this.isRequester = this.userService.isRequester();

    const requestId = this.route.snapshot.paramMap.get('id');
    if (requestId) {
      this.loadRequest(requestId);
    }
  }

  private loadRequest(id: string): void {
    this.request = this.cashRequestService.getRequestById(id);
    if (!this.request) {
      this.snackBar.open('Request not found', 'Close', { duration: 3000 });
      this.goBack();
      return;
    }

    // Set default values for issuer actions
    if (this.isIssuer) {
      this.cashReceivedBy = this.currentUser?.fullName || '';
      // Set default return date to today at 3PM (non-editable)
      this.expectedReturnDate = this.timeUtilityService.getDefaultReturnDate();
      this.validateReturnDate();
    }

    // Calculate time until deadline for issued requests
    if (this.request.status === RequestStatus.ISSUED && this.request.expectedReturnDate) {
      this.timeUntilDeadline = this.timeUtilityService.getTimeUntilDeadline(this.request.expectedReturnDate);
    }


  }

  approveRequest(): void {
    if (!this.request || !this.currentUser) return;

    try {
      // Use the default return date (today at 3PM)
      const returnDateAt3PM = this.timeUtilityService.setTimeTo3PM(this.expectedReturnDate);

      // Process inventory deduction
      this.inventoryService.processCashRequestApproval(
        this.request.bankNotes,
        this.request.id,
        this.currentUser.fullName
      );

      this.cashRequestService.approveRequest(
        this.request.id,
        this.currentUser.id,
        returnDateAt3PM
      );

      this.snackBar.open(
        `Request approved! Cash must be returned by ${this.timeUtilityService.formatReturnDeadline(returnDateAt3PM)}`,
        'Close',
        { duration: 5000 }
      );
      this.loadRequest(this.request.id);
    } catch (error: any) {
      this.snackBar.open(
        error.message || 'Error approving request',
        'Close',
        { duration: 5000 }
      );
    }
  }

  issueCash(): void {
    if (!this.request) return;

    try {
      this.cashRequestService.issueCash(this.request.id, this.cashCountedBeforeIssuance);

      this.snackBar.open('Cash issued successfully!', 'Close', { duration: 3000 });
      this.loadRequest(this.request.id);
    } catch (error) {
      this.snackBar.open('Error issuing cash', 'Close', { duration: 3000 });
    }
  }

  returnCash(): void {
    if (!this.request) return;

    try {
      this.cashRequestService.returnCash(
        this.request.id,
        this.cashCountedOnReturn,
        this.cashReceivedBy,
        this.comments || undefined
      );

      this.snackBar.open('Cash return processed successfully!', 'Close', { duration: 3000 });
      this.loadRequest(this.request.id);
    } catch (error) {
      this.snackBar.open('Error processing cash return', 'Close', { duration: 3000 });
    }
  }

  completeRequest(): void {
    if (!this.request) return;

    try {
      this.cashRequestService.completeRequest(this.request.id);

      this.snackBar.open('Request completed successfully!', 'Close', { duration: 3000 });
      this.loadRequest(this.request.id);
    } catch (error) {
      this.snackBar.open('Error completing request', 'Close', { duration: 3000 });
    }
  }

  cancelRequest(): void {
    if (!this.request) return;

    const reason = prompt('Please provide a reason for cancellation:');
    if (reason === null) return; // User cancelled

    try {
      this.cashRequestService.cancelRequest(this.request.id, reason);

      this.snackBar.open('Request cancelled successfully!', 'Close', { duration: 3000 });
      this.loadRequest(this.request.id);
    } catch (error) {
      this.snackBar.open('Error cancelling request', 'Close', { duration: 3000 });
    }
  }

  rejectRequest(): void {
    if (!this.request || !this.currentUser) return;

    const reason = prompt('Please provide a reason for rejection:');
    if (reason === null || reason.trim() === '') {
      this.snackBar.open('Rejection reason is required', 'Close', { duration: 3000 });
      return;
    }

    try {
      this.cashRequestService.rejectRequest(this.request.id, reason.trim(), this.currentUser.fullName);

      this.snackBar.open('Request rejected successfully!', 'Close', { duration: 3000 });
      this.loadRequest(this.request.id);
    } catch (error: any) {
      this.snackBar.open(
        error.message || 'Error rejecting request',
        'Close',
        { duration: 3000 }
      );
    }
  }

  calculateTotalAmount(): number {
    if (!this.request) return 0;
    return this.request.bankNotes.reduce((total, note) => total + (note.denomination * note.quantity), 0);
  }

  formatCurrency(amount: number): string {
    return `R${amount.toLocaleString()}`;
  }

  getStatusColor(status: RequestStatus): string {
    switch (status) {
      case RequestStatus.PENDING:
        return 'warn';
      case RequestStatus.APPROVED:
        return 'accent';
      case RequestStatus.ISSUED:
        return 'primary';
      case RequestStatus.RETURNED:
        return 'accent';
      case RequestStatus.COMPLETED:
        return 'primary';
      case RequestStatus.CANCELLED:
        return 'warn';
      case RequestStatus.REJECTED:
        return 'warn';
      default:
        return '';
    }
  }

  getStatusIcon(status: RequestStatus): string {
    switch (status) {
      case RequestStatus.PENDING:
        return 'schedule';
      case RequestStatus.APPROVED:
        return 'check_circle';
      case RequestStatus.ISSUED:
        return 'payments';
      case RequestStatus.RETURNED:
        return 'assignment_return';
      case RequestStatus.COMPLETED:
        return 'done_all';
      case RequestStatus.CANCELLED:
        return 'cancel';
      case RequestStatus.REJECTED:
        return 'block';
      default:
        return 'help';
    }
  }

  canApprove(): boolean {
    return this.isIssuer && this.request?.status === RequestStatus.PENDING;
  }

  canIssue(): boolean {
    return this.isIssuer && this.request?.status === RequestStatus.APPROVED;
  }

  canReturn(): boolean {
    return this.isIssuer && this.request?.status === RequestStatus.ISSUED;
  }

  canComplete(): boolean {
    return this.isIssuer && this.request?.status === RequestStatus.RETURNED;
  }

  canCancel(): boolean {
    return this.isIssuer &&
           !!this.request?.status &&
           [RequestStatus.PENDING, RequestStatus.APPROVED].includes(this.request.status);
  }

  canReject(): boolean {
    // Only managers can manually reject requests at any stage
    return this.userService.isManager() &&
           !!this.request?.status &&
           [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.ISSUED].includes(this.request.status);
  }

  goBack(): void {
    if (this.userService.isManager()) {
      this.router.navigate(['/manager-dashboard']);
    } else if (this.userService.isIssuer()) {
      this.router.navigate(['/issuer-dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  navigateToDashboard(): void {
    if (this.userService.isManager()) {
      this.router.navigate(['/manager-dashboard']);
    } else if (this.userService.isIssuer()) {
      this.router.navigate(['/issuer-dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  // New methods for the redesigned template
  hasProcessingDetails(): boolean {
    return !!(this.request?.issuedBy ||
              this.request?.actualReturnDate ||
              this.request?.cashReceivedBy ||
              this.request?.cashCountedBeforeIssuance !== undefined ||
              this.request?.cashCountedOnReturn !== undefined);
  }

  getSeriesLabel(series: NoteSeries): string {
    const seriesLabels = {
      [NoteSeries.MANDELA]: 'Mandela Series',
      [NoteSeries.BIG_5]: 'Big 5 Series',
      [NoteSeries.COMMEMORATIVE]: 'Commemorative',
      [NoteSeries.V6]: 'V6 Series'
    };
    return seriesLabels[series] || series;
  }

  // Timeline methods
  isStepCompleted(status: string): boolean {
    const statusOrder = [RequestStatus.PENDING, RequestStatus.APPROVED, RequestStatus.ISSUED, RequestStatus.RETURNED, RequestStatus.COMPLETED];
    const currentIndex = statusOrder.indexOf(this.request?.status || RequestStatus.PENDING);
    const stepIndex = statusOrder.indexOf(status as RequestStatus);

    // Special handling for rejected/cancelled states
    if (this.request?.status === RequestStatus.REJECTED || this.request?.status === RequestStatus.CANCELLED) {
      return stepIndex === 0; // Only submitted step is completed
    }

    return currentIndex > stepIndex;
  }

  getTimelineIcon(status: string): string {
    const icons: { [key: string]: string } = {
      [RequestStatus.PENDING]: 'send',
      [RequestStatus.APPROVED]: 'check_circle',
      [RequestStatus.ISSUED]: 'payments',
      [RequestStatus.RETURNED]: 'assignment_return',
      [RequestStatus.COMPLETED]: 'done_all'
    };

    if (this.isStepCompleted(status)) {
      return 'check_circle';
    } else if (this.request?.status === status) {
      return icons[status] || 'radio_button_unchecked';
    } else {
      return 'radio_button_unchecked';
    }
  }

  // Action methods for header buttons
  printRequest(): void {
    window.print();
  }

  exportRequest(): void {
    // Create a simple text export
    const exportData = {
      requestId: this.request?.id,
      requester: this.request?.requesterName,
      department: this.request?.department,
      status: this.request?.status,
      dateRequested: this.request?.dateRequested,
      totalAmount: this.calculateTotalAmount(),
      bankNotes: this.request?.bankNotes,
      coinsRequested: this.request?.coinsRequested,
      dyePackRequired: this.request?.dyePackRequired
    };

    const dataStr = JSON.stringify(exportData, null, 2);
    const dataBlob = new Blob([dataStr], { type: 'application/json' });
    const url = URL.createObjectURL(dataBlob);

    const link = document.createElement('a');
    link.href = url;
    link.download = `cash-request-${this.request?.id}.json`;
    link.click();

    URL.revokeObjectURL(url);
    this.snackBar.open('Request exported successfully', 'Close', { duration: 3000 });
  }

  /**
   * Validates the selected return date against 3PM deadline rules
   */
  validateReturnDate(): void {
    this.returnDateValidation = this.timeUtilityService.validateReturnDate(this.expectedReturnDate);
  }



  /**
   * Gets the formatted deadline message for display
   */
  getDeadlineMessage(): string {
    if (this.expectedReturnDate) {
      return this.timeUtilityService.formatReturnDeadline(this.expectedReturnDate);
    }
    return '';
  }

  /**
   * Checks if the request is overdue
   */
  isRequestOverdue(): boolean {
    return this.timeUntilDeadline?.isOverdue || false;
  }

  /**
   * Gets the time remaining message
   */
  getTimeRemainingMessage(): string {
    return this.timeUntilDeadline?.message || '';
  }

  /**
   * Get manager name for suggestions
   */
  getManagerName(): string {
    const managers = this.userService.getManagers();
    return managers.length > 0 ? managers[0].fullName : 'Manager';
  }
}
