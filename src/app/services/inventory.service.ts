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
        const quantity = this.getInitialQuantity(denomination);
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

  private getInitialQuantity(denomination: NoteDenomination): number {
    // Set initial quantities based on denomination
    switch (denomination) {
      case NoteDenomination.R10: return 100;
      case NoteDenomination.R20: return 80;
      case NoteDenomination.R50: return 60;
      case NoteDenomination.R100: return 40;
      case NoteDenomination.R200: return 20;
      default: return 50;
    }
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

  getSeriesLabel(series: NoteSeries): string {
    return NOTE_SERIES_LABELS[series];
  }

  getDenominationLabel(denomination: NoteDenomination): string {
    return DENOMINATION_LABELS[denomination];
  }
}
