/**
 * Semantic design tokens for the mobile app.
 *
 * These tokens mirror the naming conventions used in web artifacts (index.css)
 * so that multi-artifact projects share a cohesive visual identity.
 *
 * Replace the placeholder values below with values that match the project's
 * brand. If a sibling web artifact exists, read its index.css and convert the
 * HSL values to hex so both artifacts use the same palette.
 *
 * To add dark mode, add a `dark` key with the same token names.
 * The useColors() hook will automatically pick it up.
 */

const colors = {
  light: {
    // Legacy aliases (kept for backward compatibility)
    text: '#15251B',
    tint: '#1D583F',

    // Core surfaces
    background: '#F3F5EE',
    foreground: '#15251B',

    // Cards / elevated surfaces
    card: '#FFFFFF',
    cardForeground: '#15251B',

    // Primary action color (buttons, links, active states)
    primary: '#1D583F',
    primaryForeground: '#F7F8F1',

    // Secondary / less-emphasis interactive surfaces
    secondary: '#E5ECE3',
    secondaryForeground: '#1B3225',

    // Muted / subdued elements (dividers, timestamps, placeholders)
    muted: '#E9EDE5',
    mutedForeground: '#68766C',

    // Accent highlights (badges, selected items, focus rings)
    accent: '#C9EF73',
    accentForeground: '#193322',

    // Destructive actions (delete, error states)
    destructive: '#B94739',
    destructiveForeground: '#FFFFFF',

    // Borders and input outlines
    border: '#DCE4DA',
    input: '#DCE4DA',
  },

  dark: {
    text: '#F1F5EB',
    tint: '#C9EF73',
    background: '#101A14',
    foreground: '#F1F5EB',
    card: '#18251C',
    cardForeground: '#F1F5EB',
    primary: '#C9EF73',
    primaryForeground: '#172519',
    secondary: '#24332A',
    secondaryForeground: '#EAF0E5',
    muted: '#223027',
    mutedForeground: '#A7B5A8',
    accent: '#C9EF73',
    accentForeground: '#172519',
    destructive: '#E27363',
    destructiveForeground: '#FFFFFF',
    border: '#314137',
    input: '#314137',
  },

  // Border radius (in px). Sync from the sibling web artifact's --radius
  // CSS variable. This value applies to cards, buttons, inputs, and modals.
  radius: 18,
};

export default colors;
