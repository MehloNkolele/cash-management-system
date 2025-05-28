export interface CashInventory {
  id: string;
  noteSeries: NoteSeries;
  denomination: NoteDenomination;
  quantity: number;
  value: number;
  lastUpdated: Date;
  updatedBy: string;
}

export enum NoteSeries {
  MANDELA = 'mandela',
  BIG_5 = 'big_5',
  COMMEMORATIVE = 'commemorative',
  V6 = 'v6'
}

export enum NoteDenomination {
  R10 = 10,
  R20 = 20,
  R50 = 50,
  R100 = 100,
  R200 = 200
}

export interface InventoryTransaction {
  id: string;
  type: TransactionType;
  inventoryId: string;
  quantityChange: number;
  previousQuantity: number;
  newQuantity: number;
  reason: string;
  performedBy: string;
  timestamp: Date;
}

export enum TransactionType {
  ADD = 'add',
  REMOVE = 'remove',
  ADJUST = 'adjust',
  ISSUE = 'issue',
  RETURN = 'return'
}

export interface InventorySummary {
  totalValue: number;
  totalNotes: number;
  seriesBreakdown: SeriesBreakdown[];
  denominationBreakdown: DenominationBreakdown[];
  lowStockAlerts: LowStockAlert[];
}

export interface SeriesBreakdown {
  series: NoteSeries;
  totalValue: number;
  totalNotes: number;
  denominations: DenominationBreakdown[];
}

export interface DenominationBreakdown {
  denomination: NoteDenomination;
  series: NoteSeries;
  quantity: number;
  value: number;
  isLowStock: boolean;
}

export interface LowStockAlert {
  inventoryId: string;
  series: NoteSeries;
  denomination: NoteDenomination;
  currentQuantity: number;
  minimumThreshold: number;
  severity: AlertSeverity;
}

export enum AlertSeverity {
  LOW = 'low',
  MEDIUM = 'medium',
  HIGH = 'high',
  CRITICAL = 'critical'
}

export interface InventorySettings {
  lowStockThresholds: { [key: string]: number };
  autoReorderEnabled: boolean;
  reorderQuantities: { [key: string]: number };
}

export const NOTE_SERIES_LABELS: { [key in NoteSeries]: string } = {
  [NoteSeries.MANDELA]: 'Mandela Series',
  [NoteSeries.BIG_5]: 'Big 5 Series',
  [NoteSeries.COMMEMORATIVE]: 'Commemorative Series',
  [NoteSeries.V6]: 'V6 Series'
};

export const DENOMINATION_LABELS: { [key in NoteDenomination]: string } = {
  [NoteDenomination.R10]: 'R10',
  [NoteDenomination.R20]: 'R20',
  [NoteDenomination.R50]: 'R50',
  [NoteDenomination.R100]: 'R100',
  [NoteDenomination.R200]: 'R200'
};

export const DEFAULT_LOW_STOCK_THRESHOLDS: { [key: string]: number } = {
  '10': 50,   // R10 notes
  '20': 40,   // R20 notes
  '50': 30,   // R50 notes
  '100': 20,  // R100 notes
  '200': 10   // R200 notes
};
