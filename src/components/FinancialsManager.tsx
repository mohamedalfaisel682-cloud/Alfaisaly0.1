import React, { useState } from 'react';
import { 
  Wallet, 
  Package, 
  TrendingUp, 
  TrendingDown, 
  Landmark, 
  CreditCard, 
  Plus, 
  ArrowRightLeft, 
  CheckCircle2, 
  AlertCircle, 
  FileText, 
  ShieldCheck, 
  Building2, 
  Coins, 
  DollarSign, 
  Layers, 
  ArrowDownLeft, 
  ArrowUpRight, 
  History, 
  Calendar,
  X,
  UserCheck,
  Percent,
  Sparkles,
  StickyNote,
  Edit3,
  Trash2
} from 'lucide-react';
import { db } from '../lib/db';
import { useLiveQuery } from 'dexie-react-hooks';
import { Currency, ExchangeRates, InventoryItem, Task, Transaction, CashAccount, DebtAccount, DebtPayment } from '../types';
import { cn, formatAmount, getInUSD, convertCurrency, convertAndRound, isFinancialCenterOnlyTransaction } from '../lib/utils';
import { ExportToolbar } from './ExportToolbar';
import toast from 'react-hot-toast';

export interface FinancialsManagerProps {
  systemCurrency: Currency;
  exchangeRates: ExchangeRates;
  inventory: InventoryItem[];
  tasks: Task[];
  transactions: Transaction[];
  canAccessAccounts?: boolean;
  notes?: any[];
  onOpenNote?: (note: any) => void;
  onAddAccountNote?: (accountId: string, accountName: string) => void;
}

