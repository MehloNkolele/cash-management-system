import { Injectable } from '@angular/core';
import { BehaviorSubject, Observable } from 'rxjs';
import {
  CashInventory,
  NoteSeries,
  NoteDenomination,
  InventoryTransaction,
  TransactionType,
  InventorySummary,
  SeriesBreakdown,
  DenominationBreakdown,
  LowStockAlert,
  AlertSeverity,
  InventorySettings,
  DEFAULT_LOW_STOCK_THRESHOLDS,
  NOTE_SERIES_LABELS,
  DENOMINATION_LABELS
} from '../models/inventory.model';
import { LocalStorageService } from './local-storage.service';
import { UserService } from './user.service';
import { SystemLogService } from './system-log.service';
import { BankNote, InventoryAvailability, InventoryStatus, InventoryValidationResult, InventoryPreviewItem, SeriesInventoryAvailability } from '../models/cash-request.model';

@Injectable({
  providedIn: 'root'
})
export class InventoryService {
  private readonly INVENTORY_KEY = 'cash_mgmt_inventory';
  private readonly TRANSACTIONS_KEY = 'cash_mgmt_inventory_transactions';
  private readonly SETTINGS_KEY = 'cash_mgmt_inventory_settings';

  private inventorySubject = new BehaviorSubject<CashInventory[]>([]);
  public inventory$ = this.inventorySubject.asObservable();

  private transactionsSubject = new BehaviorSubject<InventoryTransaction[]>([]);
  public transactions$ = this.transactionsSubject.asObservable();

  constructor(
    private localStorageService: LocalStorageService,
    private userService: UserService,
    private systemLogService: SystemLogService
  ) {
    this.initializeInventory();
    this.loadInventory();
    this.loadTransactions();
  }

  private initializeInventory(): void {
    if (!this.localStorageService.getItem(this.INVENTORY_KEY)) {
      this.createInitialInventory();
    }

    if (!this.localStorageService.getItem(this.SETTINGS_KEY)) {
      this.createDefaultSettings();
    }
  }

  private createInitialInventory(): void {
    const initialInventory: CashInventory[] = [];
    const series = Object.values(NoteSeries);
    const denominations = Object.values(NoteDenomination).filter(d => typeof d === 'number') as NoteDenomination[];

    series.forEach(noteSeries => {
      denominations.forEach(denomination => {
        const quantity = this.getInitialQuantity(noteSeries, denomination);
        initialInventory.push({
          id: this.generateInventoryId(noteSeries, denomination),
          noteSeries,
          denomination,
          quantity,
          value: quantity * denomination,
          lastUpdated: new Date(),
          updatedBy: 'System'
        });
      });
    });

    this.localStorageService.setItem(this.INVENTORY_KEY, initialInventory);
  }

  private createDefaultSettings(): void {
    const defaultSettings: InventorySettings = {
      lowStockThresholds: DEFAULT_LOW_STOCK_THRESHOLDS,
      autoReorderEnabled: false,
      reorderQuantities: {
        '10': 100,
        '20': 80,
        '50': 60,
        '100': 40,
        '200': 20
      }
    };

    this.localStorageService.setItem(this.SETTINGS_KEY, defaultSettings);
  }

  private getInitialQuantity(series: NoteSeries, denomination: NoteDenomination): number {
    // Set initial quantities based on series and denomination as per requirements
    const initialInventoryData: { [key in NoteSeries]: { [key in NoteDenomination]: number } } = {
      [NoteSeries.MANDELA]: {
        [NoteDenomination.R10]: 2087,
        [NoteDenomination.R20]: 3261,
        [NoteDenomination.R50]: 3079,
        [NoteDenomination.R100]: 1560,
        [NoteDenomination.R200]: 2290
      },
      [NoteSeries.BIG_5]: {
        [NoteDenomination.R10]: 0,
        [NoteDenomination.R20]: 1,
        [NoteDenomination.R50]: 0,
        [NoteDenomination.R100]: 1,
        [NoteDenomination.R200]: 1
      },
      [NoteSeries.COMMEMORATIVE]: {
        [NoteDenomination.R10]: 13,
        [NoteDenomination.R20]: 38,
        [NoteDenomination.R50]: 21,
        [NoteDenomination.R100]: 139,
        [NoteDenomination.R200]: 705
      },
      [NoteSeries.V6]: {
        [NoteDenomination.R10]: 250,
        [NoteDenomination.R20]: 250,
        [NoteDenomination.R50]: 150,
        [NoteDenomination.R100]: 50,
        [NoteDenomination.R200]: 22
      }
    };

    return initialInventoryData[series]?.[denomination] || 0;
  }

