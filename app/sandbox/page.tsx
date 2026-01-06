'use client';

import { useState } from 'react';
import { Plus } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';
import TAccount from '../components/TAccount';

const defaultAccounts = [
  { id: '1', title: 'Cash' },
  { id: '2', title: 'Accounts Receivable' },
];

export default function SandboxPage() {
  const [accounts, setAccounts] = useState(defaultAccounts);

  const addAccount = () => {
    const newAccount = {
      id: `account-${Date.now()}-${Math.random()}`,
      title: 'New Account',
    };
    setAccounts([...accounts, newAccount]);
  };

  const removeAccount = (id: string) => {
    setAccounts(accounts.filter((account) => account.id !== id));
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-4xl font-bold text-[#002E5D] mb-2">
            T-Account Sandbox
          </h1>
          <p className="text-lg text-gray-600">
            Build and visualize accounting transactions with T-Accounts
          </p>
        </div>
        <button
          onClick={addAccount}
          className="px-6 py-3 bg-[#002E5D] text-white rounded-lg hover:bg-[#004080] transition-colors flex items-center gap-2 font-semibold shadow-md"
        >
          <Plus className="w-5 h-5" />
          Add T-Account
        </button>
      </div>

      {/* T-Accounts Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <AnimatePresence>
          {accounts.map((account, index) => (
            <TAccount
              key={account.id}
              id={account.id}
              defaultTitle={account.title}
              onRemove={() => removeAccount(account.id)}
            />
          ))}
        </AnimatePresence>
      </div>

      {/* Empty State */}
      {accounts.length === 0 && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="text-center py-12 bg-gray-50 rounded-lg border-2 border-dashed border-gray-300"
        >
          <p className="text-gray-500 text-lg mb-4">
            No T-Accounts yet. Create your first one to get started!
          </p>
          <button
            onClick={addAccount}
            className="px-6 py-3 bg-[#002E5D] text-white rounded-lg hover:bg-[#004080] transition-colors flex items-center gap-2 font-semibold mx-auto"
          >
            <Plus className="w-5 h-5" />
            Add T-Account
          </button>
        </motion.div>
      )}
    </div>
  );
}
