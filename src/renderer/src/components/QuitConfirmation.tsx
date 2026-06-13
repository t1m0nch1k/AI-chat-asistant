import React from 'react'
import { motion, AnimatePresence } from 'framer-motion'

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
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onClose}
            className="absolute inset-0 bg-black/60 backdrop-blur-sm"
          />
          <motion.div
            initial={{ opacity: 0, scale: 0.9, y: 20 }}
            animate={{ opacity: 1, scale: 1, y: 0 }}
            exit={{ opacity: 0, scale: 0.9, y: 20 }}
            className="relative w-full max-w-md bg-surface border border-outline-variant rounded-xl shadow-2xl overflow-hidden"
          >
            <div className="p-lg text-center">
              <div className="mx-auto w-16 h-16 bg-primary-container/20 text-primary-container rounded-full flex items-center justify-center mb-md">
                <span className="material-symbols-outlined text-[32px]" style={{ fontVariationSettings: "'FILL' 1" }}>power_settings_new</span>
              </div>
              <h3 className="font-headline-md text-headline-md text-on-surface mb-sm">Close application?</h3>
              <p className="text-body-sm text-on-surface-variant mb-lg leading-relaxed">
                You can minimize to tray to keep the app running in the background.
              </p>
              <div className="grid grid-cols-1 gap-sm">
                <button
                  onClick={onHide}
                  className="flex items-center justify-center gap-sm py-sm px-md rounded-xl bg-surface-container-high hover:bg-surface-container-highest text-on-surface font-medium transition-all border border-outline-variant/30"
                >
                  <span className="material-symbols-outlined text-[18px]">minimize</span>
                  Minimize to Tray
                </button>
                <div className="grid grid-cols-2 gap-sm">
                  <button
                    onClick={onClose}
                    className="py-sm px-md rounded-xl bg-transparent hover:bg-surface-container-high text-on-surface-variant hover:text-on-surface font-medium transition-all"
                  >
                    Cancel
                  </button>
                  <button
                    onClick={onQuit}
                    className="py-sm px-md rounded-xl bg-error/20 hover:bg-error/30 text-error font-medium transition-all border border-error/20"
                  >
                    <span className="material-symbols-outlined text-[16px] align-middle mr-xs">logout</span>
                    Quit
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