  private generateInventoryId(series: NoteSeries, denomination: NoteDenomination): string {
    return `inv_${series}_${denomination}`;
  }

  private generateTransactionId(): string {
    return 'txn_' + Date.now() + '_' + Math.random().toString(36).substr(2, 9);
  }

  private loadInventory(): void {
    const inventory = this.getAllInventory();
    this.inventorySubject.next(inventory);
  }

  private loadTransactions(): void {
    const transactions = this.getAllTransactions();
    this.transactionsSubject.next(transactions);
  }

  getAllInventory(): CashInventory[] {
    const inventory = this.localStorageService.getItem<CashInventory[]>(this.INVENTORY_KEY) || [];
    return inventory.map(item => ({
      ...item,
      lastUpdated: new Date(item.lastUpdated)
    }));
  }

  getInventoryById(id: string): CashInventory | null {
    const inventory = this.getAllInventory();
    return inventory.find(item => item.id === id) || null;
  }

  getInventoryBySeries(series: NoteSeries): CashInventory[] {
    return this.getAllInventory().filter(item => item.noteSeries === series);
  }

  getInventoryByDenomination(denomination: NoteDenomination): CashInventory[] {
    return this.getAllInventory().filter(item => item.denomination === denomination);
  }

  getAllTransactions(): InventoryTransaction[] {
    const transactions = this.localStorageService.getItem<InventoryTransaction[]>(this.TRANSACTIONS_KEY) || [];
    return transactions.map(txn => ({
      ...txn,
      timestamp: new Date(txn.timestamp)
    }));
  }

  getSettings(): InventorySettings {
    return this.localStorageService.getItem<InventorySettings>(this.SETTINGS_KEY) || {
      lowStockThresholds: DEFAULT_LOW_STOCK_THRESHOLDS,
      autoReorderEnabled: false,
      reorderQuantities: {}
    };
  }

  updateInventory(id: string, quantityChange: number, reason: string, type: TransactionType = TransactionType.ADJUST): boolean {
    const currentUser = this.userService.getCurrentUser();
    if (!currentUser || !this.userService.hasManagerPrivileges()) {
      throw new Error('Insufficient privileges to update inventory');
    }

    const inventory = this.getAllInventory();
    const itemIndex = inventory.findIndex(item => item.id === id);

    if (itemIndex === -1) {
      return false;
    }

    const item = inventory[itemIndex];
    const previousQuantity = item.quantity;
    const newQuantity = Math.max(0, previousQuantity + quantityChange);

    // Update inventory item
    inventory[itemIndex] = {
      ...item,
      quantity: newQuantity,
      value: newQuantity * item.denomination,
      lastUpdated: new Date(),
      updatedBy: currentUser.fullName
    };

    // Create transaction record
    const transaction: InventoryTransaction = {
      id: this.generateTransactionId(),
      type,
      inventoryId: id,
      quantityChange,
      previousQuantity,
      newQuantity,
      reason,
      performedBy: currentUser.fullName,
      timestamp: new Date()
    };

    // Save changes
    this.saveInventory(inventory);
    this.saveTransaction(transaction);

    // Log the inventory change
    this.systemLogService.logInventoryChange(
      id,
      type,
      quantityChange,
      currentUser.fullName
    );

    return true;
  }

  addCash(series: NoteSeries, denomination: NoteDenomination, quantity: number, reason: string): boolean {
    const id = this.generateInventoryId(series, denomination);
    return this.updateInventory(id, quantity, reason, TransactionType.ADD);
  }

  removeCash(series: NoteSeries, denomination: NoteDenomination, quantity: number, reason: string): boolean {
    const id = this.generateInventoryId(series, denomination);
    return this.updateInventory(id, -quantity, reason, TransactionType.REMOVE);
  }

