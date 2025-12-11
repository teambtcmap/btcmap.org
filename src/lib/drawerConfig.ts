// Drawer gesture configuration constants
// These values control the behavior of the mobile drawer's swipe gestures

// Drawer height states
export const PEEK_HEIGHT = 140; // Collapsed state height - shows merchant name and quick info

// Gesture thresholds
export const VELOCITY_THRESHOLD = 0.5; // px/ms - minimum velocity for flick gesture detection
export const DISTANCE_THRESHOLD = 80; // px - minimum drag distance to trigger snap
export const DISMISS_THRESHOLD = 60; // px - drag distance below peek to trigger dismiss
export const POSITION_THRESHOLD_PERCENT = 0.3; // When to snap up vs down (30% of total height)

// Velocity tracking
export const VELOCITY_SAMPLE_COUNT = 5; // Number of velocity samples for smoothing

// Spring animation config
export const SPRING_CONFIG = { stiffness: 0.2, damping: 0.75 }; // Smooth but responsive feel

// Scroll-aware drag thresholds (for expanded content swipe-to-collapse)
export const SCROLL_DRAG_THRESHOLD = 10; // px to decide drag vs scroll
export const SCROLL_TOP_THRESHOLD = 1; // px tolerance for scroll position (handles browser rounding)
