/**
 * Resume Output Engine v2 - Modern Executive Product Design Format
 * Minimalist, single-column layout optimized for executive/designer resumes
 * Deterministic formatting from template tokens, not AI creativity
 */

export const RESUME_FORMAT = {
  // Document configuration
  document: {
    paperSize: 'letter', // US Letter 8.5x11
    orientation: 'portrait',
    maxPages: 1,
    columns: 1,
    background: '#FFFFFF',
    outputFormat: 'pdf',
    textSearchable: true,
  },

  // Measurements in inches
  margins: {
    top: 0.75,
    right: 0.75,
    bottom: 0.75,
    left: 0.75,
  },

  // Typography - modern executive stack
  fonts: {
    primary: 'Inter',
    fallbackStack: ['Inter', 'Aptos', 'Calibri', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
    embedFonts: true,
    neverRasterize: true,
  },

  // Color palette - pure black & white
  colors: {
    text: '#000000',
    background: '#FFFFFF',
  },

  // Font sizes in points (executive specification)
  fontSizes: {
    name: 22,
    sectionHeading: 11,
    body: 10.5,
    dates: 10,
  },

  // Font weights
  fontWeights: {
    name: 700, // Bold
    sectionHeading: 700, // Bold
    body: 400, // Regular
    dates: 400, // Regular
  },

  // Line heights
  lineHeights: {
    name: 1.2,
    sectionHeading: 1.2,
    body: 1.28,
    dates: 1.28,
  },

  // Spacing in pixels
  spacing: {
    nameMarginBottom: 16, // 16pt space after name
    sectionMarginTop: 16, // 16pt before section
    sectionMarginBottom: 8, // 8pt after section heading
    jobBlockMargin: 12, // Between job entries
    dateMarginBottom: 4, // Between date and bullets
    bulletMargin: 4, // Between bullets
    bulletIndent: 20, // pixels
    expertiseItemMargin: 6, // Between expertise items
    educationItemMargin: 8, // Between education items
  },

  // Section order (immutable - no additional sections)
  sectionOrder: [
    'header',
    'summary',
    'expertise',
    'experience',
    'education',
  ] as const,

  // Content constraints - executive style
  contentConstraints: {
    summary: {
      maxWords: 65,
      maxChars: 325,
    },
    expertise: {
      maxItems: 8,
    },
    bullets: {
      current: { min: 5, max: 5 }, // Exactly 5 for current role
      previous: { min: 4, max: 4 }, // Exactly 4 for previous
      older: { min: 3, max: 3 }, // Exactly 3 for older
    },
  },

  // Compression order for one-page fitting
  compressionOrder: [
    'reduceOlderRoleBullets',
    'reduceExpertise',
    'trimSummary',
    'reduceCurrentRoleBullets',
  ] as const,

  // Page break prevention
  pageBreaks: {
    avoidInside: ['job-block', 'edu-block'],
    avoidAfter: ['section-title'],
  },

  // Executive style rules
  executiveStyle: {
    // Bullet preferences (strong verbs only)
    preferredVerbs: [
      'Architected',
      'Designed',
      'Established',
      'Embedded',
      'Facilitated',
      'Conducted',
      'Transformed',
      'Streamlined',
      'Reduced',
      'Created',
    ],
    // Never use these weak openers
    prohibitedOpeners: [
      'responsible for',
      'helped',
      'worked on',
      'participated in',
      'assisted',
      'involved',
      'contributed to',
    ],
  },
} as const;

export type SectionType = typeof RESUME_FORMAT.sectionOrder[number];
