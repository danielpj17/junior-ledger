'use client';

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';

interface Entry {
  id: string;
  amount: number;
}

interface TAccountProps {
  id: string;
  defaultTitle?: string;
  onRemove?: () => void;
}

export default function TAccount({ id, defaultTitle = 'Account', onRemove }: TAccountProps) {
  const [title, setTitle] = useState(defaultTitle);
  const [debitEntries, setDebitEntries] = useState<Entry[]>([]);
  const [creditEntries, setCreditEntries] = useState<Entry[]>([]);

  const addDebitEntry = () => {
    const newEntry: Entry = {
      id: `debit-${Date.now()}-${Math.random()}`,
      amount: 0,
    };
    setDebitEntries([...debitEntries, newEntry]);
  };

  const addCreditEntry = () => {
    const newEntry: Entry = {
      id: `credit-${Date.now()}-${Math.random()}`,
      amount: 0,
    };
    setCreditEntries([...creditEntries, newEntry]);
  };

  const updateEntry = (entryId: string, amount: number, isDebit: boolean) => {
    if (isDebit) {
      setDebitEntries(
        debitEntries.map((entry) =>
          entry.id === entryId ? { ...entry, amount } : entry
        )
      );
    } else {
      setCreditEntries(
        creditEntries.map((entry) =>
          entry.id === entryId ? { ...entry, amount } : entry
        )
      );
    }
  };

  const removeEntry = (entryId: string, isDebit: boolean) => {
    if (isDebit) {
      setDebitEntries(debitEntries.filter((entry) => entry.id !== entryId));
    } else {
      setCreditEntries(creditEntries.filter((entry) => entry.id !== entryId));
    }
  };

  const totalDebit = debitEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const totalCredit = creditEntries.reduce((sum, entry) => sum + entry.amount, 0);
  const netBalance = Math.abs(totalDebit - totalCredit);
  const balanceType = totalDebit > totalCredit ? 'Debit' : totalDebit < totalCredit ? 'Credit' : '';

  const formatCurrency = (amount: number) => {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: 'USD',
      minimumFractionDigits: 2,
    }).format(amount);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="bg-white rounded-lg shadow-lg border border-gray-200 p-6"
    >
      {/* Header */}
      <div className="flex items-center justify-between mb-4">
        <input
          type="text"
          value={title}
          onChange={(e) => setTitle(e.target.value)}
          className="text-xl font-bold text-[#002E5D] bg-transparent border-b-2 border-transparent hover:border-gray-300 focus:border-[#002E5D] focus:outline-none transition-colors"
          placeholder="Account Name"
        />
        {onRemove && (
          <button
            onClick={onRemove}
            className="p-2 text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            aria-label="Remove account"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* T-Account Structure */}
      <div className="flex border-2 border-[#002E5D] rounded-lg overflow-hidden">
        {/* Debit Column */}
        <div className="flex-1 border-r-2 border-[#002E5D]">
          <div className="bg-[#002E5D] text-white text-center py-2 font-semibold">
            Debit
          </div>
          <div className="min-h-[200px] p-3 space-y-2">
            {debitEntries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2">
                <input
                  type="number"
                  value={entry.amount || ''}
                  onChange={(e) =>
                    updateEntry(entry.id, parseFloat(e.target.value) || 0, true)
                  }
                  className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#002E5D] text-right"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
                <button
                  onClick={() => removeEntry(entry.id, true)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  aria-label="Remove entry"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={addDebitEntry}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded hover:border-[#002E5D] hover:bg-[#002E5D]/5 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-[#002E5D]"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>
          <div className="border-t-2 border-[#002E5D] bg-gray-50 px-3 py-2 text-right font-semibold">
            {formatCurrency(totalDebit)}
          </div>
        </div>

        {/* Credit Column */}
        <div className="flex-1">
          <div className="bg-[#002E5D] text-white text-center py-2 font-semibold">
            Credit
          </div>
          <div className="min-h-[200px] p-3 space-y-2">
            {creditEntries.map((entry) => (
              <div key={entry.id} className="flex items-center gap-2">
                <input
                  type="number"
                  value={entry.amount || ''}
                  onChange={(e) =>
                    updateEntry(entry.id, parseFloat(e.target.value) || 0, false)
                  }
                  className="flex-1 px-2 py-1 border border-gray-300 rounded focus:outline-none focus:ring-2 focus:ring-[#002E5D] text-right"
                  placeholder="0.00"
                  step="0.01"
                  min="0"
                />
                <button
                  onClick={() => removeEntry(entry.id, false)}
                  className="p-1 text-red-500 hover:bg-red-50 rounded"
                  aria-label="Remove entry"
                >
                  <Trash2 className="w-3 h-3" />
                </button>
              </div>
            ))}
            <button
              onClick={addCreditEntry}
              className="w-full py-2 border-2 border-dashed border-gray-300 rounded hover:border-[#002E5D] hover:bg-[#002E5D]/5 transition-colors flex items-center justify-center gap-2 text-gray-600 hover:text-[#002E5D]"
            >
              <Plus className="w-4 h-4" />
              Add Entry
            </button>
          </div>
          <div className="border-t-2 border-[#002E5D] bg-gray-50 px-3 py-2 text-right font-semibold">
            {formatCurrency(totalCredit)}
          </div>
        </div>
      </div>

      {/* Net Balance Footer */}
      <div className="mt-4 pt-4 border-t border-gray-200">
        <div className="flex items-center justify-between">
          <span className="text-sm text-gray-600">Net Balance:</span>
          <span className="text-lg font-bold text-[#002E5D]">
            {netBalance > 0
              ? `${formatCurrency(netBalance)} ${balanceType} Balance`
              : 'Balanced'}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
