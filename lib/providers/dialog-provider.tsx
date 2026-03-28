'use client'

import React, { createContext, useContext, useState } from "react";
import {
  ClosureDirection,
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type DialogOptions = {
  closureCondition?: ClosureDirection;
  header?: React.ReactNode;
  headerOptions?: {
    className?: string;
  };
  title?: React.ReactNode;
  titleOptions?: {
    className?: string;
  };
  footer?: React.ReactNode;
  footerOptions?: {
    className?: string;
  };
  description?: React.ReactNode;
  descriptionOptions?: {
    className?: string;
  };
  helpContent?: React.ReactNode;
  topLeftIcon?: React.ReactNode;
  additionalClosingAction?: () => void;
  options?: {
    className?: string;
  }
};

type DialogContextType = {
  isOpen: boolean;
  dialog: (children: React.ReactNode, options?: DialogOptions) => void;
  close: (closeOnly?: boolean) => void;
  options: DialogOptions | null;
  content: React.ReactNode | null;
};

const DialogContext = createContext<DialogContextType | undefined>(undefined);

export const DialogProvider: React.FC<{
  children: React.ReactNode;
}> = ({ children }) => {
  const [isOpen, setIsOpen] = useState(false);
  const [options, setOptions] = useState<DialogOptions | null>(null);
  const [content, setContent] = useState<React.ReactNode | null>(null);

  const dialog = (children: React.ReactNode, options?: DialogOptions) => {
    console.log("dialog", children, options);
    setIsOpen(true);
    setOptions(options ?? null);
    setContent(children);
  };

  const close = (closeOnly: boolean = false) => {
    if (options?.additionalClosingAction && !closeOnly) {
      options.additionalClosingAction();
    }
    setIsOpen(false);
    setTimeout(() => {
      setOptions(null);
      setContent(null);
    }, 300);
  };

  const value = {
    isOpen,
    dialog,
    close,
    options,
    content,
  };

  return (
    <DialogContext.Provider value={value}>
      <Dialog open={isOpen} onOpenChange={() => close()}>
        <DialogContent
          closureCondition={options?.closureCondition}
          topLeftIcon={options?.topLeftIcon}
          className={`${options?.options?.className} w-[95vw] sm:w-[50vw] max-w-[95vw] max-h-[92.5vh] sm:max-h-[90vh] flex flex-col overflow-visible top-[2.5vh] translate-y-0 sm:top-[50%] sm:translate-y-[-50%]`}
        >
          <div className="flex flex-col flex-1 min-h-0 overflow-y-auto">
            {options?.title && (
              <DialogHeader>
                <DialogTitle className={options.titleOptions?.className}>
                  {options.title}
                </DialogTitle>
              </DialogHeader>
            )}
            {content}
            {options?.footer && (
              <DialogFooter className={options.footerOptions?.className}>
                {options.footer}
              </DialogFooter>
            )}
          </div>
        </DialogContent>
      </Dialog>
      {children}
    </DialogContext.Provider>
  );
};

// Updated hook that uses the context
export function useDialog() {
  const context = useContext(DialogContext);
  if (context === undefined) {
    throw new Error("useDialog must be used within a DialogProvider");
  }
  return context;
}