  getInventorySummary(): InventorySummary {
    const inventory = this.getAllInventory();
    const settings = this.getSettings();

    const totalValue = inventory.reduce((sum, item) => sum + item.value, 0);
    const totalNotes = inventory.reduce((sum, item) => sum + item.quantity, 0);

    // Group by series
    const seriesMap = new Map<NoteSeries, CashInventory[]>();
    inventory.forEach(item => {
      if (!seriesMap.has(item.noteSeries)) {
        seriesMap.set(item.noteSeries, []);
      }
      seriesMap.get(item.noteSeries)!.push(item);
    });

    const seriesBreakdown: SeriesBreakdown[] = Array.from(seriesMap.entries()).map(([series, items]) => ({
      series,
      totalValue: items.reduce((sum, item) => sum + item.value, 0),
      totalNotes: items.reduce((sum, item) => sum + item.quantity, 0),
      denominations: items.map(item => this.createDenominationBreakdown(item, settings))
    }));

    const denominationBreakdown: DenominationBreakdown[] = inventory.map(item =>
      this.createDenominationBreakdown(item, settings)
    );

    const lowStockAlerts: LowStockAlert[] = this.generateLowStockAlerts(inventory, settings);

    return {
      totalValue,
      totalNotes,
      seriesBreakdown,
      denominationBreakdown,
      lowStockAlerts
    };
  }

  private createDenominationBreakdown(item: CashInventory, settings: InventorySettings): DenominationBreakdown {
    const threshold = settings.lowStockThresholds[item.denomination.toString()] || 0;
    return {
      denomination: item.denomination,
      series: item.noteSeries,
      quantity: item.quantity,
      value: item.value,
      isLowStock: item.quantity <= threshold
    };
  }

  private generateLowStockAlerts(inventory: CashInventory[], settings: InventorySettings): LowStockAlert[] {
    const alerts: LowStockAlert[] = [];

    inventory.forEach(item => {
      const threshold = settings.lowStockThresholds[item.denomination.toString()] || 0;
      if (item.quantity <= threshold) {
        let severity: AlertSeverity;
        const ratio = item.quantity / threshold;

        if (ratio <= 0.25) severity = AlertSeverity.CRITICAL;
        else if (ratio <= 0.5) severity = AlertSeverity.HIGH;
        else if (ratio <= 0.75) severity = AlertSeverity.MEDIUM;
        else severity = AlertSeverity.LOW;

        alerts.push({
          inventoryId: item.id,
          series: item.noteSeries,
          denomination: item.denomination,
          currentQuantity: item.quantity,
          minimumThreshold: threshold,
          severity
        });
      }
    });

    return alerts.sort((a, b) => {
      const severityOrder = { critical: 4, high: 3, medium: 2, low: 1 };
      return severityOrder[b.severity] - severityOrder[a.severity];
    });
  }

  private saveInventory(inventory: CashInventory[]): void {
    this.localStorageService.setItem(this.INVENTORY_KEY, inventory);
    this.inventorySubject.next(inventory);
  }

  private saveTransaction(transaction: InventoryTransaction): void {
    const transactions = this.getAllTransactions();
    transactions.push(transaction);
    this.localStorageService.setItem(this.TRANSACTIONS_KEY, transactions);
    this.transactionsSubject.next(transactions);
  }

  updateSettings(settings: InventorySettings): void {
    this.localStorageService.setItem(this.SETTINGS_KEY, settings);
  }

  updateLowStockThreshold(denomination: NoteDenomination, newThreshold: number): boolean {
    const currentUser = this.userService.getCurrentUser();
    if (!currentUser || !this.userService.hasManagerPrivileges()) {
      throw new Error('Insufficient privileges to update thresholds');
    }

    if (newThreshold < 0) {
      throw new Error('Threshold cannot be negative');
    }

    const settings = this.getSettings();
    const oldThreshold = settings.lowStockThresholds[denomination.toString()] || 0;

    settings.lowStockThresholds[denomination.toString()] = newThreshold;
    this.updateSettings(settings);

    // Log the threshold change
    this.systemLogService.logManagerAction(
      'Update Stock Threshold',
      `Updated minimum threshold for R${denomination} from ${oldThreshold} to ${newThreshold}`
    );

    return true;
  }

  getSeriesLabel(series: NoteSeries): string {
    return NOTE_SERIES_LABELS[series];
  }

  getDenominationLabel(denomination: NoteDenomination): string {
    return DENOMINATION_LABELS[denomination];
  }

