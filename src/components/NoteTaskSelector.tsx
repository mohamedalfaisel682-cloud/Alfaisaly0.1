import React from 'react';
import { NoteEntitySelector } from './NoteEntitySelector';
import { Task, Customer, InventoryItem, CashAccount, DebtAccount } from '../types';

interface NoteTaskSelectorProps {
  tasks: Task[];
  selectedTaskId: string;
  onSelectTask: (taskId: string) => void;
  customers?: Customer[];
  inventory?: InventoryItem[];
  cashAccounts?: CashAccount[];
  debtAccounts?: DebtAccount[];
  selectedCustomerId?: string;
  onSelectCustomer?: (customerId: string) => void;
  selectedInventoryId?: string;
  onSelectInventory?: (inventoryId: string) => void;
  selectedAccountId?: string;
  onSelectAccount?: (accountId: string) => void;
  className?: string;
}

export const NoteTaskSelector: React.FC<NoteTaskSelectorProps> = (props) => {
  return (
    <NoteEntitySelector
      tasks={props.tasks || []}
      customers={props.customers || []}
      inventory={props.inventory || []}
      cashAccounts={props.cashAccounts || []}
      debtAccounts={props.debtAccounts || []}
      selectedTaskId={props.selectedTaskId}
      onSelectTask={props.onSelectTask}
      selectedCustomerId={props.selectedCustomerId}
      onSelectCustomer={props.onSelectCustomer}
      selectedInventoryId={props.selectedInventoryId}
      onSelectInventory={props.onSelectInventory}
      selectedAccountId={props.selectedAccountId}
      onSelectAccount={props.onSelectAccount}
      className={props.className}
    />
  );
};


export default NoteTaskSelector;