export const FinancialsManager: React.FC<FinancialsManagerProps> = ({
  systemCurrency,
  exchangeRates,
  inventory,
  tasks,
  transactions,
  canAccessAccounts = true,
  notes = [],
  onOpenNote,
  onAddAccountNote
}) => {
  const [activeTab, setActiveTab] = useState<'overview' | 'treasury' | 'debts'>('overview');

  // Live query for cash accounts and debt accounts
  const cashAccounts = useLiveQuery(() => db.cashAccounts.toArray()) || [];
  const debtAccounts = useLiveQuery(() => db.debtAccounts.toArray()) || [];

  // Initialize default cash accounts if none exist
  React.useEffect(() => {
    const initDefaults = async () => {
      const count = await db.cashAccounts.count();
      if (count === 0) {
        await db.cashAccounts.bulkAdd([
          {
            name: 'الصندوق الرئيسي (النقد اليومي)',
            type: 'cashbox',
            balance: 0,
            currency: systemCurrency,
            isDefault: true,
            createdAt: new Date().toISOString(),
            notes: 'صندوق النقدية اليومية والمقبوضات المباشرة'
          },
          {
            name: 'الخزينة الاحتياطية (الخزنة)',
            type: 'vault',
            balance: 0,
            currency: systemCurrency,
            createdAt: new Date().toISOString(),
            notes: 'خزينة الأرباح والاحتياطي وتوريدات الأصول'
          }
        ]);
      }
    };
    initDefaults();
  }, [systemCurrency]);

  // Currency view toggle: false = converted to systemCurrency (default), true = original creation currency
  const [showOriginalCurrency, setShowOriginalCurrency] = useState(false);

  // Edit / Delete Cash Accounts Modal States
  const [isEditAccountsModalOpen, setIsEditAccountsModalOpen] = useState(false);
  const [editingAccount, setEditingAccount] = useState<{ id: number; name: string } | null>(null);
  const [editAccountNameInput, setEditAccountNameInput] = useState('');

  // Modal States
  const [isAddAccountModalOpen, setIsAddAccountModalOpen] = useState(false);
  const [isTransferModalOpen, setIsTransferModalOpen] = useState(false);
  const [isAddDebtModalOpen, setIsAddDebtModalOpen] = useState(false);
  const [isDebtPaymentModalOpen, setIsDebtPaymentModalOpen] = useState(false);
  const [selectedDebtAccount, setSelectedDebtAccount] = useState<DebtAccount | null>(null);
  const [viewingDebtStatement, setViewingDebtStatement] = useState<DebtAccount | null>(null);

  // Forms State
  const [newAccountName, setNewAccountName] = useState('');
  const [newAccountType, setNewAccountType] = useState<'cashbox' | 'vault' | 'bank' | 'wallet'>('cashbox');
  const [newAccountBalance, setNewAccountBalance] = useState<number | ''>('');
  const [newAccountCurrency, setNewAccountCurrency] = useState<Currency>(systemCurrency);
  const [newAccountNotes, setNewAccountNotes] = useState('');

  // Transfer Form State
  const [transferFromId, setTransferFromId] = useState<number | ''>('');
  const [transferToId, setTransferToId] = useState<number | ''>('');
  const [transferAmount, setTransferAmount] = useState<number | ''>('');
  const [transferNotes, setTransferNotes] = useState('');

  // Debt Form State
  const [newDebtName, setNewDebtName] = useState('');
  const [newDebtCreditor, setNewDebtCreditor] = useState('');
  const [newDebtPhone, setNewDebtPhone] = useState('');
  const [newDebtTotal, setNewDebtTotal] = useState<number | ''>('');
  const [newDebtCurrency, setNewDebtCurrency] = useState<Currency>(systemCurrency);
  const [newDebtPurpose, setNewDebtPurpose] = useState('تمويل شراء بضاعة ومخزون');
  const [newDebtDueDate, setNewDebtDueDate] = useState('');
  const [newDebtNotes, setNewDebtNotes] = useState('');

  // Debt Payment Form State
  const [paymentAmount, setPaymentAmount] = useState<number | ''>('');
  const [paymentSource, setPaymentSource] = useState<'net_profit' | 'cashbox' | 'vault' | 'other'>('net_profit');
  const [paymentNotes, setPaymentNotes] = useState('');
  const [paymentReceiptNo, setPaymentReceiptNo] = useState('');

  // ----------------------------------------------------
  // Calculations: Assets, Inventory, Debts, Net Worth
  // ----------------------------------------------------

  // 1. Inventory Valuation (الأصول ورأس مال المخزن)
  const totalInventoryCostUSD = inventory.reduce((sum, item) => {
    const costInUSD = getInUSD(item.costPrice || 0, item.currency || 'RY', exchangeRates);
    return sum + (costInUSD * (item.stock || 0));
  }, 0);

  const totalInventorySellingUSD = inventory.reduce((sum, item) => {
    const sellInUSD = getInUSD(item.sellingPrice || 0, item.currency || 'RY', exchangeRates);
    return sum + (sellInUSD * (item.stock || 0));
  }, 0);

  const totalInventoryUnits = inventory.reduce((sum, item) => sum + (item.stock || 0), 0);
  const potentialInventoryProfitUSD = totalInventorySellingUSD - totalInventoryCostUSD;

  // 2. Cash and Vault Balances (النقدية المتوفرة)
  const totalCashUSD = cashAccounts.reduce((sum, acc) => {
    return sum + getInUSD(acc.balance || 0, acc.currency || 'RY', exchangeRates);
  }, 0);

  // 3. Customer Dues / Receivables (مستحقات العملاء)
  const customerDuesUSD = tasks.reduce((sum, t) => {
    const isCompletedOrDelivered = t.status === 'تم التسليم' || t.status === 'جاهز';
    const remaining = Math.max(0, (t.cost || 0) - (t.deposit || 0));
    if (remaining > 0) {
      return sum + getInUSD(remaining, t.currency || 'RY', exchangeRates);
    }
    return sum;
  }, 0);

  // 4. Total Project Assets (إجمالي الأصول الكلية)
  const totalAssetsUSD = totalCashUSD + totalInventoryCostUSD + customerDuesUSD;

  // 5. Debt Liabilities (الديون والالتزامات الرأسمالية)
  const totalDebtsUSD = debtAccounts.reduce((sum, d) => {
    return sum + getInUSD(d.totalAmount || 0, d.currency || 'RY', exchangeRates);
  }, 0);

  const totalPaidDebtsUSD = debtAccounts.reduce((sum, d) => {
    return sum + getInUSD(d.paidAmount || 0, d.currency || 'RY', exchangeRates);
  }, 0);

  const remainingDebtsUSD = Math.max(0, totalDebtsUSD - totalPaidDebtsUSD);

  // Debts explicitly for inventory/assets
  const inventoryDebtsUSD = debtAccounts
    .filter(d => d.purpose.includes('بضاعة') || d.purpose.includes('مخزون') || d.purpose.includes('أصول'))
    .reduce((sum, d) => sum + getInUSD(Math.max(0, (d.totalAmount || 0) - (d.paidAmount || 0)), d.currency || 'RY', exchangeRates), 0);

  // 6. Net Capital / Net Worth (صافي رأس المال وحقوق الملكية)
  const netCapitalUSD = totalAssetsUSD - remainingDebtsUSD;

  // 7. Net Profit from Operations (صافي الأرباح التشغيلية - يستثني الحركات الرأسمالية والتحويلات الداخلية وسداد الديون)
  const totalIncomeUSD = transactions
    .filter(t => t.type === 'income' && !isFinancialCenterOnlyTransaction(t))
    .reduce((sum, t) => sum + getInUSD(t.amount, t.currency, exchangeRates), 0);
  const totalExpenseUSD = transactions
    .filter(t => t.type === 'expense' && !isFinancialCenterOnlyTransaction(t))
    .reduce((sum, t) => sum + getInUSD(t.amount, t.currency, exchangeRates), 0);
  const netOperationalProfitUSD = totalIncomeUSD - totalExpenseUSD;

  // Profit allocated to debt repayment
  const profitPaidToDebtsUSD = debtAccounts.reduce((sum, d) => {
    const profitPayments = (d.payments || []).filter(p => p.source === 'net_profit');
    const pSum = profitPayments.reduce((s, p) => s + getInUSD(p.amount, p.currency, exchangeRates), 0);
    return sum + pSum;
  }, 0);

  const retainedProfitUSD = netOperationalProfitUSD - profitPaidToDebtsUSD;

  // ----------------------------------------------------
  // Handlers
  // ----------------------------------------------------

  const handleCreateAccount = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newAccountName.trim()) {
      toast.error('يرجى كتابة اسم الحساب/الصندوق');
      return;
    }

    try {
      const newAccData = {
        name: newAccountName.trim(),
        type: newAccountType,
        balance: Number(newAccountBalance) || 0,
        currency: newAccountCurrency,
        notes: newAccountNotes.trim() || undefined,
        createdAt: new Date().toISOString()
      };
      const newAccId = await db.cashAccounts.add(newAccData);

      try {
        await db.auditLogs.add({
          timestamp: new Date().toISOString(),
          actionType: 'add',
          entityType: 'financial_account',
          entityId: Number(newAccId),
          entityName: newAccountName.trim(),
          details: `إضافة حساب مالي جديد: ${newAccountName.trim()} برصيد ${newAccountBalance || 0} ${newAccountCurrency}`,
          user: 'المستخدم',
          previousData: null,
          newData: { ...newAccData, id: Number(newAccId) }
        });
      } catch (e) {}

      // If initial balance > 0, log a transaction (Financial Center only)
      if (Number(newAccountBalance) > 0) {
        await db.transactions.add({
          id: Date.now(),
          type: 'income',
          description: `رصيد افتتاحي لحساب: ${newAccountName.trim()}`,
          amount: Number(newAccountBalance),
          currency: newAccountCurrency,
          category: 'رأس مال / رصيد افتتاحي',
          customerName: null,
          date: new Date().toISOString().split('T')[0],
          sourceAccount: newAccountType,
          isInternalFinancial: true,
          scope: 'financial_center'
        });
      }

      toast.success('تمت إضافة الحساب النقدي بنجاح');
      setIsAddAccountModalOpen(false);
      setNewAccountName('');
      setNewAccountBalance('');
      setNewAccountNotes('');
    } catch (err) {
      console.error('Add account error:', err);
      toast.error('فشل في حفظ الحساب');
    }
  };

  const handleDeleteAccount = async (id: number, name: string) => {
    if (cashAccounts.length <= 1) {
      toast.error('لا يمكن حذف هذا الصندوق. يجب أن يتوفر صندوق أو خزينة واحدة على الأقل في النظام.');
      return;
    }
    const acc = cashAccounts.find(a => a.id === id);
    if (!acc) return;
    
    const hasBalance = acc.balance && acc.balance !== 0;
    const msg = hasBalance 
      ? `تنبيه: حساب "${name}" يحتوي على رصيد متبقي (${acc.balance} ${acc.currency}). هل أنت متأكد من حذفه نهائياً من النظام؟`
      : `هل أنت متأكد من رغبتك في حذف حساب "${name}" نهائياً من الصناديق والخزائن؟`;

    if (!window.confirm(msg)) return;

    try {
      await db.cashAccounts.delete(id);
      try {
        await db.auditLogs.add({
          timestamp: new Date().toISOString(),
          actionType: 'delete',
          entityType: 'financial_account',
          entityId: id,
          entityName: name,
          details: `حذف حساب مالي: ${name}`,
          user: 'المستخدم',
          previousData: { ...acc, id },
          newData: null
        });
      } catch (e) {}

      toast.success(`تم حذف "${name}" بنجاح`);
      if (editingAccount?.id === id) {
        setEditingAccount(null);
      }
    } catch (err) {
      console.error('Delete account error:', err);
      toast.error('حدث خطأ أثناء محاولة حذف الحساب');
    }
  };

  const handleUpdateAccountName = async (id: number, newName: string) => {
    const trimmed = newName.trim();
    if (!trimmed) {
      toast.error('يرجى إدخال اسم صحيح للصندوق أو الخزينة');
      return;
    }
    const prevAcc = cashAccounts.find(a => a.id === id);
    try {
      const updateData = { 
        name: trimmed,
        updatedAt: new Date().toISOString()
      };
      await db.cashAccounts.update(id, updateData);
      try {
        await db.auditLogs.add({
          timestamp: new Date().toISOString(),
          actionType: 'edit',
          entityType: 'financial_account',
          entityId: id,
          entityName: trimmed,
          details: `تعديل اسم الحساب المالي من "${prevAcc?.name}" إلى "${trimmed}"`,
          user: 'المستخدم',
          previousData: prevAcc ? { ...prevAcc, id } : null,
          newData: prevAcc ? { ...prevAcc, ...updateData, id } : updateData
        });
      } catch (e) {}

      toast.success(`تم تحديث اسم الحساب إلى "${trimmed}" بنجاح`);
      setEditingAccount(null);
    } catch (err) {
      console.error('Update account error:', err);
      toast.error('حدث خطأ أثناء تعديل الاسم');
    }
  };

  const handleTransfer = async (e: React.FormEvent) => {
    e.preventDefault();
    const fromAcc = cashAccounts.find(a => a.id === Number(transferFromId));
    const toAcc = cashAccounts.find(a => a.id === Number(transferToId));
    const amount = Number(transferAmount);

    if (!fromAcc || !toAcc || fromAcc.id === toAcc.id) {
      toast.error('يرجى اختيار حسابين مختلفين للتحويل');
      return;
    }

    if (!amount || amount <= 0) {
      toast.error('يرجى إدخال مبلغ تحويل صحيح');
      return;
    }

    if (fromAcc.balance < amount) {
      toast.error(`رصيد ${fromAcc.name} غير كافٍ (${fromAcc.balance} ${fromAcc.currency})`);
      return;
    }

    try {
      // Deduct from source
      await db.cashAccounts.update(fromAcc.id!, {
        balance: fromAcc.balance - amount,
        updatedAt: new Date().toISOString()
      });

      // Convert amount if target has different currency
      const receivedAmount = fromAcc.currency === toAcc.currency 
        ? amount 
        : convertCurrency(amount, fromAcc.currency, toAcc.currency, exchangeRates);

      // Add to destination
      await db.cashAccounts.update(toAcc.id!, {
        balance: toAcc.balance + receivedAmount,
        updatedAt: new Date().toISOString()
      });

      // Log transaction as internal financial center only (excluded from AccountsManager)
      await db.transactions.add({
        id: Date.now(),
        type: 'expense',
        description: `تحويل داخلي من (${fromAcc.name}) إلى (${toAcc.name}) ${transferNotes ? `- ${transferNotes}` : ''}`,
        amount: amount,
        currency: fromAcc.currency,
        category: 'تحويل نقدي داخلي',
        customerName: null,
        date: new Date().toISOString().split('T')[0],
        sourceAccount: fromAcc.name,
        destinationAccount: toAcc.name,
        isInternalFinancial: true,
        scope: 'financial_center'
      });

      toast.success(`تم تحويل ${amount} ${fromAcc.currency} إلى ${toAcc.name} بنجاح`);
      setIsTransferModalOpen(false);
      setTransferAmount('');
      setTransferNotes('');
    } catch (err) {
      console.error('Transfer error:', err);
      toast.error('فشل في إتمام عملية التحويل');
    }
  };

  const handleCreateDebt = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!newDebtName.trim() || !newDebtCreditor.trim()) {
      toast.error('يرجى كتابة اسم حساب الدين واسم الدائن');
      return;
    }

    const total = Number(newDebtTotal);
    if (!total || total <= 0) {
      toast.error('يرجى إدخال مبلغ الدين بشكل صحيح');
      return;
    }

    try {
      await db.debtAccounts.add({
        name: newDebtName.trim(),
        creditorName: newDebtCreditor.trim(),
        phone: newDebtPhone.trim() || undefined,
        totalAmount: total,
        paidAmount: 0,
        currency: newDebtCurrency,
        purpose: newDebtPurpose,
        status: 'active',
        createdAt: new Date().toISOString(),
        dueDate: newDebtDueDate || undefined,
        payments: [],
        notes: newDebtNotes.trim() || undefined
      });

      toast.success('تم تسجيل حساب الدين والتمويل بنجاح');
      setIsAddDebtModalOpen(false);
      setNewDebtName('');
      setNewDebtCreditor('');
      setNewDebtPhone('');
      setNewDebtTotal('');
      setNewDebtNotes('');
      setNewDebtDueDate('');
    } catch (err) {
      console.error('Add debt error:', err);
      toast.error('فشل في حفظ حساب الدين');
    }
  };

  const handleAddDebtPayment = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!selectedDebtAccount || !selectedDebtAccount.id) return;

    const amount = Number(paymentAmount);
    if (!amount || amount <= 0) {
      toast.error('يرجى إدخال مبلغ سداد صحيح');
      return;
    }

    const currentRemaining = selectedDebtAccount.totalAmount - (selectedDebtAccount.paidAmount || 0);
    if (amount > currentRemaining) {
      toast.error(`المبلغ المدخل (${amount}) أكبر من المتبقي للدين (${currentRemaining} ${selectedDebtAccount.currency})`);
      return;
    }

    try {
      const newPayment: DebtPayment = {
        id: `PAY-${Date.now()}`,
        amount: amount,
        currency: selectedDebtAccount.currency,
        date: new Date().toISOString().split('T')[0],
        source: paymentSource,
        note: paymentNotes.trim() || undefined,
        receiptNumber: paymentReceiptNo.trim() || `RCP-${Math.floor(100000 + Math.random() * 900000)}`
      };

      const newPaidAmount = (selectedDebtAccount.paidAmount || 0) + amount;
      const isSettled = newPaidAmount >= selectedDebtAccount.totalAmount;

      await db.debtAccounts.update(selectedDebtAccount.id, {
        paidAmount: newPaidAmount,
        status: isSettled ? 'settled' : 'active',
        payments: [...(selectedDebtAccount.payments || []), newPayment]
      });

      // Log transaction
      const sourceLabel = paymentSource === 'net_profit' ? 'صافي الأرباح' :
                          paymentSource === 'cashbox' ? 'الصندوق اليومي' :
                          paymentSource === 'vault' ? 'الخزينة الاحتياطية' : 'مصدر آخر';

      // Log transaction as internal financial center only (debt liability reduction, not operational expense)
      await db.transactions.add({
        id: Date.now(),
        type: 'expense',
        description: `سداد دفعة دين (${selectedDebtAccount.name} - ${selectedDebtAccount.creditorName}) من [${sourceLabel}] ${paymentNotes ? `- ${paymentNotes}` : ''}`,
        amount: amount,
        currency: selectedDebtAccount.currency,
        category: 'سداد ديون وتمويل الأصول/المخزن',
        customerName: selectedDebtAccount.creditorName,
        date: new Date().toISOString().split('T')[0],
        debtAccountId: selectedDebtAccount.id,
        isDebtRepayment: true,
        repaymentSource: paymentSource === 'other' ? undefined : paymentSource,
        isInternalFinancial: true,
        scope: 'financial_center'
      });

      // If deducted from cashbox or vault, update its balance
      if (paymentSource === 'cashbox' || paymentSource === 'vault') {
        const targetAcc = cashAccounts.find(a => a.type === paymentSource);
        if (targetAcc && targetAcc.id) {
          const deduction = targetAcc.currency === selectedDebtAccount.currency
            ? amount
            : convertCurrency(amount, selectedDebtAccount.currency, targetAcc.currency, exchangeRates);
          await db.cashAccounts.update(targetAcc.id, {
            balance: Math.max(0, targetAcc.balance - deduction),
            updatedAt: new Date().toISOString()
          });
        }
      }

      toast.success(isSettled ? '🎉 تم سداد الدين بالكامل وتصفيته بنجاح!' : `تم تسجيل سداد ${amount} ${selectedDebtAccount.currency} بنجاح`);
      setIsDebtPaymentModalOpen(false);
      setSelectedDebtAccount(null);
      setPaymentAmount('');
      setPaymentNotes('');
      setPaymentReceiptNo('');
    } catch (err) {
      console.error('Debt payment error:', err);
      toast.error('فشل في تسجيل دفعة السداد');
    }
  };

  // Text generators for copying to clipboard
  const getOverviewText = () => {
    return `📊 *تقرير المركز المالي والأصول ورأس المال*
📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}
━━━━━━━━━━━━━━━━━━━━
🏢 *أصول المحل والمشروع:*
• 📦 قيمة بضاعة المخزن (سعر التكلفة): ${formatAmount(totalInventoryCostUSD, systemCurrency, exchangeRates)} ${systemCurrency} (${totalInventoryUnits} قطعة)
• 🏷️ القيمة السوقية المتوقعة للمخزن (سعر البيع): ${formatAmount(totalInventorySellingUSD, systemCurrency, exchangeRates)} ${systemCurrency}
• 💵 إجمالي النقدية المتوفرة (الخزائن والصناديق): ${formatAmount(totalCashUSD, systemCurrency, exchangeRates)} ${systemCurrency}
• 👥 ديون ومستحقات على العملاء: ${formatAmount(customerDuesUSD, systemCurrency, exchangeRates)} ${systemCurrency}
💎 *إجمالي الأصول الكلية:* ${formatAmount(totalAssetsUSD, systemCurrency, exchangeRates)} ${systemCurrency}

━━━━━━━━━━━━━━━━━━━━
💳 *الالتزامات والديون الرأسمالية (تمويل المخزن والأصول):*
• 🔴 إجمالي الديون المستحقة: ${formatAmount(totalDebtsUSD, systemCurrency, exchangeRates)} ${systemCurrency}
• 🟢 المسدد منها حتى الآن: ${formatAmount(totalPaidDebtsUSD, systemCurrency, exchangeRates)} ${systemCurrency}
• ⚠️ المتبقي الواجب سداده: ${formatAmount(remainingDebtsUSD, systemCurrency, exchangeRates)} ${systemCurrency}

━━━━━━━━━━━━━━━━━━━━
👑 *صافي رأس المال وحقوق الملكية (Net Worth):*
🌟 *${formatAmount(netCapitalUSD, systemCurrency, exchangeRates)} ${systemCurrency}*

📈 *صافي الأرباح التشغيلية:* ${formatAmount(netOperationalProfitUSD, systemCurrency, exchangeRates)} ${systemCurrency}
• مسدد للديون من الأرباح: ${formatAmount(profitPaidToDebtsUSD, systemCurrency, exchangeRates)} ${systemCurrency}
• أرباح محتجزة متبقية: ${formatAmount(retainedProfitUSD, systemCurrency, exchangeRates)} ${systemCurrency}`;
  };

  const getDebtsText = () => {
    let text = `💳 *كشف حسابات الديون والالتزامات (تمويل الأصول والمخزن)*\n`;
    text += `📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}\n`;
    text += `⚠️ المتبقي الإجمالي: ${formatAmount(remainingDebtsUSD, systemCurrency, exchangeRates)} ${systemCurrency}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    debtAccounts.forEach((d, idx) => {
      const rem = d.totalAmount - (d.paidAmount || 0);
      text += `${idx + 1}. *${d.name}* (الدائن: ${d.creditorName})\n`;
      text += `   • الغرض: ${d.purpose}\n`;
      text += `   • المبلغ الأصلي: ${d.totalAmount} ${d.currency}\n`;
      text += `   • المسدد: ${d.paidAmount || 0} ${d.currency} (${Math.round(((d.paidAmount || 0) / d.totalAmount) * 100)}%)\n`;
      text += `   • المتبقي: ${rem} ${d.currency} [${d.status === 'settled' ? 'مسدد بالكامل ✅' : 'نشط ⏳'}]\n\n`;
    });
    return text;
  };

  const getTreasuryText = () => {
    let text = `🏦 *تقرير أرصدة وحركات الصندوق والخزينة*\n`;
    text += `📅 التاريخ: ${new Date().toLocaleDateString('ar-EG')}\n`;
    text += `💵 إجمالي النقدية: ${formatAmount(totalCashUSD, systemCurrency, exchangeRates)} ${systemCurrency}\n`;
    text += `━━━━━━━━━━━━━━━━━━━━\n`;
    cashAccounts.forEach((acc, idx) => {
      text += `${idx + 1}. *${acc.name}* (${acc.type === 'cashbox' ? 'صندوق يومي' : acc.type === 'vault' ? 'خزينة' : 'بنك/محفظة'})\n`;
      text += `   • الرصيد: ${acc.balance} ${acc.currency}\n`;
      if (acc.notes) text += `   • ملاحظات: ${acc.notes}\n`;
    });
    return text;
  };

  return (
    <div className="space-y-4" dir="rtl">
      {/* Navigation Tabs Bar */}
      <div className="flex flex-wrap items-center justify-between gap-3 bg-white dark:bg-slate-900 p-3.5 rounded-2xl border-2 border-slate-300 dark:border-slate-700 shadow-sm">
        <div className="flex items-center gap-2 flex-wrap">
          <button
            type="button"
            onClick={() => setActiveTab('overview')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none border-2 duration-200",
              activeTab === 'overview'
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-500 shadow-sm ring-2 ring-emerald-500/25 scale-[1.02]"
                : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
            )}
          >
            <Building2 className={cn("w-4 h-4", activeTab === 'overview' ? "text-emerald-600" : "text-slate-400")} />
            <span>المركز المالي والأصول ورأس المال</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('treasury')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none border-2 duration-200",
              activeTab === 'treasury'
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-500 shadow-sm ring-2 ring-emerald-500/25 scale-[1.02]"
                : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
            )}
          >
            <Landmark className={cn("w-4 h-4", activeTab === 'treasury' ? "text-emerald-600" : "text-slate-400")} />
            <span>الصندوق والخزينة ({cashAccounts.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab('debts')}
            className={cn(
              "flex items-center gap-2 px-3.5 py-2.5 rounded-xl text-xs sm:text-sm font-black transition-all cursor-pointer select-none border-2 relative duration-200",
              activeTab === 'debts'
                ? "bg-emerald-50 dark:bg-emerald-950/40 text-emerald-800 dark:text-emerald-300 border-emerald-500 shadow-sm ring-2 ring-emerald-500/25 scale-[1.02]"
                : "bg-slate-50 dark:bg-slate-800/80 hover:bg-slate-100 text-slate-600 dark:text-slate-400 border-slate-200 dark:border-slate-700 hover:border-slate-300"
            )}
          >
            <CreditCard className={cn("w-4 h-4", activeTab === 'debts' ? "text-emerald-600" : "text-slate-400")} />
            <span>ديون تمويل الأصول والمخزن ({debtAccounts.filter(d => d.status === 'active').length})</span>
            {remainingDebtsUSD > 0 && (
              <span className="w-2 h-2 rounded-full bg-red-500" />
            )}
          </button>
        </div>

        {/* Action Buttons based on tab */}
        <div className="flex items-center gap-2">
          {activeTab === 'treasury' && (
            <>
              <button
                type="button"
                onClick={() => setIsTransferModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-indigo-50 hover:bg-indigo-100 text-indigo-700 border border-indigo-200/60 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                <ArrowRightLeft className="w-3.5 h-3.5" />
                <span>تحويل داخلي</span>
              </button>
              <button
                type="button"
                onClick={() => setIsAddAccountModalOpen(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
              >
                <Plus className="w-3.5 h-3.5" />
                <span>إضافة صندوق/خزينة</span>
              </button>
            </>
          )}

          {activeTab === 'debts' && (
            <button
              type="button"
              onClick={() => setIsAddDebtModalOpen(true)}
              className="flex items-center gap-1.5 px-3.5 py-1.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl text-xs font-bold transition-all cursor-pointer shadow-xs"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>إضافة حساب دين / تمويل مخزن</span>
            </button>
          )}
        </div>
      </div>

      {/* ---------------------------------------------------- */}
      {/* TAB 1: OVERVIEW & BALANCE SHEET                      */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'overview' && (
        <div className="space-y-4" id="financial-position-container">
          {/* Top Bar with Export Tools */}
          <div className="flex flex-wrap items-center justify-between gap-3 bg-gradient-to-r from-sky-50 via-blue-50 to-slate-50 text-slate-900 border border-sky-200 p-4 rounded-2xl shadow-xs">
            <div className="space-y-1">
              <div className="flex items-center gap-2">
                <ShieldCheck className="w-5 h-5 text-sky-700" />
                <h3 className="font-extrabold text-base tracking-wide text-slate-900">لوحة المركز المالي والأصول ورأس المال</h3>
              </div>
              <p className="text-xs text-sky-900 font-bold">
                ربط شامل بين أصناف المخزن، النقدية، مستحقات العملاء، والديون الرأسمالية
              </p>
            </div>

            <ExportToolbar 
              targetElementId="financial-position-container"
              filenamePrefix="المركز_المالي_والأصول"
              title="المركز المالي الشامل"
              getTextToCopy={getOverviewText}
              className="bg-white/80 border border-slate-200 p-1 rounded-xl backdrop-blur-xs shadow-xs"
              showPrint={true}
            />
          </div>

          {/* Core Metrics Grid */}
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3.5">
            {/* 1. Inventory Valuation (الأصل المخزني) */}
            <div className="bg-white p-4 rounded-2xl border border-orange-200/80 shadow-xs space-y-2 relative overflow-hidden">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-orange-700 bg-orange-50 px-2.5 py-1 rounded-lg border border-orange-100 flex items-center gap-1.5">
                  <Package className="w-3.5 h-3.5 text-orange-600" />
                  أصل بضاعة المخزن
                </span>
                <span className="text-[11px] font-bold text-slate-400">{inventory.length} صنف ({totalInventoryUnits} قطعة)</span>
              </div>
              <p className="text-2xl font-black text-slate-800 tracking-tight">
                {formatAmount(totalInventoryCostUSD, systemCurrency, exchangeRates)} <span className="text-xs font-bold text-slate-500">{systemCurrency}</span>
              </p>
              <div className="text-[11px] font-bold text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
                <span>القيمة بالبيع: {formatAmount(totalInventorySellingUSD, systemCurrency, exchangeRates)} {systemCurrency}</span>
                <span className="text-emerald-600">+{formatAmount(potentialInventoryProfitUSD, systemCurrency, exchangeRates)} ربح متوقع</span>
              </div>
            </div>

            {/* 2. Liquid Cash (السيولة النقدية) */}
            <div className="bg-white p-4 rounded-2xl border border-emerald-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-emerald-700 bg-emerald-50 px-2.5 py-1 rounded-lg border border-emerald-100 flex items-center gap-1.5">
                  <Landmark className="w-3.5 h-3.5 text-emerald-600" />
                  النقدية والخزائن
                </span>
                <span className="text-[11px] font-bold text-slate-400">{cashAccounts.length} حسابات</span>
              </div>
              <p className="text-2xl font-black text-emerald-700 tracking-tight">
                {formatAmount(totalCashUSD, systemCurrency, exchangeRates)} <span className="text-xs font-bold text-emerald-600">{systemCurrency}</span>
              </p>
              <div className="text-[11px] font-bold text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
                <span>مستحقات على العملاء:</span>
                <span className="text-sky-700 font-bold">{formatAmount(customerDuesUSD, systemCurrency, exchangeRates)} {systemCurrency}</span>
              </div>
            </div>

            {/* 3. Debt Liabilities (الديون والالتزامات) */}
            <div className="bg-white p-4 rounded-2xl border border-red-200/80 shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-red-700 bg-red-50 px-2.5 py-1 rounded-lg border border-red-100 flex items-center gap-1.5">
                  <CreditCard className="w-3.5 h-3.5 text-red-600" />
                  ديون تمويل الأصول والمخزن
                </span>
                <span className="text-[11px] font-bold text-red-500">{debtAccounts.filter(d => d.status === 'active').length} نشطة</span>
              </div>
              <p className="text-2xl font-black text-red-600 tracking-tight">
                {formatAmount(remainingDebtsUSD, systemCurrency, exchangeRates)} <span className="text-xs font-bold text-red-500">{systemCurrency}</span>
              </p>
              <div className="text-[11px] font-bold text-slate-500 flex justify-between border-t border-slate-100 pt-1.5">
                <span>تم سداد: {formatAmount(totalPaidDebtsUSD, systemCurrency, exchangeRates)} {systemCurrency}</span>
                <span className="text-slate-400">من أصل {formatAmount(totalDebtsUSD, systemCurrency, exchangeRates)}</span>
              </div>
            </div>

            {/* 4. Net Worth / Net Capital (صافي رأس المال) */}
            <div className="bg-gradient-to-br from-sky-50 via-blue-50 to-indigo-50/50 text-slate-900 border border-sky-200 p-4 rounded-2xl shadow-xs space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-amber-800 bg-amber-100/80 px-2.5 py-1 rounded-lg border border-amber-300 flex items-center gap-1.5">
                  <Sparkles className="w-3.5 h-3.5 text-amber-700" />
                  صافي رأس المال وحقوق الملكية
                </span>
                <span className="text-[11px] font-extrabold text-sky-800 bg-sky-100 px-2 py-0.5 rounded-md border border-sky-200">Net Worth</span>
              </div>
              <p className="text-2xl font-black text-slate-900 tracking-tight">
                {formatAmount(netCapitalUSD, systemCurrency, exchangeRates)} <span className="text-xs font-bold text-emerald-700">{systemCurrency}</span>
              </p>
              <div className="text-[11px] font-bold text-slate-700 border-t border-sky-200/80 pt-1.5 flex justify-between items-center">
                <span>إجمالي الأصول: <strong className="text-slate-900">{formatAmount(totalAssetsUSD, systemCurrency, exchangeRates)}</strong></span>
                <span className="text-red-700 font-extrabold bg-red-100/80 border border-red-200 px-2 py-0.5 rounded-md">
                  الديون: -{formatAmount(remainingDebtsUSD, systemCurrency, exchangeRates)}
                </span>
              </div>
            </div>
          </div>

          {/* Detailed Financial Balance Breakdown */}
          <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
            {/* Right: Assets Structure (هيكل الأصول ورأس المال المستثمر) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-sky-100 text-sky-800 rounded-lg border border-sky-200">
                    <Layers className="w-4 h-4" />
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-sm">هيكل الأصول ورأس المال المستثمر</h4>
                </div>
                <span className="text-xs font-extrabold text-sky-900 bg-sky-100 border border-sky-200 px-2.5 py-1 rounded-lg">
                  إجمالي: {formatAmount(totalAssetsUSD, systemCurrency, exchangeRates)} {systemCurrency}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Inventory Asset */}
                <div className="p-3 bg-orange-50/40 rounded-xl border border-orange-100/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-orange-100 text-orange-700 flex items-center justify-center font-bold">
                      <Package className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">بضاعة ومحتويات المخزن (سعر التكلفة)</p>
                      <p className="text-[10px] text-slate-400">رأس مال مجمد في البضاعة والقطع</p>
                    </div>
                  </div>
                  <div className="text-left font-black text-slate-800 text-sm">
                    {formatAmount(totalInventoryCostUSD, systemCurrency, exchangeRates)} {systemCurrency}
                    <span className="block text-[10px] text-orange-600 font-bold">
                      {totalAssetsUSD > 0 ? Math.round((totalInventoryCostUSD / totalAssetsUSD) * 100) : 0}% من الأصول
                    </span>
                  </div>
                </div>

                {/* Cash in Treasury & Boxes */}
                <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <Landmark className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">النقدية المتوفرة (الصناديق والخزينة)</p>
                      <p className="text-[10px] text-slate-400">سيولة نقدية جاهزة للتشغيل</p>
                    </div>
                  </div>
                  <div className="text-left font-black text-slate-800 text-sm">
                    {formatAmount(totalCashUSD, systemCurrency, exchangeRates)} {systemCurrency}
                    <span className="block text-[10px] text-emerald-600 font-bold">
                      {totalAssetsUSD > 0 ? Math.round((totalCashUSD / totalAssetsUSD) * 100) : 0}% من الأصول
                    </span>
                  </div>
                </div>

                {/* Customer Receivables */}
                <div className="p-3 bg-sky-50 rounded-xl border border-sky-200/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-sky-100 text-sky-800 border border-sky-200 flex items-center justify-center font-bold">
                      <UserCheck className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-900">مستحقات وديون على العملاء</p>
                      <p className="text-[10px] text-slate-500">مبالغ متبقية على المهام والمعاملات</p>
                    </div>
                  </div>
                  <div className="text-left font-black text-slate-900 text-sm">
                    {formatAmount(customerDuesUSD, systemCurrency, exchangeRates)} {systemCurrency}
                    <span className="block text-[10px] text-sky-800 font-bold">
                      {totalAssetsUSD > 0 ? Math.round((customerDuesUSD / totalAssetsUSD) * 100) : 0}% من الأصول
                    </span>
                  </div>
                </div>
              </div>
            </div>

            {/* Left: Net Profit & Debt Allocation (توزيع صافي الأرباح وسداد ديون الأصول) */}
            <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
              <div className="flex items-center justify-between border-b border-slate-100 pb-2">
                <div className="flex items-center gap-2">
                  <div className="p-1.5 bg-purple-50 text-purple-600 rounded-lg">
                    <TrendingUp className="w-4 h-4" />
                  </div>
                  <h4 className="font-extrabold text-slate-800 text-sm">الأرباح وسداد ديون تمويل المخزن</h4>
                </div>
                <span className="text-xs font-extrabold text-purple-700 bg-purple-50 px-2.5 py-1 rounded-lg">
                  صافي الأرباح: {formatAmount(netOperationalProfitUSD, systemCurrency, exchangeRates)} {systemCurrency}
                </span>
              </div>

              <div className="space-y-2 text-xs">
                {/* Repaid to Debts from Profit */}
                <div className="p-3 bg-red-50/40 rounded-xl border border-red-100/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-red-100 text-red-700 flex items-center justify-center font-bold">
                      <CreditCard className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">مبالغ تم توريدها وسدادها للديون من الأرباح</p>
                      <p className="text-[10px] text-slate-400">سداد التزامات شراء المخزن وتأسيس الأصول</p>
                    </div>
                  </div>
                  <div className="text-left font-black text-red-600 text-sm">
                    {formatAmount(profitPaidToDebtsUSD, systemCurrency, exchangeRates)} {systemCurrency}
                    <span className="block text-[10px] text-red-500 font-bold">تم سدادها للدائنين</span>
                  </div>
                </div>

                {/* Retained / Free Profit */}
                <div className="p-3 bg-emerald-50/40 rounded-xl border border-emerald-100/80 flex items-center justify-between">
                  <div className="flex items-center gap-2.5">
                    <div className="w-8 h-8 rounded-lg bg-emerald-100 text-emerald-700 flex items-center justify-center font-bold">
                      <Coins className="w-4 h-4" />
                    </div>
                    <div>
                      <p className="font-bold text-slate-800">صافي الأرباح المتبقية القابلة للتوزيع</p>
                      <p className="text-[10px] text-slate-400">بعد استقطاع دفعات سداد الديون الرأسمالية</p>
                    </div>
                  </div>
                  <div className="text-left font-black text-emerald-700 text-sm">
                    {formatAmount(retainedProfitUSD, systemCurrency, exchangeRates)} {systemCurrency}
                    <span className="block text-[10px] text-emerald-600 font-bold">أرباح حرة محتجزة</span>
                  </div>
                </div>

                {/* Inventory Coverage ratio */}
                <div className="p-3 bg-slate-50 rounded-xl border border-slate-200/60 flex items-center justify-between">
                  <div>
                    <p className="font-bold text-slate-800">نسبة تغطية قيمة المخزون للديون المتبقية</p>
                    <p className="text-[10px] text-slate-400">
                      قيمة المخزون ({formatAmount(totalInventoryCostUSD, systemCurrency, exchangeRates)}) مقابل ديون المخزن ({formatAmount(inventoryDebtsUSD, systemCurrency, exchangeRates)})
                    </p>
                  </div>
                  <div className="text-left font-black text-indigo-700 text-sm">
                    {inventoryDebtsUSD > 0 ? `${Math.round((totalInventoryCostUSD / inventoryDebtsUSD) * 100)}%` : '100% مغطى'}
                  </div>
                </div>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 2: CASHBOX & VAULT TREASURY                      */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'treasury' && (
        <div className="space-y-4" id="treasury-accounts-container">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <div className="flex items-center gap-2">
                  <Landmark className="w-5 h-5 text-emerald-600 shrink-0" />
                  <h3 className="font-extrabold text-slate-800 text-base">
                    الصندوق والخزينة
                  </h3>
                </div>

                {/* أيقونة بنص تعديل لحذف الصناديق أو تغيير الاسم أمام النص */}
                <button
                  type="button"
                  onClick={() => setIsEditAccountsModalOpen(true)}
                  className="flex items-center gap-1.5 px-3 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 border border-amber-300 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs active:scale-95"
                  title="تعديل وتغيير أسماء الصناديق أو حذفها"
                >
                  <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                  <span>تعديل</span>
                </button>

                {/* أيقونة جوار أيقونة تعديل لعرض الرصيد بالعملة الأصلية أو عملة التطبيق */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !showOriginalCurrency;
                    setShowOriginalCurrency(next);
                    toast.success(
                      next 
                        ? 'يتم الآن عرض الرصيد حسب عملة الإنشاء الأصلية' 
                        : `يتم الآن عرض الرصيد حسب عملة التطبيق الموحدة (${systemCurrency})`
                    );
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs border active:scale-95",
                    showOriginalCurrency
                      ? "bg-purple-600 text-white border-purple-700 shadow-sm ring-2 ring-purple-400/30"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                  )}
                  title={showOriginalCurrency ? "انقر للعودة لعملة التطبيق الموحدة" : "انقر لعرض الرصيد بعملة الإنشاء الأصلية لكل صندوق"}
                >
                  <Coins className={cn("w-3.5 h-3.5", showOriginalCurrency ? "text-amber-200" : "text-slate-500")} />
                  <span>{showOriginalCurrency ? 'العملة الأصلية (مفعلة)' : 'عرض بالعملة الأصلية'}</span>
                </button>
              </div>
              <p className="text-xs text-slate-400">إدارة النقد اليومي، الخزينة الحديدية، وتعديل وحذف الصناديق</p>
            </div>

            <ExportToolbar 
              targetElementId="treasury-accounts-container"
              filenamePrefix="كشف_الصندوق_والخزينة"
              title="كشف حسابات الصندوق والخزينة"
              getTextToCopy={getTreasuryText}
              showPrint={true}
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-3.5">
            {cashAccounts.map((acc) => (
              <div 
                key={acc.id} 
                className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3 relative hover:border-emerald-300 transition-colors"
              >
                <div className="flex items-center justify-between">
                  <div className="flex items-center gap-2">
                    <div className={cn(
                      "p-2 rounded-xl text-white font-bold",
                      acc.type === 'vault' ? "bg-amber-600" :
                      acc.type === 'bank' ? "bg-sky-500" :
                      acc.type === 'wallet' ? "bg-purple-600" : "bg-emerald-600"
                    )}>
                      {acc.type === 'vault' ? <ShieldCheck className="w-4 h-4" /> :
                       acc.type === 'bank' ? <Building2 className="w-4 h-4" /> :
                       acc.type === 'wallet' ? <CreditCard className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                    </div>
                    <div>
                      <div className="flex items-center gap-1.5">
                        <h4 className="font-bold text-slate-800 text-sm">{acc.name}</h4>
                        {(() => {
                          const accNotes = (notes || []).filter((n: any) => n.accountId && String(n.accountId) === String(acc.id));
                          return accNotes.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenNote) onOpenNote(accNotes[0]);
                              }}
                              className="h-5 px-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md transition-all border border-amber-300 flex items-center justify-center gap-1 text-[9px] font-black shadow-2xs cursor-pointer shrink-0 active:scale-95"
                              title={`ملاحظات الحساب (${accNotes.length})`}
                            >
                              <StickyNote className="w-3 h-3 text-yellow-600 shrink-0" />
                              <span>{accNotes.length}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onAddAccountNote) onAddAccountNote(String(acc.id), acc.name);
                              }}
                              className="w-5 h-5 bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-700 rounded-md transition-all border border-slate-200/80 flex items-center justify-center cursor-pointer shrink-0 active:scale-95"
                              title="إضافة ملاحظة لهذا الحساب"
                            >
                              <StickyNote className="w-3 h-3 shrink-0" />
                            </button>
                          );
                        })()}
                      </div>
                      <span className="text-[10px] text-slate-400 font-bold">
                        {acc.type === 'vault' ? 'خزينة احتياطية' :
                         acc.type === 'bank' ? 'حساب بنكي' :
                         acc.type === 'wallet' ? 'محفظة إلكترونية' : 'صندوق نقد يومي'}
                      </span>
                    </div>
                  </div>
                  {acc.isDefault && (
                    <span className="text-[10px] font-bold text-emerald-700 bg-emerald-50 px-2 py-0.5 rounded-md border border-emerald-200/60">
                      افتراضي
                    </span>
                  )}
                </div>

                <div className="bg-slate-50 p-3 rounded-xl border border-slate-100 flex items-center justify-between">
                  <div className="space-y-0.5">
                    <span className="text-xs font-bold text-slate-500 block">الرصيد الحالي:</span>
                    {!showOriginalCurrency && acc.currency !== systemCurrency && (
                      <span className="text-[10px] font-bold text-slate-400 block">
                        (الأصل: {(acc.balance || 0).toLocaleString()} {acc.currency})
                      </span>
                    )}
                    {showOriginalCurrency && (
                      <span className="text-[10px] font-bold text-purple-600 block">
                        (عملة الإنشاء الأصلية)
                      </span>
                    )}
                  </div>
                  <span className={cn(
                    "text-xl font-black",
                    showOriginalCurrency ? "text-purple-900" : "text-slate-800"
                  )}>
                    {showOriginalCurrency 
                      ? `${(acc.balance || 0).toLocaleString()} ` 
                      : `${convertAndRound(acc.balance || 0, acc.currency || 'RY', systemCurrency, exchangeRates).toLocaleString()} `
                    }
                    <span className={cn(
                      "text-xs font-bold",
                      showOriginalCurrency ? "text-purple-600" : "text-emerald-600"
                    )}>
                      {showOriginalCurrency ? (acc.currency || 'RY') : systemCurrency}
                    </span>
                  </span>
                  {!showOriginalCurrency && (acc.currency || 'RY') !== systemCurrency && (
                    <span className="text-[10px] text-slate-400 font-bold block text-left">
                      (الأصل: {(acc.balance || 0).toLocaleString()} {acc.currency || 'RY'})
                    </span>
                  )}
                </div>

                {acc.notes && (
                  <p className="text-[11px] text-slate-500 bg-slate-50/50 p-2 rounded-lg border border-slate-100/60">
                    {acc.notes}
                  </p>
                )}

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingAccount({ id: acc.id!, name: acc.name });
                      setEditAccountNameInput(acc.name);
                      setIsEditAccountsModalOpen(true);
                    }}
                    className="px-2.5 py-1.5 bg-amber-50 hover:bg-amber-100 text-amber-700 border border-amber-200/80 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="تعديل اسم هذا الصندوق"
                  >
                    <Edit3 className="w-3.5 h-3.5 text-amber-600" />
                    <span>تعديل</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => handleDeleteAccount(acc.id!, acc.name)}
                    className="px-2.5 py-1.5 bg-red-50 hover:bg-red-100 text-red-600 border border-red-200/80 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                    title="حذف هذا الصندوق"
                  >
                    <Trash2 className="w-3.5 h-3.5 text-red-600" />
                    <span>حذف</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => {
                      setTransferFromId(acc.id!);
                      setIsTransferModalOpen(true);
                    }}
                    className="flex-1 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-colors flex items-center justify-center gap-1 cursor-pointer"
                  >
                    <ArrowRightLeft className="w-3.5 h-3.5" />
                    <span>تحويل منه</span>
                  </button>
                </div>
              </div>
            ))}
          </div>

          {/* Internal Transfers History */}
          <div className="bg-white p-4 rounded-2xl border border-slate-200/80 shadow-xs space-y-3">
            <h4 className="font-extrabold text-slate-800 text-sm flex items-center gap-2">
              <History className="w-4 h-4 text-indigo-600" />
              <span>آخر حركات والتحويلات النقدية المسجلة</span>
            </h4>

            <div className="divide-y divide-slate-100">
              {transactions
                .filter(t => t.category.includes('تحويل') || t.sourceAccount || t.destinationAccount)
                .slice(0, 10)
                .map((t) => (
                  <div key={t.id} className="py-2.5 flex items-center justify-between text-xs">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full bg-indigo-50 text-indigo-600 flex items-center justify-center font-bold">
                        <ArrowRightLeft className="w-3 h-3" />
                      </div>
                      <div>
                        <p className="font-bold text-slate-800">{t.description}</p>
                        <p className="text-[10px] text-slate-400">{t.date}</p>
                      </div>
                    </div>
                    <span className="font-black text-slate-700">
                      {t.amount} {t.currency}
                    </span>
                  </div>
                ))}
              {transactions.filter(t => t.category.includes('تحويل') || t.sourceAccount).length === 0 && (
                <p className="text-xs text-slate-400 text-center py-4">لا توجد حركات تحويل مسجلة حتى الآن</p>
              )}
            </div>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* TAB 3: DEBTS & CAPITAL LIABILITIES                   */}
      {/* ---------------------------------------------------- */}
      {activeTab === 'debts' && (
        <div className="space-y-4" id="debts-accounts-container">
          <div className="flex flex-wrap items-center justify-between gap-3 bg-white p-3 rounded-2xl border border-slate-200/80 shadow-xs">
            <div className="space-y-1">
              <div className="flex flex-wrap items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-600 shrink-0" />

                {/* أيقونة لعرض الرصيد بالعملة الأصلية أو عملة التطبيق */}
                <button
                  type="button"
                  onClick={() => {
                    const next = !showOriginalCurrency;
                    setShowOriginalCurrency(next);
                    toast.success(
                      next 
                        ? 'يتم الآن عرض مبالغ الديون حسب عملة الإنشاء الأصلية' 
                        : `يتم الآن عرض مبالغ الديون حسب عملة التطبيق الموحدة (${systemCurrency})`
                    );
                  }}
                  className={cn(
                    "flex items-center gap-1.5 px-3 py-1.5 rounded-xl text-xs font-black transition-all cursor-pointer shadow-2xs border active:scale-95",
                    showOriginalCurrency
                      ? "bg-purple-600 text-white border-purple-700 shadow-sm ring-2 ring-purple-400/30"
                      : "bg-slate-100 hover:bg-slate-200 text-slate-700 border-slate-300"
                  )}
                  title={showOriginalCurrency ? "انقر للعودة لعملة التطبيق الموحدة" : "انقر لعرض المبالغ حسب عملة الإنشاء الأصلية"}
                >
                  <Coins className={cn("w-3.5 h-3.5", showOriginalCurrency ? "text-amber-200" : "text-slate-500")} />
                  <span>{showOriginalCurrency ? 'العملة الأصلية (مفعلة)' : `عملة التطبيق (${systemCurrency})`}</span>
                </button>

                <h3 className="font-extrabold text-slate-800 text-base">
                  حسابات الديون والالتزامات (تمويل المخزن والأصول)
                </h3>
              </div>
              <p className="text-xs text-slate-400">
                حسابات تم أخذ مبالغ منها لشراء البضاعة والأصول، مع إمكانية سدادها وتوريدها من صافي الأرباح
              </p>
            </div>

            <ExportToolbar 
              targetElementId="debts-accounts-container"
              filenamePrefix="ديون_تمويل_المخزن"
              title="كشف حسابات الديون والالتزامات"
              getTextToCopy={getDebtsText}
              showPrint={true}
            />
          </div>

          {/* Debts Summary Cards */}
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <div className="bg-blue-500/12 p-3.5 rounded-2xl border border-blue-200/80 shadow-xs">
              <span className="text-xs font-bold text-blue-700">إجمالي المبالغ المقترضة للأصول</span>
              <p className="text-xl font-black text-slate-950 mt-1">
                {formatAmount(totalDebtsUSD, systemCurrency, exchangeRates)} {systemCurrency}
              </p>
            </div>

            <div className="bg-emerald-500/12 p-3.5 rounded-2xl border border-emerald-200/80 shadow-xs">
              <span className="text-xs font-bold text-emerald-700">إجمالي ما تم سداده وتوريده</span>
              <p className="text-xl font-black text-slate-950 mt-1">
                {formatAmount(totalPaidDebtsUSD, systemCurrency, exchangeRates)} {systemCurrency}
              </p>
            </div>

            <div className="bg-red-500/20 p-3.5 rounded-2xl border border-red-300/80 shadow-xs">
              <span className="text-xs font-bold text-red-700">المتبقي الواجب سداده للدائنين</span>
              <p className="text-xl font-black text-slate-950 mt-1">
                {formatAmount(remainingDebtsUSD, systemCurrency, exchangeRates)} {systemCurrency}
              </p>
            </div>
          </div>

          {/* Debts List */}
          <div className="space-y-3">
            {debtAccounts.map((debt) => {
              const remaining = Math.max(0, debt.totalAmount - (debt.paidAmount || 0));
              const progressPercent = Math.min(100, Math.round(((debt.paidAmount || 0) / debt.totalAmount) * 100));
              const isSettled = debt.status === 'settled' || remaining === 0;

              return (
                <div 
                  key={debt.id} 
                  className={cn(
                    "bg-white p-4 rounded-2xl border transition-all shadow-xs space-y-3",
                    isSettled ? "border-emerald-200 bg-emerald-50/10" : "border-amber-200 hover:border-amber-400"
                  )}
                >
                  <div className="flex flex-wrap items-start justify-between gap-2">
                    <div className="space-y-1">
                      <div className="flex items-center gap-2">
                        <h4 className="font-extrabold text-slate-900 text-base">{debt.name}</h4>
                        {(() => {
                          const debtNotes = (notes || []).filter((n: any) => n.accountId && String(n.accountId) === String(debt.id));
                          return debtNotes.length > 0 ? (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onOpenNote) onOpenNote(debtNotes[0]);
                              }}
                              className="h-5 px-1.5 bg-amber-50 hover:bg-amber-100 text-amber-800 rounded-md transition-all border border-amber-300 flex items-center justify-center gap-1 text-[9px] font-black shadow-2xs cursor-pointer shrink-0 active:scale-95"
                              title={`ملاحظات الدين (${debtNotes.length})`}
                            >
                              <StickyNote className="w-3 h-3 text-yellow-600 shrink-0" />
                              <span>{debtNotes.length}</span>
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={(e) => {
                                e.stopPropagation();
                                if (onAddAccountNote) onAddAccountNote(String(debt.id), debt.name);
                              }}
                              className="w-5 h-5 bg-slate-50 hover:bg-amber-50 text-slate-400 hover:text-amber-700 rounded-md transition-all border border-slate-200/80 flex items-center justify-center cursor-pointer shrink-0 active:scale-95"
                              title="إضافة ملاحظة لهذا الحساب"
                            >
                              <StickyNote className="w-3 h-3 shrink-0" />
                            </button>
                          );
                        })()}
                        <span className={cn(
                          "text-[10px] font-bold px-2.5 py-0.5 rounded-full border",
                          isSettled ? "bg-emerald-100 text-emerald-800 border-emerald-200" : "bg-amber-100 text-amber-800 border-amber-200"
                        )}>
                          {isSettled ? '✅ تم السداد بالكامل' : '⏳ نشط ومستحق'}
                        </span>
                      </div>
                      <p className="text-xs text-slate-500 font-bold flex items-center gap-2">
                        <span>الدائن: <strong className="text-slate-800">{debt.creditorName}</strong></span>
                        {debt.phone && <span className="text-slate-400">| هاتف: {debt.phone}</span>}
                        <span className="text-indigo-600 bg-indigo-50 px-2 py-0.5 rounded-md border border-indigo-100">
                          {debt.purpose}
                        </span>
                      </p>
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        onClick={() => setViewingDebtStatement(debt)}
                        className="px-3 py-1.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all flex items-center gap-1 cursor-pointer"
                      >
                        <FileText className="w-3.5 h-3.5 text-blue-600" />
                        <span>كشف الحساب ({debt.payments?.length || 0})</span>
                      </button>

                      {!isSettled && (
                        <button
                          type="button"
                          onClick={() => {
                            setSelectedDebtAccount(debt);
                            setIsDebtPaymentModalOpen(true);
                          }}
                          className="px-3.5 py-1.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold transition-all flex items-center gap-1.5 shadow-xs cursor-pointer"
                        >
                          <Plus className="w-3.5 h-3.5" />
                          <span>سداد دفعة من الأرباح</span>
                        </button>
                      )}
                    </div>
                  </div>

                  {/* Financial numbers & Progress Bar */}
                  <div className="grid grid-cols-3 gap-2 p-2.5 rounded-xl text-center text-xs">
                    <div className="p-1.5 rounded-lg bg-blue-500/12 border border-blue-200/80">
                      <span className="text-[10px] text-blue-700 font-bold">المبلغ الكلي</span>
                      <p className="font-black text-slate-950">
                        {showOriginalCurrency 
                          ? `${debt.totalAmount.toLocaleString()} ${debt.currency || 'RY'}`
                          : `${convertAndRound(debt.totalAmount, debt.currency || 'RY', systemCurrency, exchangeRates).toLocaleString()} ${systemCurrency}`
                        }
                      </p>
                      {!showOriginalCurrency && (debt.currency || 'RY') !== systemCurrency && (
                        <span className="text-[9px] text-slate-400 font-bold block">
                          (الأصل: {debt.totalAmount.toLocaleString()} {debt.currency || 'RY'})
                        </span>
                      )}
                    </div>
                    <div className="p-1.5 rounded-lg bg-emerald-500/12 border border-emerald-200/80">
                      <span className="text-[10px] text-emerald-700 font-bold">المسدد حتى الآن</span>
                      <p className="font-black text-slate-950">
                        {showOriginalCurrency 
                          ? `${(debt.paidAmount || 0).toLocaleString()} ${debt.currency || 'RY'}`
                          : `${convertAndRound(debt.paidAmount || 0, debt.currency || 'RY', systemCurrency, exchangeRates).toLocaleString()} ${systemCurrency}`
                        }
                      </p>
                    </div>
                    <div className="p-1.5 rounded-lg bg-red-500/20 border border-red-300/80">
                      <span className="text-[10px] text-red-700 font-bold">المتبقي المطلوب</span>
                      <p className="font-black text-slate-950">
                        {showOriginalCurrency 
                          ? `${remaining.toLocaleString()} ${debt.currency || 'RY'}`
                          : `${convertAndRound(remaining, debt.currency || 'RY', systemCurrency, exchangeRates).toLocaleString()} ${systemCurrency}`
                        }
                      </p>
                    </div>
                  </div>

                  {/* Progress Line */}
                  <div className="space-y-1">
                    <div className="flex justify-between text-[10px] font-bold text-slate-400">
                      <span>نسبة السداد: {progressPercent}%</span>
                      {debt.dueDate && <span>تاريخ الاستحقاق: {debt.dueDate}</span>}
                    </div>
                    <div className="w-full bg-slate-100 rounded-full h-2 overflow-hidden">
                      <div 
                        className={cn("h-full transition-all duration-500", isSettled ? "bg-emerald-500" : "bg-amber-500")}
                        style={{ width: `${progressPercent}%` }}
                      />
                    </div>
                  </div>
                </div>
              );
            })}

            {debtAccounts.length === 0 && (
              <div className="p-8 text-center bg-white rounded-2xl border border-dashed border-slate-200 text-slate-400 space-y-2">
                <CreditCard className="w-8 h-8 mx-auto text-slate-300" />
                <p className="text-sm font-bold">لا توجد حسابات ديون مسجلة لتمويل المخزن أو الأصول</p>
                <p className="text-xs text-slate-400">يمكنك إضافة حساب دين لتوثيق المبالغ المأخوذة لشراء البضاعة وسدادها من صافي الأرباح</p>
              </div>
            )}
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: Add Cashbox / Vault Account                   */}
      {/* ---------------------------------------------------- */}
      {isAddAccountModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <Landmark className="w-5 h-5 text-emerald-600" />
                <span>إضافة صندوق أو خزينة جديدة</span>
              </h3>
              <button onClick={() => setIsAddAccountModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateAccount} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">اسم الحساب / الصندوق *</label>
                <input
                  type="text"
                  required
                  placeholder="مثال: الصندوق الرئيسي، الخزينة الفرعية، حساب الكريمي"
                  value={newAccountName}
                  onChange={(e) => setNewAccountName(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800"
                />
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">نوع الحساب</label>
                  <select
                    value={newAccountType}
                    onChange={(e) => setNewAccountType(e.target.value as any)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800"
                  >
                    <option value="cashbox">صندوق نقد يومي</option>
                    <option value="vault">خزينة احتياطية</option>
                    <option value="bank">حساب بنكي</option>
                    <option value="wallet">محفظة إلكترونية</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">العملة</label>
                  <select
                    value={newAccountCurrency}
                    onChange={(e) => setNewAccountCurrency(e.target.value as Currency)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800"
                  >
                    <option value="RY">ريال يمني (RY)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">الرصيد الافتتاحي</label>
                <input
                  type="number"
                  min="0"
                  step="any"
                  placeholder="0"
                  value={newAccountBalance}
                  onChange={(e) => setNewAccountBalance(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">ملاحظات / بيان</label>
                <input
                  type="text"
                  placeholder="بيان وملاحظات اختيارية عن الحساب وموقعه"
                  value={newAccountNotes}
                  onChange={(e) => setNewAccountNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer"
                >
                  حفظ الحساب
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddAccountModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: Internal Cash Transfer                        */}
      {/* ---------------------------------------------------- */}
      {isTransferModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <ArrowRightLeft className="w-5 h-5 text-indigo-600" />
                <span>تحويل نقدي داخلي بين الصناديق</span>
              </h3>
              <button onClick={() => setIsTransferModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleTransfer} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">تحويل من حساب (المصدر) *</label>
                <select
                  required
                  value={transferFromId}
                  onChange={(e) => setTransferFromId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                >
                  <option value="">-- اختر الحساب المصدر --</option>
                  {cashAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (الرصيد: {a.balance} {a.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">تحويل إلى حساب (الوجهة) *</label>
                <select
                  required
                  value={transferToId}
                  onChange={(e) => setTransferToId(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                >
                  <option value="">-- اختر حساب الوجهة --</option>
                  {cashAccounts.map(a => (
                    <option key={a.id} value={a.id}>
                      {a.name} (الرصيد: {a.balance} {a.currency})
                    </option>
                  ))}
                </select>
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">المبلغ المراد تحويله *</label>
                <input
                  type="number"
                  required
                  min="1"
                  step="any"
                  placeholder="0"
                  value={transferAmount}
                  onChange={(e) => setTransferAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 font-bold text-slate-800"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">بيان / سبب التحويل</label>
                <input
                  type="text"
                  placeholder="مثال: توريد إيرادات اليوم إلى الخزينة الرئيسية"
                  value={transferNotes}
                  onChange={(e) => setTransferNotes(e.target.value)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-indigo-500 text-slate-800"
                />
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-indigo-600 hover:bg-indigo-700 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer"
                >
                  تأكيد التحويل
                </button>
                <button
                  type="button"
                  onClick={() => setIsTransferModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: Add Debt / Capital Financing Account          */}
      {/* ---------------------------------------------------- */}
      {isAddDebtModalOpen && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-lg p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                <CreditCard className="w-5 h-5 text-amber-600" />
                <span>إضافة حساب دين لتمويل المخزن والأصول</span>
              </h3>
              <button onClick={() => setIsAddDebtModalOpen(false)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleCreateDebt} className="space-y-3 text-xs">
              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">اسم حساب الدين / المسمى *</label>
                  <input
                    type="text"
                    required
                    placeholder="مثال: دين تمويل بضاعة شهر مارس"
                    value={newDebtName}
                    onChange={(e) => setNewDebtName(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">اسم الدائن / الممول / المورد *</label>
                  <input
                    type="text"
                    required
                    placeholder="اسم الشخص أو الشركة الموردة"
                    value={newDebtCreditor}
                    onChange={(e) => setNewDebtCreditor(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-3 gap-3">
                <div className="space-y-1 col-span-2">
                  <label className="font-bold text-slate-700">المبلغ الإجمالي المقترض *</label>
                  <input
                    type="number"
                    required
                    min="1"
                    step="any"
                    placeholder="0"
                    value={newDebtTotal}
                    onChange={(e) => setNewDebtTotal(e.target.value === '' ? '' : Number(e.target.value))}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">العملة</label>
                  <select
                    value={newDebtCurrency}
                    onChange={(e) => setNewDebtCurrency(e.target.value as Currency)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-800"
                  >
                    <option value="RY">ريال يمني (RY)</option>
                    <option value="SAR">ريال سعودي (SAR)</option>
                    <option value="USD">دولار أمريكي (USD)</option>
                  </select>
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">غرض التمويل</label>
                  <select
                    value={newDebtPurpose}
                    onChange={(e) => setNewDebtPurpose(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 font-bold text-slate-800"
                  >
                    <option value="تمويل شراء بضاعة ومخزون">تمويل شراء بضاعة ومخزون</option>
                    <option value="شراء أجهزة ومعدات صيانة (أصول)">شراء أجهزة ومعدات صيانة (أصول)</option>
                    <option value="تمويل رأس مال تأسيسي">تمويل رأس مال تأسيسي</option>
                    <option value="مستحقات مورد قطع غيار">مستحقات مورد قطع غيار</option>
                    <option value="أخرى">أخرى</option>
                  </select>
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">رقم الهاتف (اختياري)</label>
                  <input
                    type="tel"
                    placeholder="رقم للتواصل"
                    value={newDebtPhone}
                    onChange={(e) => setNewDebtPhone(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">تاريخ الاستحقاق المتوقع</label>
                  <input
                    type="date"
                    value={newDebtDueDate}
                    onChange={(e) => setNewDebtDueDate(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">ملاحظات إضافية</label>
                  <input
                    type="text"
                    placeholder="شروط السداد أو تفاصيل البضاعة"
                    value={newDebtNotes}
                    onChange={(e) => setNewDebtNotes(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-amber-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-amber-600 hover:bg-amber-700 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer"
                >
                  تسجيل حساب الدين
                </button>
                <button
                  type="button"
                  onClick={() => setIsAddDebtModalOpen(false)}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: Pay Debt Installment from Net Profit / Cash   */}
      {/* ---------------------------------------------------- */}
      {isDebtPaymentModalOpen && selectedDebtAccount && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-md p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <Coins className="w-5 h-5 text-emerald-600" />
                  <span>توريد وسداد دفعة من الدين</span>
                </h3>
                <p className="text-xs text-slate-400">
                  {selectedDebtAccount.name} ({selectedDebtAccount.creditorName})
                </p>
              </div>
              <button 
                onClick={() => {
                  setIsDebtPaymentModalOpen(false);
                  setSelectedDebtAccount(null);
                }} 
                className="text-slate-400 hover:text-slate-600"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="bg-amber-50 p-3 rounded-xl border border-amber-100/80 flex justify-between items-center text-xs">
              <span className="font-bold text-amber-800">المبلغ المتبقي المطلوب سداده:</span>
              <span className="font-black text-amber-900 text-base">
                {selectedDebtAccount.totalAmount - (selectedDebtAccount.paidAmount || 0)} {selectedDebtAccount.currency}
              </span>
            </div>

            <form onSubmit={handleAddDebtPayment} className="space-y-3 text-xs">
              <div className="space-y-1">
                <label className="font-bold text-slate-700">مبلغ الدفعة المسددة *</label>
                <input
                  type="number"
                  required
                  min="1"
                  max={selectedDebtAccount.totalAmount - (selectedDebtAccount.paidAmount || 0)}
                  step="any"
                  placeholder="0"
                  value={paymentAmount}
                  onChange={(e) => setPaymentAmount(e.target.value === '' ? '' : Number(e.target.value))}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800 text-sm"
                />
              </div>

              <div className="space-y-1">
                <label className="font-bold text-slate-700">مصدر سداد وتوريد المبلغ *</label>
                <select
                  value={paymentSource}
                  onChange={(e) => setPaymentSource(e.target.value as any)}
                  className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 font-bold text-slate-800"
                >
                  <option value="net_profit">💎 سداد مخصوم من صافي الأرباح (تحسين المركز المالي)</option>
                  <option value="cashbox">💵 خصم من رصيد الصندوق اليومي الرئيسي</option>
                  <option value="vault">🏦 خصم من رصيد الخزينة الاحتياطية</option>
                  <option value="other">سداد من مصدر خارجي</option>
                </select>
                <p className="text-[10px] text-slate-400">
                  {paymentSource === 'net_profit' && 'سيتم احتساب هذا المبلغ كتوريد مسدد من أرباح النشاط لتخفيض الالتزام وزيادة صافي رأس المال.'}
                  {paymentSource === 'cashbox' && 'سيتم خصم المبلغ مباشرة من رصيد الصندوق اليومي وتسجيل سند صرف.'}
                  {paymentSource === 'vault' && 'سيتم خصم المبلغ من رصيد الخزينة الاحتياطية وتسجيل سند صرف.'}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-3">
                <div className="space-y-1">
                  <label className="font-bold text-slate-700">رقم السند / الإيصال</label>
                  <input
                    type="text"
                    placeholder="رقم تلقائي أو يدوي"
                    value={paymentReceiptNo}
                    onChange={(e) => setPaymentReceiptNo(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                  />
                </div>

                <div className="space-y-1">
                  <label className="font-bold text-slate-700">ملاحظات الدفعة</label>
                  <input
                    type="text"
                    placeholder="ملاحظات أو طريقة التحويل"
                    value={paymentNotes}
                    onChange={(e) => setPaymentNotes(e.target.value)}
                    className="w-full p-2.5 bg-slate-50 border border-slate-200 rounded-xl outline-none focus:ring-2 focus:ring-emerald-500 text-slate-800"
                  />
                </div>
              </div>

              <div className="flex gap-2 pt-2">
                <button
                  type="submit"
                  className="flex-1 py-2.5 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl font-bold transition-all shadow-xs cursor-pointer"
                >
                  اعتماد السداد وتوريد الدفعة
                </button>
                <button
                  type="button"
                  onClick={() => {
                    setIsDebtPaymentModalOpen(false);
                    setSelectedDebtAccount(null);
                  }}
                  className="px-4 py-2.5 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl font-bold transition-all cursor-pointer"
                >
                  إلغاء
                </button>
              </div>
            </form>
          </div>
        </div>
      )}

      {/* ---------------------------------------------------- */}
      {/* MODAL: View Debt Statement (كشف حساب الدين مع تصدير)  */}
      {/* ---------------------------------------------------- */}
      {viewingDebtStatement && (
        <div className="fixed inset-0 z-[70] bg-black/50 backdrop-blur-xs flex items-center justify-center p-4">
          <div className="bg-white rounded-2xl w-full max-w-2xl p-5 space-y-4 shadow-2xl animate-in fade-in zoom-in-95 duration-200 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="space-y-0.5">
                <h3 className="font-extrabold text-slate-800 text-base flex items-center gap-2">
                  <FileText className="w-5 h-5 text-blue-600" />
                  <span>كشف حساب وسجل سداد الدين: {viewingDebtStatement.name}</span>
                </h3>
                <p className="text-xs text-slate-400">
                  الدائن: {viewingDebtStatement.creditorName} {viewingDebtStatement.phone && `(${viewingDebtStatement.phone})`}
                </p>
              </div>
              <button onClick={() => setViewingDebtStatement(null)} className="text-slate-400 hover:text-slate-600">
                <X className="w-5 h-5" />
              </button>
            </div>

            {/* Statement Container to export */}
            <div id="debt-statement-print-area" className="p-4 bg-white rounded-xl border border-slate-100 space-y-4">
              <div className="flex flex-wrap items-center justify-between gap-2 border-b border-slate-100 pb-3">
                <div>
                  <h4 className="font-extrabold text-slate-800 text-base">{viewingDebtStatement.name}</h4>
                  <p className="text-xs text-slate-500">الغرض: {viewingDebtStatement.purpose}</p>
                </div>
                <div className="text-left">
                  <span className="text-xs font-bold text-slate-400">الحالة: </span>
                  <span className={cn(
                    "text-xs font-black px-2 py-0.5 rounded-md border",
                    viewingDebtStatement.status === 'settled' ? "bg-emerald-50 text-emerald-700 border-emerald-200" : "bg-amber-50 text-amber-700 border-amber-200"
                  )}>
                    {viewingDebtStatement.status === 'settled' ? 'مسدد بالكامل' : 'نشط'}
                  </span>
                </div>
              </div>

              {/* Debt Totals Bar */}
              <div className="grid grid-cols-3 gap-2 p-3 rounded-xl text-center text-xs">
                <div className="p-2 rounded-lg bg-blue-500/12 border border-blue-200/80">
                  <span className="text-blue-700 font-bold text-[10px]">المبلغ الكلي</span>
                  <p className="font-black text-slate-950 text-sm mt-0.5">
                    {viewingDebtStatement.totalAmount} {viewingDebtStatement.currency}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-emerald-500/12 border border-emerald-200/80">
                  <span className="text-emerald-700 font-bold text-[10px]">إجمالي المسدد</span>
                  <p className="font-black text-slate-950 text-sm mt-0.5">
                    {viewingDebtStatement.paidAmount || 0} {viewingDebtStatement.currency}
                  </p>
                </div>
                <div className="p-2 rounded-lg bg-red-500/20 border border-red-300/80">
                  <span className="text-red-700 font-bold text-[10px]">المتبقي المطلوب</span>
                  <p className="font-black text-slate-950 text-sm mt-0.5">
                    {Math.max(0, viewingDebtStatement.totalAmount - (viewingDebtStatement.paidAmount || 0))} {viewingDebtStatement.currency}
                  </p>
                </div>
              </div>

              {/* Payments Table */}
              <div className="space-y-2">
                <h5 className="font-bold text-slate-700 text-xs flex items-center gap-1.5">
                  <History className="w-3.5 h-3.5 text-indigo-600" />
                  <span>جدول الدفعات المسددة ({viewingDebtStatement.payments?.length || 0})</span>
                </h5>

                <table className="w-full text-right text-xs border border-slate-100 rounded-xl overflow-hidden">
                  <thead className="bg-slate-50 text-slate-600 font-bold border-b border-slate-100">
                    <tr>
                      <th className="p-2">#</th>
                      <th className="p-2">التاريخ</th>
                      <th className="p-2">المبلغ</th>
                      <th className="p-2">المصدر</th>
                      <th className="p-2">رقم الإيصال</th>
                      <th className="p-2">ملاحظات</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-slate-100 font-medium">
                    {(viewingDebtStatement.payments || []).map((pay, i) => (
                      <tr key={pay.id || i} className="hover:bg-slate-50/50">
                        <td className="p-2 font-bold text-slate-400">{i + 1}</td>
                        <td className="p-2">{pay.date}</td>
                        <td className="p-2 font-bold text-emerald-600">{pay.amount} {pay.currency}</td>
                        <td className="p-2">
                          <span className="bg-slate-100 text-slate-700 px-2 py-0.5 rounded text-[10px] font-bold">
                            {pay.source === 'net_profit' ? 'صافي الأرباح' :
                             pay.source === 'cashbox' ? 'الصندوق' :
                             pay.source === 'vault' ? 'الخزينة' : 'أخرى'}
                          </span>
                        </td>
                        <td className="p-2 font-mono text-[11px] text-slate-500">{pay.receiptNumber || '-'}</td>
                        <td className="p-2 text-slate-500">{pay.note || '-'}</td>
                      </tr>
                    ))}
                    {(viewingDebtStatement.payments || []).length === 0 && (
                      <tr>
                        <td colSpan={6} className="p-4 text-center text-slate-400">لا توجد دفعات مسددة حتى الآن</td>
                      </tr>
                    )}
                  </tbody>
                </table>
              </div>
            </div>

            {/* Export Toolbar for Statement */}
            <div className="flex justify-between items-center pt-2">
              <ExportToolbar 
                targetElementId="debt-statement-print-area"
                filenamePrefix={`كشف_دين_${viewingDebtStatement.name}`}
                title={`كشف حساب دين ${viewingDebtStatement.name}`}
                getTextToCopy={() => {
                  let t = `📄 *كشف حساب دين: ${viewingDebtStatement.name}*\n`;
                  t += `👤 الدائن: ${viewingDebtStatement.creditorName}\n`;
                  t += `🎯 الغرض: ${viewingDebtStatement.purpose}\n`;
                  t += `💵 المبلغ الأصلي: ${viewingDebtStatement.totalAmount} ${viewingDebtStatement.currency}\n`;
                  t += `🟢 المسدد: ${viewingDebtStatement.paidAmount || 0} ${viewingDebtStatement.currency}\n`;
                  t += `🔴 المتبقي: ${viewingDebtStatement.totalAmount - (viewingDebtStatement.paidAmount || 0)} ${viewingDebtStatement.currency}\n`;
                  t += `━━━━━━━━━━━━━━━━━━━━\nالدفعات المسددة:\n`;
                  (viewingDebtStatement.payments || []).forEach((p, idx) => {
                    t += `${idx + 1}. تاريخ: ${p.date} | مبلغ: ${p.amount} ${p.currency} | مصدر: ${p.source} | إيصال: ${p.receiptNumber || '-'}\n`;
                  });
                  return t;
                }}
                showPrint={true}
              />

              <button
                type="button"
                onClick={() => setViewingDebtStatement(null)}
                className="px-4 py-2 bg-slate-100 hover:bg-slate-200 text-slate-700 rounded-xl text-xs font-bold transition-all cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}

      {/* MODAL: إدارة وتعديل الصناديق والخزائن (حذف وتغيير الأسماء) */}
      {isEditAccountsModalOpen && (
        <div className="fixed inset-0 bg-black/60 backdrop-blur-xs flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-3xl w-full max-w-lg p-6 shadow-2xl space-y-4 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between border-b border-slate-100 pb-3">
              <div className="flex items-center gap-2">
                <div className="p-2 bg-amber-50 text-amber-600 rounded-xl">
                  <Edit3 className="w-5 h-5" />
                </div>
                <div>
                  <h3 className="font-black text-slate-800 text-base">إدارة وتعديل الصناديق والخزائن</h3>
                  <p className="text-xs text-slate-500 font-bold">تغيير أسماء الصناديق والخزائن أو حذفها من النظام</p>
                </div>
              </div>
              <button 
                type="button"
                onClick={() => {
                  setIsEditAccountsModalOpen(false);
                  setEditingAccount(null);
                }} 
                className="text-slate-400 hover:text-slate-600 p-1.5 rounded-lg hover:bg-slate-100 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="space-y-3">
              {cashAccounts.map((acc) => {
                const isCurrentEditing = editingAccount?.id === acc.id;
                return (
                  <div 
                    key={acc.id} 
                    className={cn(
                      "p-3.5 rounded-2xl border transition-all space-y-2.5",
                      isCurrentEditing ? "border-amber-400 bg-amber-50/40 shadow-xs" : "border-slate-200 bg-slate-50/70"
                    )}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2">
                        <div className={cn(
                          "p-2 rounded-xl text-white font-bold text-xs shrink-0",
                          acc.type === 'vault' ? "bg-amber-600" :
                          acc.type === 'bank' ? "bg-sky-500" :
                          acc.type === 'wallet' ? "bg-purple-600" : "bg-emerald-600"
                        )}>
                          {acc.type === 'vault' ? <ShieldCheck className="w-4 h-4" /> :
                           acc.type === 'bank' ? <Building2 className="w-4 h-4" /> :
                           acc.type === 'wallet' ? <CreditCard className="w-4 h-4" /> : <Wallet className="w-4 h-4" />}
                        </div>
                        <div>
                          <div className="flex items-center gap-1.5">
                            <span className="font-extrabold text-slate-800 text-sm">{acc.name}</span>
                            {acc.isDefault && (
                              <span className="text-[10px] font-bold text-emerald-700 bg-emerald-100/80 px-2 py-0.5 rounded-md">
                                افتراضي
                              </span>
                            )}
                          </div>
                          <span className="text-[11px] font-bold text-slate-500 block">
                            الرصيد: {acc.balance} {acc.currency}
                          </span>
                        </div>
                      </div>

                      <div className="flex items-center gap-1.5 shrink-0">
                        {!isCurrentEditing && (
                          <button
                            type="button"
                            onClick={() => {
                              setEditingAccount({ id: acc.id!, name: acc.name });
                              setEditAccountNameInput(acc.name);
                            }}
                            className="px-2.5 py-1.5 bg-amber-100 hover:bg-amber-200 text-amber-800 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          >
                            <Edit3 className="w-3.5 h-3.5" />
                            <span>تغيير الاسم</span>
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleDeleteAccount(acc.id!, acc.name)}
                          className="px-2.5 py-1.5 bg-red-100 hover:bg-red-200 text-red-700 rounded-xl text-xs font-bold flex items-center gap-1 transition-colors cursor-pointer"
                          title="حذف هذا الصندوق نهائياً"
                        >
                          <Trash2 className="w-3.5 h-3.5" />
                          <span>حذف</span>
                        </button>
                      </div>
                    </div>

                    {isCurrentEditing && (
                      <div className="pt-2 border-t border-amber-200/80 flex items-center gap-2">
                        <input
                          type="text"
                          value={editAccountNameInput}
                          onChange={(e) => setEditAccountNameInput(e.target.value)}
                          placeholder="اكتب الاسم الجديد للصندوق..."
                          className="flex-1 p-2 bg-white border border-amber-300 rounded-xl text-xs font-bold text-slate-800 outline-none focus:ring-2 focus:ring-amber-500"
                          autoFocus
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              e.preventDefault();
                              handleUpdateAccountName(acc.id!, editAccountNameInput);
                            }
                          }}
                        />
                        <button
                          type="button"
                          onClick={() => handleUpdateAccountName(acc.id!, editAccountNameInput)}
                          className="px-3 py-2 bg-emerald-600 hover:bg-emerald-700 text-white rounded-xl text-xs font-bold shadow-xs transition-colors cursor-pointer"
                        >
                          حفظ الاسم
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingAccount(null)}
                          className="px-2.5 py-2 bg-slate-200 hover:bg-slate-300 text-slate-700 rounded-xl text-xs font-bold transition-colors cursor-pointer"
                        >
                          إلغاء
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}
            </div>

            <div className="pt-3 border-t border-slate-100 flex justify-between items-center gap-2">
              <button
                type="button"
                onClick={() => {
                  setIsEditAccountsModalOpen(false);
                  setIsAddAccountModalOpen(true);
                }}
                className="px-3.5 py-2 bg-emerald-50 hover:bg-emerald-100 text-emerald-700 border border-emerald-200 rounded-xl text-xs font-black flex items-center gap-1.5 transition-colors cursor-pointer"
              >
                <Plus className="w-4 h-4" />
                <span>إضافة صندوق أو خزينة جديدة</span>
              </button>

              <button
                type="button"
                onClick={() => {
                  setIsEditAccountsModalOpen(false);
                  setEditingAccount(null);
                }}
                className="px-5 py-2 bg-slate-800 hover:bg-slate-900 text-white rounded-xl text-xs font-black transition-colors cursor-pointer"
              >
                إغلاق
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};
export default FinancialsManager;
