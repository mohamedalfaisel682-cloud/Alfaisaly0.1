import { db } from './db';
import { Transaction, CashAccount, Currency, ExchangeRates } from '../types';
import { convertCurrency } from './utils';

/**
 * Finds the appropriate cash account for a transaction
 */
export async function getTargetCashAccount(
  trans: Partial<Transaction>
): Promise<CashAccount | null> {
  const accounts = await db.cashAccounts.toArray();
  if (!accounts || accounts.length === 0) {
    // Initialize default if empty
    const id = await db.cashAccounts.add({
      name: 'الصندوق الرئيسي (النقد اليومي)',
      type: 'cashbox',
      balance: 0,
      currency: (trans.currency as Currency) || 'RY',
      isDefault: true,
      createdAt: new Date().toISOString(),
      notes: 'صندوق النقدية اليومية والمقبوضات المباشرة'
    });
    return (await db.cashAccounts.get(id)) || null;
  }

  // 1. By explicit cashAccountId
  if (trans.cashAccountId) {
    const acc = accounts.find(a => a.id === trans.cashAccountId);
    if (acc) return acc;
  }

  // 2. By sourceAccount or destinationAccount name/type
  if (trans.sourceAccount) {
    const sName = trans.sourceAccount.trim().toLowerCase();
    const acc = accounts.find(a => 
      a.name.trim().toLowerCase() === sName || 
      a.type === sName ||
      (sName.includes('خزن') && a.type === 'vault') ||
      (sName.includes('صندوق') && a.type === 'cashbox')
    );
    if (acc) return acc;
  }

  // 3. By default cash account
  const defaultAcc = accounts.find(a => a.isDefault);
  if (defaultAcc) return defaultAcc;

  // 4. By 'cashbox' type
  const cashboxAcc = accounts.find(a => a.type === 'cashbox');
  if (cashboxAcc) return cashboxAcc;

  // 5. First account available
  return accounts[0] || null;
}

/**
 * Synchronizes an individual transaction with its associated cash account in the Financial Center.
 * @param trans The transaction to synchronize
 * @param exchangeRates Currency exchange rates
 * @param isReversal If true, inverts the transaction operation (used on deletion or before edit)
 */
