const themes = {
  cobre: { accent: '#c75c35', paper: '#faf8f1', canvas: '#f0eee5', panel: '#f7f6ef', pale: '#f8e7dc' },
  moss: { accent: '#527461', paper: '#f8fbf7', canvas: '#e9efe8', panel: '#f2f7f0', pale: '#dfecdc' },
  ink: { accent: '#18322b', paper: '#f7faf9', canvas: '#e9efed', panel: '#f1f6f4', pale: '#dfeae6' },
  white: { accent: '#285f8f', paper: '#ffffff', canvas: '#eef2f5', panel: '#f7f9fb', pale: '#e7f0f8' },
  cyan: { accent: '#008da8', paper: '#f6feff', canvas: '#e4f6f9', panel: '#f0fbfc', pale: '#d8f2f6' },
  imperial: { accent: '#2447a5', paper: '#f8f9ff', canvas: '#e8edfc', panel: '#f3f5fd', pale: '#e0e6fa' },
};

export function themeTokens(name) {
  return themes[name] || themes.cobre;
}

export function brandTokens(name) {
  const brands = {
    forest: { dark: '#18322b', light: '#527461' },
    cyan: { dark: '#006d82', light: '#26a9bd' },
    imperial: { dark: '#1e3a8a', light: '#5376d1' },
    plum: { dark: '#5b2b62', light: '#9b679e' },
  };
  return brands[name] || brands.forest;
}

export function subtitleTokens(name) {
  const accents = { cobre: '#c75c35', cyan: '#008da8', oro: '#a36b00', violeta: '#7850a9' };
  return accents[name] || accents.cobre;
}

export const availableThemes = Object.keys(themes);
