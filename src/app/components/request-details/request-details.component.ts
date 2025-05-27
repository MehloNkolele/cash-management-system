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
import { UserService } from '../../services/user.service';
import { CashRequestService } from '../../services/cash-request.service';
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

    this.isIssuer = this.userService.isIssuer();
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
      // Set default return date to next valid date at 3PM
      this.expectedReturnDate = this.timeUtilityService.getNextValidReturnDate();
      this.validateReturnDate();
    }

    // Calculate time until deadline for issued requests
    if (this.request.status === RequestStatus.ISSUED && this.request.expectedReturnDate) {
      this.timeUntilDeadline = this.timeUtilityService.getTimeUntilDeadline(this.request.expectedReturnDate);
    }
  }

  approveRequest(): void {
    if (!this.request || !this.currentUser) return;

    // Validate return date before approving
    if (!this.returnDateValidation.isValid) {
      this.snackBar.open(this.returnDateValidation.message, 'Close', { duration: 5000 });
      return;
    }

    try {
      // Ensure the return date is set to 3PM
      const returnDateAt3PM = this.timeUtilityService.setTimeTo3PM(this.expectedReturnDate);

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
    } catch (error) {
      this.snackBar.open('Error approving request', 'Close', { duration: 3000 });
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

  goBack(): void {
    if (this.isIssuer) {
      this.router.navigate(['/issuer-dashboard']);
    } else {
      this.router.navigate(['/dashboard']);
    }
  }

  /**
   * Validates the selected return date against 3PM deadline rules
   */
  validateReturnDate(): void {
    this.returnDateValidation = this.timeUtilityService.validateReturnDate(this.expectedReturnDate);
  }

  /**
   * Called when the return date changes in the date picker
   */
  onReturnDateChange(): void {
    this.validateReturnDate();
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
   * Gets the minimum date for the date picker (today)
   */
  getMinDate(): Date {
    return new Date();
  }
}
