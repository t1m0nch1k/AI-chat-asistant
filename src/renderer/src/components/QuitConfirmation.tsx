import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'
import { X, Power, Minimize2 } from 'lucide-react'

interface QuitConfirmationProps {
  isOpen: boolean
  onClose: () => void
  onQuit: () => void
  onHide: () => void
}

export const QuitConfirmation: React.FC<QuitConfirmationProps> = ({ isOpen, onClose, onQuit, onHide }) => {
  return (
    <AnimatePresence>
      {isOpen && (
        <div className="fixed inset-0 z-[10000] flex items-center justify-center p-4">
          {/* Backdrop */}
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          
          {/* Modal */}
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-[#151515] border border-white/10 rounded-2xl shadow-2xl overflow-hidden"
          >
            <div className="p-6 text-center">
              <div className="mx-auto w-16 h-16 bg-accent/10 text-accent rounded-full flex items-center justify-center mb-4">
                <Power size={32} />
              </div>
              
              <h3 className="text-xl font-semibold text-white mb-2">Закрыть приложение?</h3>
              <p className="text-white/50 text-sm mb-8 leading-relaxed">
                Вы действительно хотите выйти? Вы можете свернуть приложение в трей, 
                чтобы оно продолжало работать в фоновом режиме.
              </p>
              
              <div className="grid grid-cols-1 gap-3">
                <button
                  onClick={onHide}
                  className="flex items-center justify-center gap-2 py-3 px-4 rounded-xl bg-white/5 hover:bg-white/10 text-white font-medium transition-all border border-white/5"
                >
                  <Minimize2 size={18} />
                  Свернуть в трей
                </button>
                
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={onClose}
                    className="py-3 px-4 rounded-xl bg-transparent hover:bg-white/5 text-white/50 hover:text-white font-medium transition-all"
                  >
                    Отмена
                  </button>
                  <button
                    onClick={onQuit}
                    className="py-3 px-4 rounded-xl bg-red-500/20 hover:bg-red-500/30 text-red-400 font-medium transition-all border border-red-500/20"
                  >
                    Выйти
                  </button>
                </div>
              </div>
            </div>
          </motion.div>
        </div>
      )}
    </AnimatePresence>
  )
}