export async function syncTransactionToCashAccount(
  trans: Partial<Transaction> | null | undefined,
  exchangeRates: ExchangeRates,
  isReversal: boolean = false
): Promise<void> {
  if (!trans || !trans.amount || trans.amount <= 0) return;

  // Case 1: Internal transfers between cash accounts
  if (trans.sourceAccount && trans.destinationAccount) {
    const accounts = await db.cashAccounts.toArray();
    const fromAcc = accounts.find(a => 
      a.name === trans.sourceAccount || 
      a.type === trans.sourceAccount || 
      (trans.sourceAccount && trans.sourceAccount.includes('خزن') && a.type === 'vault') ||
      (trans.sourceAccount && trans.sourceAccount.includes('صندوق') && a.type === 'cashbox')
    );
    const toAcc = accounts.find(a => 
      a.name === trans.destinationAccount || 
      a.type === trans.destinationAccount || 
      (trans.destinationAccount && trans.destinationAccount.includes('خزن') && a.type === 'vault') ||
      (trans.destinationAccount && trans.destinationAccount.includes('صندوق') && a.type === 'cashbox')
    );

    if (isReversal) {
      // Revert transfer: Add back to fromAcc, deduct from toAcc
      if (fromAcc && fromAcc.id) {
        const fromAmt = convertCurrency(trans.amount, trans.currency || fromAcc.currency, fromAcc.currency, exchangeRates);
        await db.cashAccounts.update(fromAcc.id, {
          balance: Math.round((fromAcc.balance + fromAmt) * 100) / 100,
          updatedAt: new Date().toISOString()
        });
      }
      if (toAcc && toAcc.id) {
        const toAmt = convertCurrency(trans.amount, trans.currency || toAcc.currency, toAcc.currency, exchangeRates);
        await db.cashAccounts.update(toAcc.id, {
          balance: Math.max(0, Math.round((toAcc.balance - toAmt) * 100) / 100),
          updatedAt: new Date().toISOString()
        });
      }
    }
    return;
  }

  // Case 2: Debt repayments
  if (trans.isDebtRepayment || trans.debtAccountId) {
    if (isReversal) {
      // Refund the cashbox/vault
      const targetAcc = await getTargetCashAccount(trans);
      if (targetAcc && targetAcc.id) {
        const converted = convertCurrency(trans.amount, trans.currency || targetAcc.currency, targetAcc.currency, exchangeRates);
        await db.cashAccounts.update(targetAcc.id, {
          balance: Math.round((targetAcc.balance + converted) * 100) / 100,
          updatedAt: new Date().toISOString()
        });
      }
      // Revert debtAccount's paidAmount
      if (trans.debtAccountId) {
        const debt = await db.debtAccounts.get(trans.debtAccountId);
        if (debt) {
          const debtAmt = convertCurrency(trans.amount, trans.currency || debt.currency, debt.currency, exchangeRates);
          const newPaid = Math.max(0, Math.round(((debt.paidAmount || 0) - debtAmt) * 100) / 100);
          await db.debtAccounts.update(debt.id!, {
            paidAmount: newPaid,
            status: newPaid >= debt.totalAmount ? 'settled' : 'active'
          });
        }
      }
    }
    return;
  }

  // Case 3: Initial opening balance of a cash account
  if (trans.category?.includes('رصيد افتتاحي') || trans.category?.includes('رأس مال')) {
    if (isReversal) {
      const targetAcc = await getTargetCashAccount(trans);
      if (targetAcc && targetAcc.id) {
        const converted = convertCurrency(trans.amount, trans.currency || targetAcc.currency, targetAcc.currency, exchangeRates);
        await db.cashAccounts.update(targetAcc.id, {
          balance: Math.max(0, Math.round((targetAcc.balance - converted) * 100) / 100),
          updatedAt: new Date().toISOString()
        });
      }
    }
    return;
  }

  // Case 4: Operational transactions (income / expense / payments)
  // These directly affect the cashbox / treasury balance
  const targetAcc = await getTargetCashAccount(trans);
  if (!targetAcc || !targetAcc.id) return;

  const converted = convertCurrency(trans.amount, trans.currency || targetAcc.currency, targetAcc.currency, exchangeRates);

  let newBalance = targetAcc.balance;
  if (isReversal) {
    // If an income transaction is deleted -> deduct from account
    // If an expense transaction is deleted -> add back to account
    if (trans.type === 'income') {
      newBalance = Math.max(0, targetAcc.balance - converted);
    } else if (trans.type === 'expense') {
      newBalance = targetAcc.balance + converted;
    }
  } else {
    // If an income transaction is created -> add to account
    // If an expense transaction is created -> deduct from account
    if (trans.type === 'income') {
      newBalance = targetAcc.balance + converted;
    } else if (trans.type === 'expense') {
      newBalance = Math.max(0, targetAcc.balance - converted);
    }
  }

  await db.cashAccounts.update(targetAcc.id, {
    balance: Math.round(newBalance * 100) / 100,
    updatedAt: new Date().toISOString()
  });
}

/**
 * Reverts the effect of a deleted transaction from its cash account
 */
export async function revertTransactionFromCashAccount(
  trans: Partial<Transaction> | null | undefined,
  exchangeRates: ExchangeRates
): Promise<void> {
  await syncTransactionToCashAccount(trans, exchangeRates, true);
}

/**
 * Adjusts cash account when a transaction is edited
 */
export async function adjustTransactionInCashAccount(
  prevTx: Partial<Transaction> | null | undefined,
  newTx: Partial<Transaction> | null | undefined,
  exchangeRates: ExchangeRates
): Promise<void> {
  if (prevTx) {
    await revertTransactionFromCashAccount(prevTx, exchangeRates);
  }
  if (newTx) {
    await syncTransactionToCashAccount(newTx, exchangeRates, false);
  }
}

/**
 * Directly adjust task deposit delta in default cashbox
 */
export async function syncTaskDepositToCashAccount(
  depositDelta: number,
  currency: Currency,
  exchangeRates: ExchangeRates
): Promise<void> {
  if (!depositDelta || depositDelta === 0) return;
  const accounts = await db.cashAccounts.toArray();
  const targetAcc = accounts.find(a => a.isDefault) || accounts.find(a => a.type === 'cashbox') || accounts[0];
  if (!targetAcc || !targetAcc.id) return;

  const converted = convertCurrency(Math.abs(depositDelta), currency || targetAcc.currency, targetAcc.currency, exchangeRates);
  let newBalance = targetAcc.balance;
  if (depositDelta > 0) {
    newBalance = targetAcc.balance + converted;
  } else {
    newBalance = Math.max(0, targetAcc.balance - converted);
  }

  await db.cashAccounts.update(targetAcc.id, {
    balance: Math.round(newBalance * 100) / 100,
    updatedAt: new Date().toISOString()
  });
}
