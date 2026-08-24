/**
 * Minimal inline icon set (stroke-based, currentColor) so the dashboard has no
 * icon-font dependency and every glyph inherits its container's colour.
 */

const base = {
  fill: 'none',
  stroke: 'currentColor',
  strokeWidth: 1.75,
  strokeLinecap: 'round',
  strokeLinejoin: 'round',
};

const Svg = ({ children, size = 18, ...rest }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} {...base} {...rest} aria-hidden="true">
    {children}
  </svg>
);

export const IconDashboard = (p) => (
  <Svg {...p}><rect x="3" y="3" width="7" height="7" rx="1.5" /><rect x="14" y="3" width="7" height="7" rx="1.5" /><rect x="3" y="14" width="7" height="7" rx="1.5" /><rect x="14" y="14" width="7" height="7" rx="1.5" /></Svg>
);

export const IconNanny = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="9.5" cy="10.5" r="1" /><circle cx="14.5" cy="10.5" r="1" /><path d="M9 15.5c1.8 1.3 4.2 1.3 6 0" /></Svg>
);

export const IconFamily = (p) => (
  <Svg {...p}><path d="M3 10.5 12 4l9 6.5" /><path d="M5.5 9.8V20h13V9.8" /><path d="M10 20v-5h4v5" /></Svg>
);

export const IconBookings = (p) => (
  <Svg {...p}><path d="M4 5.5A1.5 1.5 0 0 1 5.5 4H11v16H5.5A1.5 1.5 0 0 1 4 18.5z" /><path d="M20 5.5A1.5 1.5 0 0 0 18.5 4H13v16h5.5a1.5 1.5 0 0 0 1.5-1.5z" /></Svg>
);

export const IconCalendar = (p) => (
  <Svg {...p}><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M3 10h18M8 3v4M16 3v4" /></Svg>
);

export const IconPayments = (p) => (
  <Svg {...p}><rect x="2.5" y="5.5" width="19" height="13" rx="2" /><path d="M2.5 10h19" /></Svg>
);

export const IconSupport = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><circle cx="12" cy="12" r="3.5" /><path d="m9.4 9.4-2.9-2.9M17.5 6.5l-2.9 2.9M14.6 14.6l2.9 2.9M6.5 17.5l2.9-2.9" /></Svg>
);

export const IconReferrals = (p) => (
  <Svg {...p}><circle cx="6" cy="12" r="2.5" /><circle cx="18" cy="6" r="2.5" /><circle cx="18" cy="18" r="2.5" /><path d="m8.3 10.8 7.4-3.6M8.3 13.2l7.4 3.6" /></Svg>
);

export const IconSettings = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="3" /><path d="M19.4 15a1.6 1.6 0 0 0 .3 1.8l.1.1a2 2 0 1 1-2.8 2.8l-.1-.1a1.6 1.6 0 0 0-1.8-.3 1.6 1.6 0 0 0-1 1.5V21a2 2 0 1 1-4 0v-.1A1.6 1.6 0 0 0 9 19.4a1.6 1.6 0 0 0-1.8.3l-.1.1a2 2 0 1 1-2.8-2.8l.1-.1a1.6 1.6 0 0 0 .3-1.8 1.6 1.6 0 0 0-1.5-1H3a2 2 0 1 1 0-4h.1A1.6 1.6 0 0 0 4.6 9a1.6 1.6 0 0 0-.3-1.8l-.1-.1a2 2 0 1 1 2.8-2.8l.1.1a1.6 1.6 0 0 0 1.8.3H9a1.6 1.6 0 0 0 1-1.5V3a2 2 0 1 1 4 0v.1a1.6 1.6 0 0 0 1 1.5 1.6 1.6 0 0 0 1.8-.3l.1-.1a2 2 0 1 1 2.8 2.8l-.1.1a1.6 1.6 0 0 0-.3 1.8V9a1.6 1.6 0 0 0 1.5 1H21a2 2 0 1 1 0 4h-.1a1.6 1.6 0 0 0-1.5 1z" /></Svg>
);

