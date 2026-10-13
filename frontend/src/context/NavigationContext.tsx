/**
 * NavigationContext — lets any tab component navigate to another tab
 * without prop drilling.
 *
 * Usage:
 *   const { goToTab } = useNavigation();
 *   goToTab('pool'); // navigates to Connection Pool tab
 */
import React, { createContext, useContext } from 'react';

export const NavigationContext = createContext(null);

export function useNavigation() {
    return useContext(NavigationContext) || { goToTab: () => {} };
}
