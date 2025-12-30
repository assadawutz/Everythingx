
/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */
import React from 'react';
import { LucideIcon } from 'lucide-react';

interface ToggleButtonProps {
  icon?: LucideIcon;
  label: React.ReactNode;
  isSelected: boolean;
  onClick: () => void;
}

const ToggleButton: React.FC<ToggleButtonProps> = ({ icon: Icon, label, isSelected, onClick }) => {
  return (
    <button
      type="button"
      onClick={onClick}
      className={`inline-flex items-center gap-2 px-4 py-2.5 text-xs font-black uppercase tracking-wider rounded-full transition-all duration-300 ${
        isSelected ? 'bg-black text-white shadow-md' : 'text-slate-500 hover:text-black'
      }`}
    >
      {Icon && <Icon size={14} strokeWidth={3} />}
      {label}
    </button>
  );
};

export default ToggleButton;