export const IconChats = (p) => (
  <Svg {...p}><path d="M21 11.5a8.4 8.4 0 0 1-9 8.4 9 9 0 0 1-4.2-1L3 20l1.1-4.1A8.4 8.4 0 0 1 12 3.1a8.4 8.4 0 0 1 9 8.4z" /></Svg>
);

export const IconSearch = (p) => (
  <Svg {...p}><circle cx="11" cy="11" r="7" /><path d="m20 20-3.5-3.5" /></Svg>
);

export const IconBell = (p) => (
  <Svg {...p}><path d="M18 8a6 6 0 1 0-12 0c0 6-2 7-2 7h16s-2-1-2-7" /><path d="M13.7 20a2 2 0 0 1-3.4 0" /></Svg>
);

export const IconMenu = (p) => (
  <Svg {...p}><path d="M4 6h16M4 12h16M4 18h16" /></Svg>
);

export const IconRefresh = (p) => (
  <Svg {...p}><path d="M20 11a8 8 0 0 0-13.7-5.3L4 8" /><path d="M4 4v4h4" /><path d="M4 13a8 8 0 0 0 13.7 5.3L20 16" /><path d="M20 20v-4h-4" /></Svg>
);

export const IconEye = (p) => (
  <Svg {...p}><path d="M2.5 12S6 5.5 12 5.5 21.5 12 21.5 12 18 18.5 12 18.5 2.5 12 2.5 12z" /><circle cx="12" cy="12" r="3" /></Svg>
);

export const IconCheck = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="m8.5 12.2 2.4 2.4 4.6-4.9" /></Svg>
);

export const IconX = (p) => (
  <Svg {...p}><path d="M6 6l12 12M18 6 6 18" /></Svg>
);

export const IconClock = (p) => (
  <Svg {...p}><circle cx="12" cy="12" r="9" /><path d="M12 7v5.2l3.2 1.9" /></Svg>
);

export const IconAlert = (p) => (
  <Svg {...p}><path d="M10.3 3.9 2.5 17.4A2 2 0 0 0 4.2 20.5h15.6a2 2 0 0 0 1.7-3.1L13.7 3.9a2 2 0 0 0-3.4 0z" /><path d="M12 9v4.5M12 17h.01" /></Svg>
);

export const IconShield = (p) => (
  <Svg {...p}><path d="M12 3 5 6v5.5c0 4.3 3 8.2 7 9.5 4-1.3 7-5.2 7-9.5V6z" /><path d="m9 12 2 2 4-4" /></Svg>
);

export const IconActivity = (p) => (
  <Svg {...p}><path d="M3 12h4l2.5-7 5 14L17.5 12H21" /></Svg>
);

export const IconDollar = (p) => (
  <Svg {...p}><path d="M12 3v18" /><path d="M16.5 7.5A3.5 3.5 0 0 0 13 5h-1.5a3 3 0 0 0 0 6h1a3 3 0 0 1 0 6H11a3.5 3.5 0 0 1-3.5-2.5" /></Svg>
);

export const IconTrend = (p) => (
  <Svg {...p}><path d="M3 16.5 9 10l4 3.5L21 6" /><path d="M15 6h6v6" /></Svg>
);

export const IconUser = (p) => (
  <Svg {...p}><circle cx="12" cy="8" r="3.5" /><path d="M4.5 20a7.5 7.5 0 0 1 15 0" /></Svg>
);

export const IconStar = ({ size = 14, ...rest }) => (
  <svg viewBox="0 0 24 24" width={size} height={size} fill="currentColor" aria-hidden="true" {...rest}>
    <path d="m12 3.5 2.7 5.5 6 .9-4.3 4.2 1 6-5.4-2.8-5.4 2.8 1-6L3.3 9.9l6-.9z" />
  </svg>
);
