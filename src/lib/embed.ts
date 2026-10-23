// The page runs inside an iframe (the /map embed on other sites). Embeds
// never show the viewer's private data, such as their notes.
export const isEmbedded = (): boolean => window.self !== window.top;
