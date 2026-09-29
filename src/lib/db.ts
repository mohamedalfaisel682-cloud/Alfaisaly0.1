import Dexie, { type Table } from 'dexie';
import { Task, Customer, InventoryItem, Transaction, DeviceModel, User, AuditLogRecord, ReportSchedule, CashAccount, DebtAccount } from '../types';

export class FaisaliDatabase extends Dexie {
  notes!: Table<any, string>;
  tasks!: Table<Task>;
  customers!: Table<Customer>;
  inventory!: Table<InventoryItem>;
  transactions!: Table<Transaction>;
  settings!: Table<{ key: string; value: any }>;
  deviceModels!: Table<DeviceModel>;
  deviceTypes!: Table<{ id?: number; name: string }>;
  taskStatuses!: Table<{ id?: number; name: string }>;
  taskCosts!: Table<{ id?: number; name: string }>;
  customerClassifications!: Table<{ id?: number; name: string }>;
  storageLocations!: Table<{ id?: number; name: string }>;
  users!: Table<User>;
  auditLogs!: Table<AuditLogRecord>;
  reportSchedules!: Table<ReportSchedule>;
  cashAccounts!: Table<CashAccount>;
  debtAccounts!: Table<DebtAccount>;
  voiceChats!: Table<any, string>;

  constructor() {
    super('FaisaliDB');
    this.version(9).stores({
      tasks: '++id, customer, status, createdAt',
      customers: '++id, name, phone, classification',
      inventory: '++id, name, code, category',
      transactions: '++id, type, date, customerName, taskId',
      settings: 'key',
      deviceModels: '++id, type, [type+name], name',
      deviceTypes: '++id, name',
      taskStatuses: '++id, name',
      taskCosts: '++id, name',
      customerClassifications: '++id, name',
      storageLocations: '++id, name',
      users: '++id, username, pin'
    });
    this.version(10).stores({
      tasks: '++id, customer, status, createdAt',
      customers: '++id, name, phone, classification',
      inventory: '++id, name, code, category',
      transactions: '++id, type, date, customerName, taskId',
      settings: 'key',
      deviceModels: '++id, type, [type+name], name',
      deviceTypes: '++id, name',
      taskStatuses: '++id, name',
      taskCosts: '++id, name',
      customerClassifications: '++id, name',
      storageLocations: '++id, name',
      users: '++id, username, pin',
      auditLogs: '++id, timestamp, entityType, actionType'
    });
    this.version(11).stores({
      tasks: '++id, customer, status, createdAt',
      customers: '++id, name, phone, classification',
      inventory: '++id, name, code, category',
      transactions: '++id, type, date, customerName, taskId',
      settings: 'key',
      deviceModels: '++id, type, [type+name], name',
      deviceTypes: '++id, name',
      taskStatuses: '++id, name',
      taskCosts: '++id, name',
      customerClassifications: '++id, name',
      storageLocations: '++id, name',
      users: '++id, username, pin',
      auditLogs: '++id, timestamp, entityType, actionType',
      reportSchedules: '++id, type, frequency, deliveryMethod, nextRun'
    });
    this.version(12).stores({
      tasks: '++id, customer, status, createdAt',
      customers: '++id, name, phone, classification',
      inventory: '++id, name, code, category',
      transactions: '++id, type, date, customerName, taskId',
      settings: 'key',
      deviceModels: '++id, type, [type+name], name',
      deviceTypes: '++id, name',
      taskStatuses: '++id, name',
      taskCosts: '++id, name',
      customerClassifications: '++id, name',
      storageLocations: '++id, name',
      users: '++id, username, pin',
      auditLogs: '++id, timestamp, entityType, actionType, user',
      reportSchedules: '++id, type, frequency, deliveryMethod, nextRun'
    });
    this.version(13).stores({
      tasks: '++id, customer, status, createdAt',
      customers: '++id, name, phone, classification',
      inventory: '++id, name, code, category',
      transactions: '++id, type, date, customerName, taskId, debtAccountId',
      settings: 'key',
      deviceModels: '++id, type, [type+name], name',
      deviceTypes: '++id, name',
      taskStatuses: '++id, name',
      taskCosts: '++id, name',
      customerClassifications: '++id, name',
      storageLocations: '++id, name',
      users: '++id, username, pin',
      auditLogs: '++id, timestamp, entityType, actionType, user',
      reportSchedules: '++id, type, frequency, deliveryMethod, nextRun',
      cashAccounts: '++id, name, type, currency',
      debtAccounts: '++id, name, creditorName, status, purpose, currency'
    });
    this.version(14).stores({
      tasks: '++id, customer, status, createdAt, technician, category'
    });
    this.version(15).stores({
      voiceChats: 'id, timestamp, role, text'
    });
  }
}

export const db = new FaisaliDatabase();
