// Persisted on/off state for the merchant-density heatmap layer. Kept in a
// standalone module so both the map page (which owns the layer) and
// MapToolsControl (which owns the toggle UI) read the same storage key.
export const HEATMAP_STORAGE_KEY = "btcmap:heatmap-layer";
