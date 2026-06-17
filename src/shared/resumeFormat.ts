/**
 * Resume Format Specification
 * Centralized design tokens for deterministic, ATS-safe resume rendering
 * Every generated resume uses these immutable format rules
 */

export const RESUME_FORMAT = {
  // Document configuration
  document: {
    paperSize: 'letter', // US Letter 8.5in x 11in
    orientation: 'portrait',
    maxPages: 1,
    columns: 1,
    background: '#FFFFFF',
    outputFormat: 'pdf',
    textSearchable: true,
    alignment: 'left', // ATS-safe: left-aligned only
  },

  // Measurements in inches (matching spec exactly)
  margins: {
    top: 0.60,
    right: 0.60,
    bottom: 0.60,
    left: 0.60,
  },

  // Typography stack - ATS-safe fonts
  fonts: {
    primary: 'Inter',
    fallbackStack: ['Inter', 'Aptos', 'Calibri', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
    embedFonts: true,
    neverRasterize: true, // Ensure text is searchable
  },

  // Color palette - high contrast for ATS readability
  colors: {
    text: '#111111',
    secondary: '#444444',
    divider: '#DDDDDD',
    background: '#FFFFFF',
  },

  // Font sizes in points (spec exactly)
  fontSizes: {
    name: 20,
    contact: 9.5,
    sectionHeading: 11,
    jobTitle: 11,
    company: 10.5,
    dates: 10,
    body: 10.5,
    bullets: 10.5,
  },

  // Font weights
  fontWeights: {
    name: 700, // Bold
    sectionHeading: 700, // Bold
    jobTitle: 600, // Semi-bold
    company: 500, // Medium
    body: 400, // Regular
    dates: 400, // Regular
  },

  // Line heights (spec exactly)
  lineHeights: {
    name: 1.0,
    contact: 1.15,
    sectionHeading: 1.15,
    body: 1.30,
    bullets: 1.25,
  },

  // Spacing in points (spec exactly)
  spacing: {
    contactAfter: 16, // After contact line
    sectionBefore: 16, // Before section title
    sectionAfter: 8, // After section title
    paragraphAfter: 4, // After paragraph
    bulletAfter: 3, // Between bullets
    roleBlockAfter: 12, // Between job entries
    dividerMarginTop: 6,
    dividerMarginBottom: 10,
  },

  // Bullet style (spec exactly)
  bullets: {
    character: '•',
    indent: 0.18, // inches
    hangingIndent: 0.18, // inches
    maxVisualLines: 2, // Preferred: 1-2 lines per bullet
    noNesting: true, // Never nest bullets
  },

  // Section order (locked - immutable)
  sectionOrder: [
    'header',
    'summary',
    'expertise',
    'experience',
    'education',
  ] as const,

  // Paragraph styles (apply consistently)
  paragraphStyles: {
    ResumeName: {
      fontSize: 20,
      fontWeight: 700,
      lineHeight: 1.0,
      marginBottom: 4,
    },
    ResumeContact: {
      fontSize: 9.5,
      fontWeight: 400,
      lineHeight: 1.15,
      marginBottom: 16,
    },
    ResumeSectionHeading: {
      fontSize: 11,
      fontWeight: 700,
      lineHeight: 1.15,
      marginTop: 16,
      marginBottom: 8,
    },
    ResumeSummary: {
      fontSize: 10.5,
      fontWeight: 400,
      lineHeight: 1.30,
      marginBottom: 4,
    },
    ResumeSkillLine: {
      fontSize: 10.5,
      fontWeight: 400,
      lineHeight: 1.30,
      marginBottom: 4,
    },
    ResumeCompany: {
      fontSize: 10.5,
      fontWeight: 500,
      lineHeight: 1.15,
      marginBottom: 0,
    },
    ResumeJobTitle: {
      fontSize: 11,
      fontWeight: 600,
      lineHeight: 1.15,
      marginBottom: 0,
    },
    ResumeDates: {
      fontSize: 10,
      fontWeight: 400,
      lineHeight: 1.15,
      marginBottom: 3,
    },
    ResumeBullet: {
      fontSize: 10.5,
      fontWeight: 400,
      lineHeight: 1.25,
      marginBottom: 3,
      marginLeft: 0.18, // inches
    },
    ResumeEducation: {
      fontSize: 10.5,
      fontWeight: 400,
      lineHeight: 1.30,
      marginBottom: 4,
    },
  },

  // Content constraints (enforced before render)
  contentConstraints: {
    summary: {
      maxWords: 70,
      maxChars: 350,
    },
    expertise: {
      maxItems: 18,
    },
    bullets: {
      current: { min: 5, max: 7 },
      previous: { min: 4, max: 6 },
      older: { min: 2, max: 4 },
    },
  },

  // Compression order for one-page fitting (deterministic)
  compressionOrder: [
    'reduceOlderRoleBullets',
    'reduceExpertise',
    'trimSummary',
    'reduceCurrentRoleBullets',
  ] as const,

  // Minimum values (never go below)
  minimums: {
    fontSize: 10, // Never below 10pt
    marginInches: 0.5, // Never below 0.5in
  },

  // Page break prevention (ATS-safe)
  pageBreaks: {
    avoidInside: ['job-block', 'edu-block'],
    avoidAfter: ['section-title'],
  },

  // ATS-safe restrictions (enforce in renderer)
  prohibitedElements: [
    'tables',
    'columns',
    'icons',
    'photos',
    'logos',
    'graphics',
    'charts',
    'text-boxes',
    'skill-bars',
    'progress-bars',
    'sidebars',
    'rasterized-text',
    'justified-alignment',
  ],

  // Executive style rules
  executiveStyle: {
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
    prohibitedOpeners: [
      'responsible for',
      'helped',
      'worked on',
      'worked with',
      'participated in',
      'assisted',
      'involved',
      'contributed to',
    ],
  },
} as const;

export type SectionType = typeof RESUME_FORMAT.sectionOrder[number];
