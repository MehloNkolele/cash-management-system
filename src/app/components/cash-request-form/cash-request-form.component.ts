import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
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
import { MatStepperModule } from '@angular/material/stepper';
import { MatMenuModule } from '@angular/material/menu';
import { MatDividerModule } from '@angular/material/divider';

import { User, Department } from '../../models/user.model';
import { BankNote, NoteDenomination, CashRequest } from '../../models/cash-request.model';
import { UserService } from '../../services/user.service';
import { CashRequestService } from '../../services/cash-request.service';

@Component({
  selector: 'app-cash-request-form',
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
    MatStepperModule,
    MatMenuModule,
    MatDividerModule
  ],
  templateUrl: './cash-request-form.component.html',
  styleUrl: './cash-request-form.component.scss'
})
export class CashRequestFormComponent implements OnInit {
  currentUser: User | null = null;
  departments: Department[] = [];

  // Form data
  selectedDepartment: string = '';
  dateRequested: Date = new Date();
  bankNotes: BankNote[] = [];
  comments: string = '';

  // Available denominations
  denominations = [
    { value: NoteDenomination.R10, label: 'R10' },
    { value: NoteDenomination.R20, label: 'R20' },
    { value: NoteDenomination.R50, label: 'R50' },
    { value: NoteDenomination.R100, label: 'R100' },
    { value: NoteDenomination.R200, label: 'R200' }
  ];

  constructor(
    private userService: UserService,
    private cashRequestService: CashRequestService,
    private snackBar: MatSnackBar,
    private router: Router
  ) {}

  ngOnInit(): void {
    this.currentUser = this.userService.getCurrentUser();
    if (!this.currentUser) {
      this.router.navigate(['/login']);
      return;
    }

    this.departments = this.userService.getDepartments();
    this.selectedDepartment = this.currentUser.department;

    // Initialize bank notes with zero quantities
    this.initializeBankNotes();
  }

  private initializeBankNotes(): void {
    this.bankNotes = this.denominations.map(denom => ({
      denomination: denom.value,
      quantity: 0
    }));
  }

  updateQuantity(denomination: NoteDenomination, quantity: number): void {
    const note = this.bankNotes.find(n => n.denomination === denomination);
    if (note) {
      note.quantity = Math.max(0, quantity);
    }
  }

  getQuantity(denomination: NoteDenomination): number {
    const note = this.bankNotes.find(n => n.denomination === denomination);
    return note ? note.quantity : 0;
  }

  calculateTotal(): number {
    return this.bankNotes.reduce((total, note) => total + (note.denomination * note.quantity), 0);
  }

  getSelectedNotes(): BankNote[] {
    return this.bankNotes.filter(note => note.quantity > 0);
  }

  isFormValid(): boolean {
    return this.selectedDepartment !== '' &&
           this.getSelectedNotes().length > 0 &&
           this.calculateTotal() > 0;
  }

  onSubmit(): void {
    if (!this.isFormValid()) {
      this.snackBar.open('Please fill in all required fields and select at least one denomination.', 'Close', {
        duration: 3000
      });
      return;
    }

    const requestData: Partial<CashRequest> = {
      department: this.selectedDepartment,
      bankNotes: this.getSelectedNotes(),
      dateRequested: this.dateRequested,
      comments: this.comments || undefined
    };

    try {
      const newRequest = this.cashRequestService.createRequest(requestData);

      this.snackBar.open('Cash request submitted successfully!', 'Close', {
        duration: 3000
      });

      this.router.navigate(['/dashboard']);
    } catch (error) {
      this.snackBar.open('Error submitting request. Please try again.', 'Close', {
        duration: 3000
      });
    }
  }

  onCancel(): void {
    this.router.navigate(['/dashboard']);
  }

  goBack(): void {
    this.router.navigate(['/dashboard']);
  }

  formatCurrency(amount: number): string {
    return `R${amount.toLocaleString()}`;
  }
}
