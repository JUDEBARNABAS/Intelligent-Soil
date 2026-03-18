import React, { useEffect } from 'react';
import { CheckCircle, X } from 'lucide-react';
import { motion, AnimatePresence } from 'framer-motion';

interface ToastProps {
  message: string;
  isVisible: boolean;
  onClose: () => void;
}

export const Toast: React.FC<ToastProps> = ({ message, isVisible, onClose }) => {
  useEffect(() => {
    if (isVisible) {
      const timer = setTimeout(onClose, 3000);
      return () => clearTimeout(timer);
    }
  }, [isVisible, onClose]);

  return (
    <AnimatePresence>
      {isVisible && (
        <motion.div
          initial={{ opacity: 0, y: 50, scale: 0.9 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: 50, scale: 0.9 }}
          className="fixed bottom-24 left-1/2 -translate-x-1/2 bg-gray-900 text-white px-4 py-3 rounded-2xl shadow-2xl flex items-center space-x-3 z-[60] min-w-[200px]"
        >
          <CheckCircle className="text-green-400" size={20} />
          <span className="text-sm font-bold flex-1">{message}</span>
          <button onClick={onClose} className="text-gray-400 hover:text-white">
            <X size={16} />
          </button>
        </motion.div>
      )}
    </AnimatePresence>
  );
};
