// src/context/ThemeProvider.tsx
import React, { createContext, useContext, useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from './AuthProvider';
import { colors as defaultColors } from '../lib/theme';
export type ThemeColors = typeof defaultColors;

type ThemeContextValue = {
    colors: ThemeColors;
    loadingTheme: boolean;
    logoUrl: string | null;
};

const ThemeContext = createContext<ThemeContextValue>({
    colors: defaultColors,
    loadingTheme: true,
    logoUrl: null,
});

export const ThemeProvider: React.FC<{ children: React.ReactNode }> = ({
    children,
}) => {
    const { profile } = useAuth();
    const [colors, setColors] = useState<ThemeColors>(defaultColors);
    const [logoUrl, setLogoUrl] = useState<string | null>(null);
    const [loadingTheme, setLoadingTheme] = useState(true);

    useEffect(() => {
        const loadTheme = async () => {
            if (!profile) {
                setColors(defaultColors);
                setLoadingTheme(false);
                setLogoUrl(null);
                return;
            }

            setLoadingTheme(true);
            const { data, error } = await supabase
                .from('tenant_themes')
                .select('*')
                .eq('tenant_id', profile.tenant_id)
                .maybeSingle();

            if (error || !data) {
                console.log('load theme error', error);
                setColors(defaultColors);
                setLoadingTheme(false);
                setLogoUrl(null);
                return;
            }

            setColors({
                ...defaultColors,
                primary: data.primary_color ?? defaultColors.primary,
                accent: data.accent_color ?? defaultColors.accent,
                bg: data.bg_color ?? defaultColors.bg,
                card: data.card_color ?? defaultColors.card,
                text: data.text_color ?? defaultColors.text,
                textMuted: data.text_muted ?? defaultColors.textMuted,
                success: data.success_color ?? defaultColors.success,
                error: data.error_color ?? defaultColors.error,
            });

            setLogoUrl(data.app_logo_url ?? null);
            setLoadingTheme(false);
        };

        loadTheme();
    }, [profile]);

    return (
        <ThemeContext.Provider value={{ colors, loadingTheme, logoUrl  }}>
            {children}
        </ThemeContext.Provider>
    );
};

export const useTheme = () => useContext(ThemeContext);
