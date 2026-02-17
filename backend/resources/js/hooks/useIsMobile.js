import { useState, useEffect } from 'react';

const MOBILE_BREAKPOINT = 768;
const TABLET_BREAKPOINT = 1024;

export function useIsMobile() {
    const [isMobile, setIsMobile] = useState(
        typeof window !== 'undefined' ? window.innerWidth < MOBILE_BREAKPOINT : false
    );

    useEffect(() => {
        const handleResize = () => setIsMobile(window.innerWidth < MOBILE_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isMobile;
}

export function useIsTablet() {
    const [isTablet, setIsTablet] = useState(
        typeof window !== 'undefined' ? window.innerWidth < TABLET_BREAKPOINT : false
    );

    useEffect(() => {
        const handleResize = () => setIsTablet(window.innerWidth < TABLET_BREAKPOINT);
        window.addEventListener('resize', handleResize);
        return () => window.removeEventListener('resize', handleResize);
    }, []);

    return isTablet;
}
