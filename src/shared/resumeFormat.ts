/**
 * ATS Professional Resume Format Specification
 * Matches ATS Professional Resume template exactly for 2026 AI-driven ATS
 * Ensures perfect visual match while preserving single-column reading order
 */

export const RESUME_FORMAT = {
  // Document configuration
  document: {
    paperSize: 'letter', // US Letter or A4
    orientation: 'portrait',
    maxPages: 1,
    columns: 1,
    background: '#FFFFFF',
    outputFormat: 'pdf',
    textSearchable: true,
  },

  // Measurements in inches (standard for PDF)
  margins: {
    top: 0.79, // 20mm
    right: 0.59, // 15mm
    bottom: 0.79, // 20mm
    left: 0.59, // 15mm
  },

  // Typography - ATS safe sans-serif stack
  fonts: {
    primary: 'Arial',
    fallbackStack: ['Arial', 'Helvetica', 'sans-serif'],
    embedFonts: true,
    neverRasterize: true,
  },

  // Color palette - professional, high-contrast, ATS-friendly
  colors: {
    // Primary headers and name
    navy: '#1a365d',
    // Main body text and titles
    darkCharcoal: '#2d3748',
    // Secondary metadata
    slateGray: '#4a5568',
    // Dates and passive elements
    mediumGray: '#718096',
    // Dividers
    lightBorder: '#cbd5e0',
    // Background
    background: '#FFFFFF',
  },

  // Font sizes in points (exact ATS specification)
  fontSizes: {
    name: 22,
    contact: 10,
    sectionHeading: 12,
    metaLeft: 10.5, // Company / Role / Degree
    metaRight: 10, // Dates
    subHeading: 10.5, // Job sub-details
    body: 10.5,
    bullets: 10.5,
  },

  // Font weights
  fontWeights: {
    name: 700, // Bold
    sectionHeading: 700, // Bold
    metaLeft: 700, // Bold
    subHeading: 700, // Bold & Italic
    body: 400, // Regular
    dates: 400, // Regular
    contact: 400, // Regular
  },

  // Line heights
  lineHeights: {
    name: 1.2,
    contact: 1.4,
    sectionHeading: 1.2,
    body: 1.5, // ATS spec: 1.5
    bullets: 1.5,
  },

  // Spacing in pixels (ATS specification)
  spacing: {
    headerMarginBottom: 20, // Below contact details
    sectionMarginTop: 22, // Before section header
    sectionMarginBottom: 10, // After section header
    sectionBorderPadding: 3, // Under border-bottom
    skillRowPadding: 4,
    skillBlockMargin: 15,
    jobBlockMargin: 16,
    jobMetaMargin: 4,
    bulletMargin: 4,
    eduBlockMargin: 12,
    bulletIndent: 20, // pixels
  },

  // Dividers
  dividers: {
    style: 'solid',
    width: 1,
    color: '#cbd5e0', // Light gray
    paddingBottom: 3,
  },

  // Bullets
  bullets: {
    character: '•', // Standard round bullet
    indent: 20, // pixels (padding-left)
  },

  // Section order (immutable)
  sectionOrder: [
    'header',
    'summary',
    'expertise',
    'experience',
    'education',
    'certifications',
    'portfolio',
  ] as const,

  // ATS-safe restrictions
  atsSafe: {
    prohibit: [
      'flexbox',
      'css-grid',
      'tables-for-layout',
      'icons',
      'photos',
      'logos',
      'graphics',
      'charts',
      'text-boxes',
      'skill-bars',
      'progress-bars',
      'sidebars',
      'styled-bullets',
      'rasterized-text',
      'footers-with-content',
      'headers-with-content',
    ],
    mustUse: [
      'block-elements',
      'standard-bullets',
      'table-for-side-by-side', // For dates/titles
      'pure-css-borders',
      'left-aligned-content',
      'centered-header-only',
    ],
  },

  // Content constraints
  contentConstraints: {
    summary: {
      maxWords: 70,
      maxChars: 350,
    },
    skills: {
      maxItems: 18,
    },
    bullets: {
      current: { min: 5, max: 7 },
      previous: { min: 4, max: 6 },
      older: { min: 2, max: 4 },
    },
  },

  // Compression order for one-page fitting
  compressionOrder: [
    'reduceOlderRoleBullets',
    'reduceSkills',
    'trimSummary',
    'reduceCurrentRoleBullets',
  ] as const,

  // Page break prevention
  pageBreaks: {
    avoidInside: ['job-block', 'edu-block'],
    avoidAfter: ['section-title'],
  },
} as const;

