import { Component, OnInit } from '@angular/core';
import { CommonModule } from '@angular/common';
import { FormsModule } from '@angular/forms';
import { Router } from '@angular/router';
import { trigger, transition, style, animate } from '@angular/animations';
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
import { MatSlideToggleModule } from '@angular/material/slide-toggle';
import { MatChipsModule } from '@angular/material/chips';
import { MatRadioModule } from '@angular/material/radio';

import { User, Department } from '../../models/user.model';
import { BankNote, NoteDenomination, CashRequest, InventoryAvailability, InventoryStatus, SeriesInventoryAvailability } from '../../models/cash-request.model';
import { NoteSeries, NOTE_SERIES_LABELS } from '../../models/inventory.model';
import { UserService } from '../../services/user.service';
import { CashRequestService } from '../../services/cash-request.service';
import { InventoryService } from '../../services/inventory.service';

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
    MatDividerModule,
    MatSlideToggleModule,
    MatChipsModule,
    MatRadioModule
  ],
  templateUrl: './cash-request-form.component.html',
  styleUrl: './cash-request-form.component.scss',
  animations: [
    trigger('slideIn', [
      transition(':enter', [
        style({ transform: 'translateX(100%)', opacity: 0 }),
        animate('300ms ease-in', style({ transform: 'translateX(0%)', opacity: 1 }))
      ]),
      transition(':leave', [
        animate('300ms ease-out', style({ transform: 'translateX(-100%)', opacity: 0 }))
      ])
    ]),
    trigger('fadeInOut', [
      transition(':enter', [
        style({ opacity: 0, transform: 'translateY(-10px)' }),
        animate('250ms ease-in', style({ opacity: 1, transform: 'translateY(0)' }))
      ]),
      transition(':leave', [
        animate('200ms ease-out', style({ opacity: 0, transform: 'translateY(-10px)' }))
      ])
    ])
  ]
})
export class CashRequestFormComponent implements OnInit {
  currentUser: User | null = null;
  departments: Department[] = [];

  // Wizard state
  currentStep: number = 1;
  totalSteps: number = 3;

  // Form data
  selectedDepartment: string = '';
  dateRequested: Date = new Date();
  bankNotes: BankNote[] = [];
  coinsRequested: boolean = false;
  dyePackRequired: boolean = false;
  comments: string = '';

  // Batch configuration
  readonly NOTES_PER_BATCH = 100;
  batchCounts: { [key in NoteDenomination]: number } = {} as any;

  // Inventory availability
  inventoryAvailability: InventoryAvailability[] = [];
  seriesInventoryAvailability: { [key in NoteDenomination]: SeriesInventoryAvailability[] } = {} as any;
  InventoryStatus = InventoryStatus;
  NoteSeries = NoteSeries;
  NOTE_SERIES_LABELS = NOTE_SERIES_LABELS;

  // Smart requesting features
  smartMode: boolean = true; // Enable smart series selection by default
  showSeriesSelection: { [key: number]: boolean } = {};
  selectedSeries: { [key: number]: NoteSeries | null } = {};

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
    private inventoryService: InventoryService,
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
    // Don't auto-populate department - require explicit selection
    this.selectedDepartment = '';

    // Initialize bank notes with zero quantities
    this.initializeBankNotes();