  // Method to reset inventory to initial values (for testing/demo purposes)
  resetInventoryToInitialValues(): void {
    const currentUser = this.userService.getCurrentUser();
    if (!currentUser || !this.userService.hasManagerPrivileges()) {
      throw new Error('Insufficient privileges to reset inventory');
    }

    // Clear existing inventory and recreate with initial values
    this.localStorageService.removeItem(this.INVENTORY_KEY);
    this.localStorageService.removeItem(this.TRANSACTIONS_KEY);

    this.createInitialInventory();
    this.loadInventory();
    this.loadTransactions();

    // Log the inventory reset
    this.systemLogService.createLog({
      type: 'system_event' as any,
      category: 'inventory_management' as any,
      severity: 'info' as any,
      title: 'Inventory Reset',
      message: `Inventory reset to initial values by ${currentUser.fullName}`,
      userId: currentUser.id,
      userName: currentUser.fullName
    });
  }

  // Method to get detailed inventory breakdown for management view
  getDetailedInventoryBreakdown(): { [key in NoteSeries]: CashInventory[] } {
    const inventory = this.getAllInventory();
    const breakdown: { [key in NoteSeries]: CashInventory[] } = {
      [NoteSeries.MANDELA]: [],
      [NoteSeries.BIG_5]: [],
      [NoteSeries.COMMEMORATIVE]: [],
      [NoteSeries.V6]: []
    };

    inventory.forEach(item => {
      breakdown[item.noteSeries].push(item);
    });

    // Sort each series by denomination
    Object.keys(breakdown).forEach(series => {
      breakdown[series as NoteSeries].sort((a, b) => a.denomination - b.denomination);
    });

    return breakdown;
  }

  // Role-based inventory availability for requesters (basic status only)
  getInventoryAvailabilityForRequesters(): InventoryAvailability[] {
    const inventory = this.getAllInventory();
    const settings = this.getSettings();
    const denominationMap = new Map<NoteDenomination, number>();

    // Aggregate quantities across all series for each denomination
    inventory.forEach(item => {
      const current = denominationMap.get(item.denomination) || 0;
      denominationMap.set(item.denomination, current + item.quantity);
    });

    return Object.values(NoteDenomination)
      .filter(d => typeof d === 'number')
      .map(denomination => {
        const totalQuantity = denominationMap.get(denomination as NoteDenomination) || 0;
        const threshold = settings.lowStockThresholds[denomination.toString()] || 0;

        let status: InventoryStatus;
        if (totalQuantity === 0) {
          status = InventoryStatus.OUT_OF_STOCK;
        } else if (totalQuantity <= threshold) {
          status = InventoryStatus.LOW_STOCK;
        } else {
          status = InventoryStatus.AVAILABLE;
        }

        return {
          denomination: denomination as NoteDenomination,
          status
        };
      });
  }

  // Role-based inventory availability for approvers (detailed quantities)
  getInventoryAvailabilityForApprovers(): InventoryAvailability[] {
    const inventory = this.getAllInventory();
    const settings = this.getSettings();
    const denominationMap = new Map<NoteDenomination, number>();

    // Aggregate quantities across all series for each denomination
    inventory.forEach(item => {
      const current = denominationMap.get(item.denomination) || 0;
      denominationMap.set(item.denomination, current + item.quantity);
    });

    return Object.values(NoteDenomination)
      .filter(d => typeof d === 'number')
      .map(denomination => {
        const totalQuantity = denominationMap.get(denomination as NoteDenomination) || 0;
        const threshold = settings.lowStockThresholds[denomination.toString()] || 0;

        let status: InventoryStatus;
        if (totalQuantity === 0) {
          status = InventoryStatus.OUT_OF_STOCK;
        } else if (totalQuantity <= threshold) {
          status = InventoryStatus.LOW_STOCK;
        } else {
          status = InventoryStatus.AVAILABLE;
        }

        return {
          denomination: denomination as NoteDenomination,
          status,
          totalAvailable: totalQuantity
        };
      });
  }

