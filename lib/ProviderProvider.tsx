'use client'

import React from 'react';
import { DialogProvider } from './providers/dialog-provider';

const ProviderProvider: React.FC<{ children: React.ReactNode }> = ({ children }) => {
    return (
        <DialogProvider>
            {children}
        </DialogProvider>
    );
};

export default ProviderProvider;