    // Load inventory availability for requesters
    this.loadInventoryAvailability();
  }

  private initializeBankNotes(): void {
    this.bankNotes = this.denominations.map(denom => ({
      denomination: denom.value,
      quantity: 0
    }));

    // Initialize batch counts
    this.denominations.forEach(denom => {
      this.batchCounts[denom.value] = 0;
    });
  }

  getQuantity(denomination: NoteDenomination): number {
    const note = this.bankNotes.find(n => n.denomination === denomination);
    return note ? note.quantity : 0;
  }

  getBatchCount(denomination: NoteDenomination): number {
    return this.batchCounts[denomination] || 0;
  }

  incrementBatch(denomination: NoteDenomination): void {
    this.batchCounts[denomination] = (this.batchCounts[denomination] || 0) + 1;
    this.updateQuantityFromBatch(denomination);
  }

  decrementBatch(denomination: NoteDenomination): void {
    if (this.batchCounts[denomination] > 0) {
      this.batchCounts[denomination]--;
      this.updateQuantityFromBatch(denomination);
    }
  }

  updateBatchCount(denomination: NoteDenomination, batchCount: number): void {
    this.batchCounts[denomination] = Math.max(0, batchCount);
    this.updateQuantityFromBatch(denomination);
  }

  private updateQuantityFromBatch(denomination: NoteDenomination): void {
    const quantity = this.batchCounts[denomination] * this.NOTES_PER_BATCH;
    this.updateQuantity(denomination, quantity);
  }

  calculateTotal(): number {
    return this.bankNotes.reduce((total, note) => total + (note.denomination * note.quantity), 0);
  }

  onCoinsToggleChange(checked: boolean): void {
    this.coinsRequested = checked;
  }

  onDyePackToggleChange(checked: boolean): void {
    this.dyePackRequired = checked;
  }

  private loadInventoryAvailability(): void {
    this.inventoryAvailability = this.inventoryService.getInventoryAvailabilityForRequesters();
    this.seriesInventoryAvailability = this.inventoryService.getAllSeriesInventoryAvailability();

    // Initialize series selection with recommended series
    this.denominations.forEach(denom => {
      const seriesOptions = this.seriesInventoryAvailability[denom.value];
      if (seriesOptions && seriesOptions.length > 0) {
        const recommended = seriesOptions.find(s => s.isRecommended);
        this.selectedSeries[denom.value] = recommended ? recommended.series : seriesOptions[0].series;
      }
    });
  }

  getInventoryStatus(denomination: NoteDenomination): InventoryStatus {
    const availability = this.inventoryAvailability.find(item => item.denomination === denomination);
    return availability?.status || InventoryStatus.AVAILABLE;
  }

  getInventoryStatusClass(status: InventoryStatus): string {
    switch (status) {
      case InventoryStatus.AVAILABLE:
        return 'status-available';
      case InventoryStatus.LOW_STOCK:
        return 'status-low-stock';
      case InventoryStatus.OUT_OF_STOCK:
        return 'status-out-of-stock';
      default:
        return 'status-available';
    }
  }

  getInventoryStatusLabel(status: InventoryStatus): string {
    switch (status) {
      case InventoryStatus.AVAILABLE:
        return 'Available';
      case InventoryStatus.LOW_STOCK:
        return 'Low Stock';
      case InventoryStatus.OUT_OF_STOCK:
        return 'Out of Stock';
      default:
        return 'Available';
    }
  }

  isFormValid(): boolean {
    return this.selectedDepartment !== '' &&
           (this.getSelectedNotes().length > 0 || this.coinsRequested) &&
           !this.hasInventoryExceeded();
  }

  // Check if any requested amounts exceed available inventory
  hasInventoryExceeded(): boolean {
    return this.getSelectedNotes().some(note => {
      if (note.series) {
        const available = this.inventoryService.getSeriesAvailableQuantity(note.denomination, note.series);
        return note.quantity > available;
      } else {
        const totalAvailable = this.inventoryService.getAvailableQuantity(note.denomination);
        return note.quantity > totalAvailable;
      }
    });
  }

  onSubmit(): void {
    console.log('Submit button clicked!');
    console.log('Form valid:', this.isFormValid());
    console.log('Selected department:', this.selectedDepartment);
    console.log('Selected notes:', this.getSelectedNotes());
    console.log('Coins requested:', this.coinsRequested);
    console.log('Dye pack required:', this.dyePackRequired);

    if (!this.isFormValid()) {
      this.snackBar.open('Please fill in all required fields and select at least one denomination or coins.', 'Close', {
        duration: 3000
      });
      return;
    }

    const requestData: Partial<CashRequest> = {
      department: this.selectedDepartment,
      bankNotes: this.getSelectedNotes(),
      coinsRequested: this.coinsRequested || undefined,
      dyePackRequired: this.dyePackRequired || undefined,
      dateRequested: this.dateRequested,
      comments: this.comments || undefined
    };

    console.log('Request data:', requestData);

    try {
      const newRequest = this.cashRequestService.createRequest(requestData);
      console.log('Request created successfully:', newRequest);

      this.snackBar.open('Cash request submitted successfully!', 'Close', {
        duration: 3000
      });

      this.router.navigate(['/dashboard']);
    } catch (error) {
      console.error('Error submitting request:', error);
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

  // Smart requesting methods
  toggleSeriesSelection(denomination: NoteDenomination): void {
    this.showSeriesSelection[denomination] = !this.showSeriesSelection[denomination];
  }

  onSeriesChange(denomination: NoteDenomination, series: NoteSeries): void {
    this.selectedSeries[denomination] = series;
    this.validateSeriesAvailability(denomination);
  }

  onSeriesSelectChange(denomination: NoteDenomination, series: NoteSeries): void {
    this.selectedSeries[denomination] = series;
    this.validateSeriesAvailability(denomination);
  }

  validateSeriesAvailability(denomination: NoteDenomination): void {
    const quantity = this.getQuantity(denomination);
    const selectedSeries = this.selectedSeries[denomination];

    if (quantity > 0 && selectedSeries) {
      const available = this.inventoryService.getSeriesAvailableQuantity(denomination, selectedSeries);

      if (quantity > available) {
        this.snackBar.open(
          `Warning: Only ${available} x R${denomination} available in ${NOTE_SERIES_LABELS[selectedSeries as keyof typeof NOTE_SERIES_LABELS]}`,
          'Close',
          { duration: 5000 }
        );
      }
    }
  }

  getSeriesOptions(denomination: NoteDenomination): SeriesInventoryAvailability[] {
    return this.seriesInventoryAvailability[denomination] || [];
  }

  getSelectedSeriesLabel(denomination: NoteDenomination): string {
    const selectedSeries = this.selectedSeries[denomination];
    return selectedSeries ? NOTE_SERIES_LABELS[selectedSeries as keyof typeof NOTE_SERIES_LABELS] : 'Auto-select';
  }

  getSeriesLabel(series: NoteSeries): string {
    return NOTE_SERIES_LABELS[series as keyof typeof NOTE_SERIES_LABELS];
  }

  getSeriesStatusClass(seriesAvailability: SeriesInventoryAvailability): string {
    switch (seriesAvailability.status) {
      case InventoryStatus.AVAILABLE:
        return 'series-available';
      case InventoryStatus.LOW_STOCK:
        return 'series-low-stock';
      case InventoryStatus.OUT_OF_STOCK:
        return 'series-out-of-stock';
      default:
        return '';
    }
  }

  getSeriesStatusIcon(seriesAvailability: SeriesInventoryAvailability): string {
    switch (seriesAvailability.status) {
      case InventoryStatus.AVAILABLE:
        return 'check_circle';
      case InventoryStatus.LOW_STOCK:
        return 'warning';
      case InventoryStatus.OUT_OF_STOCK:
        return 'error';
      default:
        return 'help';
    }
  }

  isSeriesRecommended(seriesAvailability: SeriesInventoryAvailability): boolean {
    return seriesAvailability.isRecommended || false;
  }

  trackBySeries(index: number, item: SeriesInventoryAvailability): string {
    return `${item.denomination}_${item.series}`;
  }

  // Convert individual notes to batches (1 batch = 100 notes)
  getAvailableBatches(availableNotes: number): number {
    return Math.floor(availableNotes / 100);
  }

  onSmartModeToggle(enabled: boolean): void {
    // Immediate state update for responsive UI
    this.smartMode = enabled;

    // Use setTimeout to ensure smooth UI transition
    setTimeout(() => {
      if (enabled) {
        // Auto-select recommended series
        this.loadInventoryAvailability();
      } else {
        // Clear series selections and close any open dropdowns
        this.selectedSeries = {};
        this.showSeriesSelection = {};
      }
    }, 0);
  }

  // Override the updateQuantity method to include series validation
  updateQuantity(denomination: NoteDenomination, quantity: number): void {
    const note = this.bankNotes.find(n => n.denomination === denomination);
    if (note) {
      note.quantity = Math.max(0, quantity);

      // Add series information if smart mode is enabled
      if (this.smartMode && this.selectedSeries[denomination]) {
        note.series = this.selectedSeries[denomination] || undefined;
      }

      // Validate availability in real-time
      if (quantity > 0) {
        this.validateSeriesAvailability(denomination);
      }
    }
  }

  // Override getSelectedNotes to include series information
  getSelectedNotes(): BankNote[] {
    return this.bankNotes.filter(note => note.quantity > 0).map(note => ({
      ...note,
      series: this.smartMode && this.selectedSeries[note.denomination] ? this.selectedSeries[note.denomination] || undefined : undefined
    }));
  }

  // Get real-time availability warnings
  getAvailabilityWarnings(): string[] {
    const warnings: string[] = [];

    this.getSelectedNotes().forEach(note => {
      if (note.series) {
        const available = this.inventoryService.getSeriesAvailableQuantity(note.denomination, note.series);
        if (note.quantity > available) {
          const batchesRequested = Math.ceil(note.quantity / 100);
          const batchesAvailable = Math.floor(available / 100);
          warnings.push(`R${note.denomination}: Requested ${batchesRequested} batch${batchesRequested !== 1 ? 'es' : ''} (${note.quantity} notes), only ${batchesAvailable} batch${batchesAvailable !== 1 ? 'es' : ''} (${available} notes) available in ${NOTE_SERIES_LABELS[note.series as keyof typeof NOTE_SERIES_LABELS]}. Please reduce your request to proceed.`);
        }
      } else {
        const totalAvailable = this.inventoryService.getAvailableQuantity(note.denomination);
        if (note.quantity > totalAvailable) {
          const batchesRequested = Math.ceil(note.quantity / 100);
          const batchesAvailable = Math.floor(totalAvailable / 100);
          warnings.push(`R${note.denomination}: Requested ${batchesRequested} batch${batchesRequested !== 1 ? 'es' : ''} (${note.quantity} notes), only ${batchesAvailable} batch${batchesAvailable !== 1 ? 'es' : ''} (${totalAvailable} notes) available across all series. Please reduce your request to proceed.`);
        }
      }
    });

    return warnings;
  }

  hasAvailabilityWarnings(): boolean {
    return this.getAvailabilityWarnings().length > 0;
  }

  // Wizard navigation methods
  nextStep(): void {
    if (this.currentStep < this.totalSteps && this.isStepValid(this.currentStep)) {
      this.currentStep++;
    } else {
      // Show validation error message
      this.showStepValidationError(this.currentStep);
    }
  }

  private showStepValidationError(step: number): void {
    let errorMessage = '';

    switch (step) {
      case 1:
        if (this.selectedDepartment === '') {
          errorMessage = 'Please select your department before proceeding.';
        }
        break;
      case 2:
        if (this.getSelectedNotes().length === 0 && !this.coinsRequested) {
          errorMessage = 'Please select at least one denomination or request coins before proceeding.';
        }
        break;
      default:
        errorMessage = 'Please complete all required fields before proceeding.';
    }

    if (errorMessage) {
      this.snackBar.open(errorMessage, 'Close', {
        duration: 4000,
        panelClass: ['error-snackbar']
      });
    }
  }

  previousStep(): void {
    if (this.currentStep > 1) {
      this.currentStep--;
    }
  }

  isStepValid(step: number): boolean {
    switch (step) {
      case 1:
        // Step 1: Requester information
        return this.selectedDepartment !== '';
      case 2:
        // Step 2: Cash selection
        return this.getSelectedNotes().length > 0 || this.coinsRequested;
      case 3:
        // Step 3: Review (always valid if we reach here)
        return true;
      default:
        return false;
    }
  }

  goToStep(step: number): void {
    if (step >= 1 && step <= this.totalSteps) {
      // Validate all previous steps
      let canProceed = true;
      for (let i = 1; i < step; i++) {
        if (!this.isStepValid(i)) {
          canProceed = false;
          break;
        }
      }

      if (canProceed) {
        this.currentStep = step;
      } else {
        this.snackBar.open('Please complete all previous steps before proceeding.', 'Close', {
          duration: 3000
        });
      }
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
}