/**
 * Paragraph styles - named styles using ATS format tokens
 */
export const PARAGRAPH_STYLES = {
  ResumeName: {
    fontSize: RESUME_FORMAT.fontSizes.name,
    fontWeight: RESUME_FORMAT.fontWeights.name,
    lineHeight: RESUME_FORMAT.lineHeights.name,
    color: RESUME_FORMAT.colors.navy,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    textAlign: 'center',
    marginBottom: RESUME_FORMAT.spacing.headerMarginBottom,
  },

  ResumeContact: {
    fontSize: RESUME_FORMAT.fontSizes.contact,
    fontWeight: RESUME_FORMAT.fontWeights.contact,
    lineHeight: RESUME_FORMAT.lineHeights.contact,
    color: RESUME_FORMAT.colors.slateGray,
    textAlign: 'center',
    marginBottom: RESUME_FORMAT.spacing.headerMarginBottom,
  },

  ResumeSectionHeading: {
    fontSize: RESUME_FORMAT.fontSizes.sectionHeading,
    fontWeight: RESUME_FORMAT.fontWeights.sectionHeading,
    lineHeight: RESUME_FORMAT.lineHeights.sectionHeading,
    color: RESUME_FORMAT.colors.navy,
    letterSpacing: '0.5px',
    textTransform: 'uppercase',
    marginTop: RESUME_FORMAT.spacing.sectionMarginTop,
    marginBottom: RESUME_FORMAT.spacing.sectionMarginBottom,
    borderBottom: `${RESUME_FORMAT.dividers.width}px ${RESUME_FORMAT.dividers.style} ${RESUME_FORMAT.dividers.color}`,
    paddingBottom: RESUME_FORMAT.dividers.paddingBottom,
    pageBreakAfter: 'avoid',
  },

  ResumeSummary: {
    fontSize: RESUME_FORMAT.fontSizes.body,
    fontWeight: RESUME_FORMAT.fontWeights.body,
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.darkCharcoal,
    marginBottom: RESUME_FORMAT.spacing.sectionMarginBottom,
    textAlign: 'justify',
  },

  ResumeJobTitle: {
    fontSize: RESUME_FORMAT.fontSizes.metaLeft,
    fontWeight: RESUME_FORMAT.fontWeights.metaLeft,
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.darkCharcoal,
  },

  ResumeCompany: {
    fontSize: RESUME_FORMAT.fontSizes.metaLeft,
    fontWeight: RESUME_FORMAT.fontWeights.metaLeft,
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.darkCharcoal,
  },

  ResumeDates: {
    fontSize: RESUME_FORMAT.fontSizes.metaRight,
    fontWeight: RESUME_FORMAT.fontWeights.dates,
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.mediumGray,
  },

  ResumeSubHeading: {
    fontSize: RESUME_FORMAT.fontSizes.subHeading,
    fontWeight: RESUME_FORMAT.fontWeights.subHeading,
    fontStyle: 'italic',
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.slateGray,
  },

  ResumeBullet: {
    fontSize: RESUME_FORMAT.fontSizes.bullets,
    fontWeight: RESUME_FORMAT.fontWeights.body,
    lineHeight: RESUME_FORMAT.lineHeights.bullets,
    color: RESUME_FORMAT.colors.darkCharcoal,
    marginBottom: RESUME_FORMAT.spacing.bulletMargin,
    marginLeft: `${RESUME_FORMAT.spacing.bulletIndent}px`,
    textAlign: 'justify',
  },

  ResumeEducation: {
    fontSize: RESUME_FORMAT.fontSizes.body,
    fontWeight: RESUME_FORMAT.fontWeights.body,
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.darkCharcoal,
    marginBottom: RESUME_FORMAT.spacing.eduBlockMargin,
  },

  ResumeSkillLine: {
    fontSize: RESUME_FORMAT.fontSizes.body,
    fontWeight: RESUME_FORMAT.fontWeights.body,
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.darkCharcoal,
    paddingBottom: RESUME_FORMAT.spacing.skillRowPadding,
  },
} as const;

export type SectionType = typeof RESUME_FORMAT.sectionOrder[number];