  // Validate if a cash request can be fulfilled with current inventory
  validateCashRequest(bankNotes: BankNote[]): InventoryValidationResult {
    const inventory = this.getAllInventory();
    const errors: string[] = [];
    const warnings: string[] = [];
    const inventoryPreview: InventoryPreviewItem[] = [];

    // Aggregate current inventory by denomination
    const denominationMap = new Map<NoteDenomination, { total: number, series: CashInventory[] }>();
    inventory.forEach(item => {
      if (!denominationMap.has(item.denomination)) {
        denominationMap.set(item.denomination, { total: 0, series: [] });
      }
      const current = denominationMap.get(item.denomination)!;
      current.total += item.quantity;
      current.series.push(item);
    });

    // Check each requested denomination
    bankNotes.forEach(note => {
      const available = denominationMap.get(note.denomination);
      const totalAvailable = available?.total || 0;

      if (note.quantity > totalAvailable) {
        errors.push(`Insufficient ${DENOMINATION_LABELS[note.denomination]} notes. Requested: ${note.quantity}, Available: ${totalAvailable}`);
      } else if (note.quantity > totalAvailable * 0.8) {
        warnings.push(`High usage of ${DENOMINATION_LABELS[note.denomination]} notes. This will significantly reduce available stock.`);
      }

      // Create preview for each series that has this denomination
      if (available) {
        available.series.forEach(item => {
          if (item.quantity > 0) {
            const allocatedFromThisSeries = Math.min(note.quantity, item.quantity);
            inventoryPreview.push({
              denomination: note.denomination,
              currentQuantity: item.quantity,
              requestedQuantity: allocatedFromThisSeries,
              remainingAfterApproval: item.quantity - allocatedFromThisSeries,
              series: NOTE_SERIES_LABELS[item.noteSeries]
            });
          }
        });
      }
    });

    return {
      isValid: errors.length === 0,
      errors,
      warnings,
      inventoryPreview
    };
  }

  // Process cash request approval and update inventory
  processCashRequestApproval(bankNotes: BankNote[], requestId: string, approvedBy: string): boolean {
    const currentUser = this.userService.getCurrentUser();
    if (!currentUser || (!this.userService.hasManagerPrivileges() && currentUser.role !== 'issuer')) {
      throw new Error('Insufficient privileges to process cash request');
    }

    const validation = this.validateCashRequest(bankNotes);
    if (!validation.isValid) {
      throw new Error(`Cannot approve request: ${validation.errors.join(', ')}`);
    }

    const inventory = this.getAllInventory();
    const transactions: InventoryTransaction[] = [];

    // Deduct requested amounts from inventory (FIFO approach - use oldest stock first)
    bankNotes.forEach(note => {
      let remainingToDeduct = note.quantity;

      // Sort inventory items by denomination and then by series priority
      const availableItems = inventory
        .filter(item => item.denomination === note.denomination && item.quantity > 0)
        .sort((a, b) => {
          // Priority order: Mandela, V6, Commemorative, Big 5
          const seriesPriority = {
            [NoteSeries.MANDELA]: 1,
            [NoteSeries.V6]: 2,
            [NoteSeries.COMMEMORATIVE]: 3,
            [NoteSeries.BIG_5]: 4
          };
          return seriesPriority[a.noteSeries] - seriesPriority[b.noteSeries];
        });

      availableItems.forEach(item => {
        if (remainingToDeduct > 0) {
          const deductFromThisItem = Math.min(remainingToDeduct, item.quantity);

          // Update inventory item
          item.quantity -= deductFromThisItem;
          item.value = item.quantity * item.denomination;
          item.lastUpdated = new Date();
          item.updatedBy = approvedBy;

          // Create transaction record
          transactions.push({
            id: this.generateTransactionId(),
            type: TransactionType.REMOVE,
            inventoryId: item.id,
            quantityChange: -deductFromThisItem,
            previousQuantity: item.quantity + deductFromThisItem,
            newQuantity: item.quantity,
            reason: `Cash request approval - Request ID: ${requestId}`,
            performedBy: approvedBy,
            timestamp: new Date()
          });

          remainingToDeduct -= deductFromThisItem;
        }
      });
    });

    // Save updated inventory and transactions
    this.saveInventory(inventory);
    transactions.forEach(transaction => this.saveTransaction(transaction));

    // Log the inventory changes
    this.systemLogService.createLog({
      type: 'inventory_change' as any,
      category: 'cash_request' as any,
      severity: 'info' as any,
      title: 'Inventory Updated - Cash Request Approved',
      message: `Inventory updated for approved cash request ${requestId} by ${approvedBy}`,
      userId: currentUser.id,
      userName: currentUser.fullName,
      metadata: { requestId, bankNotes, approvedBy }
    });

    return true;
  }

  // Get total available quantity for a specific denomination across all series
  getAvailableQuantity(denomination: NoteDenomination): number {
    const inventory = this.getAllInventory();
    return inventory
      .filter(item => item.denomination === denomination)
      .reduce((sum, item) => sum + item.quantity, 0);
  }

  // Get series-specific inventory availability for smart requesting
  getSeriesInventoryAvailability(denomination: NoteDenomination): SeriesInventoryAvailability[] {
    const inventory = this.getAllInventory();
    const settings = this.getSettings();

    return Object.values(NoteSeries).map(series => {
      const item = inventory.find(inv =>
        inv.denomination === denomination && inv.noteSeries === series
      );

      const quantity = item ? item.quantity : 0;
      const threshold = settings.lowStockThresholds[denomination.toString()] || 0;

      let status: InventoryStatus;
      if (quantity === 0) {
        status = InventoryStatus.OUT_OF_STOCK;
      } else if (quantity <= threshold) {
        status = InventoryStatus.LOW_STOCK;
      } else {
        status = InventoryStatus.AVAILABLE;
      }

      // Determine if this series is recommended (highest availability for this denomination)
      const allSeriesForDenom = inventory.filter(inv => inv.denomination === denomination);
      const maxQuantity = Math.max(...allSeriesForDenom.map(inv => inv.quantity));
      const isRecommended = quantity === maxQuantity && quantity > 0;

      return {
        denomination,
        series,
        status,
        available: quantity,
        isRecommended
      };
    }).sort((a, b) => {
      // Sort by recommended first, then by availability
      if (a.isRecommended && !b.isRecommended) return -1;
      if (!a.isRecommended && b.isRecommended) return 1;
      return b.available - a.available;
    });
  }

  // Get all series availability for all denominations
  getAllSeriesInventoryAvailability(): { [key in NoteDenomination]: SeriesInventoryAvailability[] } {
    const result = {} as { [key in NoteDenomination]: SeriesInventoryAvailability[] };

    Object.values(NoteDenomination).forEach(denomination => {
      if (typeof denomination === 'number') {
        result[denomination as NoteDenomination] = this.getSeriesInventoryAvailability(denomination as NoteDenomination);
      }
    });

    return result;
  }

  // Check if a specific series and denomination combination is available
  isSeriesAvailable(denomination: NoteDenomination, series: NoteSeries, requestedQuantity: number = 1): boolean {
    const inventory = this.getAllInventory();
    const item = inventory.find(inv =>
      inv.denomination === denomination && inv.noteSeries === series
    );

    return item ? item.quantity >= requestedQuantity : false;
  }

  // Get available quantity for a specific series and denomination
  getSeriesAvailableQuantity(denomination: NoteDenomination, series: NoteSeries): number {
    const inventory = this.getAllInventory();
    const item = inventory.find(inv =>
      inv.denomination === denomination && inv.noteSeries === series
    );

    return item ? item.quantity : 0;
  }

  // Return reserved cash back to inventory (for auto-cancellation)
  returnReservedCash(bankNotes: BankNote[], requestId: string, returnedBy: string = 'SYSTEM'): boolean {
    try {
      const inventory = this.getAllInventory();
      const transactions: InventoryTransaction[] = [];

      // Add each bank note back to inventory (prioritize Mandela series for returns)
      bankNotes.forEach(note => {
        // Find the best series to return to (prefer Mandela series)
        const targetItem = inventory.find(item =>
          item.denomination === note.denomination &&
          item.noteSeries === NoteSeries.MANDELA
        ) || inventory.find(item =>
          item.denomination === note.denomination
        );

        if (targetItem) {
          const previousQuantity = targetItem.quantity;
          targetItem.quantity += note.quantity;
          targetItem.value = targetItem.quantity * targetItem.denomination;
          targetItem.lastUpdated = new Date();
          targetItem.updatedBy = returnedBy;

          // Create transaction record
          transactions.push({
            id: this.generateTransactionId(),
            type: TransactionType.ADD,
            inventoryId: targetItem.id,
            quantityChange: note.quantity,
            previousQuantity,
            newQuantity: targetItem.quantity,
            reason: `Auto-cancellation return - Request ID: ${requestId}`,
            performedBy: returnedBy,
            timestamp: new Date()
          });
        }
      });

      // Save updated inventory and transactions
      this.saveInventory(inventory);
      transactions.forEach(transaction => this.saveTransaction(transaction));

      // Log the inventory return
      this.systemLogService.createLog({
        type: 'inventory_change' as any,
        category: 'cash_request' as any,
        severity: 'info' as any,
        title: 'Inventory Returned - Auto-Cancellation',
        message: `Reserved cash returned to inventory for auto-cancelled request ${requestId}`,
        metadata: { requestId, bankNotes, returnedBy, autoCancellation: true }
      });

      return true;
    } catch (error) {
      console.error('Error returning reserved cash to inventory:', error);
      return false;
    }
  }
}
