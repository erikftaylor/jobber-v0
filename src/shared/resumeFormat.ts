/**
 * Resume Format Specification
 * Centralized design tokens for deterministic, ATS-safe resume output
 * Every resume rendered from this spec produces identical visual output
 */

export const RESUME_FORMAT = {
  // Document configuration
  document: {
    paperSize: 'letter', // US Letter: 8.5" x 11"
    orientation: 'portrait',
    maxPages: 1,
    columns: 1,
    background: '#FFFFFF',
    outputFormat: 'pdf',
    textSearchable: true, // Never rasterize text
  },

  // Measurements in inches (standard for PDF)
  margins: {
    top: 0.6,
    right: 0.6,
    bottom: 0.6,
    left: 0.6,
  },

  // Typography
  fonts: {
    primary: 'Inter',
    fallbackStack: ['Inter', 'Aptos', 'Calibri', 'Helvetica Neue', 'Helvetica', 'Arial', 'sans-serif'],
    embedFonts: true,
    neverRasterize: true,
  },

  // Color palette
  colors: {
    text: '#111111', // Primary text
    secondary: '#444444', // Secondary text (dates, company)
    divider: '#DDDDDD', // Section dividers
    background: '#FFFFFF', // Page background
  },

  // Font sizes in points
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
    name: 700,
    sectionHeading: 700,
    jobTitle: 600,
    company: 500,
    body: 400,
    dates: 400,
  },

  // Line heights (unitless multipliers)
  lineHeights: {
    name: 1.0,
    contact: 1.15,
    sectionHeading: 1.15,
    body: 1.3,
    bullets: 1.25,
  },

  // Spacing in points
  spacing: {
    contactAfter: 16,
    sectionHeadingBefore: 16,
    sectionHeadingAfter: 8,
    paragraphAfter: 4,
    bulletAfter: 3,
    roleBlockAfter: 12,
    dividerMarginTop: 6,
    dividerMarginBottom: 10,
  },

  // Bullet configuration
  bullets: {
    character: '•',
    indentInches: 0.18,
    hangingIndentInches: 0.18,
    maxVisualLines: 2,
    allowNested: false,
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

  // ATS-safe restrictions (prohibited elements)
  atsSafe: {
    prohibit: [
      'tables',
      'columns',
      'icons',
      'photos',
      'logos',
      'graphics',
      'charts',
      'textBoxes',
      'skillBars',
      'progressBars',
      'sidebars',
      'justifiedText',
      'rasterizedText',
      'footers',
      'headers',
    ],
    alignment: 'left',
  },

  // Content constraints (enforced during normalization)
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
    roleCount: {
      // Number of roles to display
      maxRoles: 5,
    },
  },

  // One-page fitting compression order
  compressionOrder: [
    'reduceOlderRoleBullets',
    'reduceSkills',
    'trimSummary',
    'reduceCurrentRoleBullets',
  ] as const,

  // Compression constraints
  compressionConstraints: {
    minBodyFontSize: 10,
    minMargins: 0.5,
  },
} as const;

/**
 * Paragraph styles - named styles used throughout the resume
 * Maps to RESUME_FORMAT tokens for consistency
 */
export const PARAGRAPH_STYLES = {
  ResumeName: {
    fontSize: RESUME_FORMAT.fontSizes.name,
    fontWeight: RESUME_FORMAT.fontWeights.name,
    lineHeight: RESUME_FORMAT.lineHeights.name,
    color: RESUME_FORMAT.colors.text,
    marginBottom: RESUME_FORMAT.spacing.contactAfter,
  },

  ResumeContact: {
    fontSize: RESUME_FORMAT.fontSizes.contact,
    fontWeight: RESUME_FORMAT.fontWeights.body,
    lineHeight: RESUME_FORMAT.lineHeights.contact,
    color: RESUME_FORMAT.colors.secondary,
    marginBottom: RESUME_FORMAT.spacing.contactAfter,
  },

  ResumeSectionHeading: {
    fontSize: RESUME_FORMAT.fontSizes.sectionHeading,
    fontWeight: RESUME_FORMAT.fontWeights.sectionHeading,
    lineHeight: RESUME_FORMAT.lineHeights.sectionHeading,
    color: RESUME_FORMAT.colors.text,
    marginTop: RESUME_FORMAT.spacing.sectionHeadingBefore,
    marginBottom: RESUME_FORMAT.spacing.sectionHeadingAfter,
    borderBottom: `1px solid ${RESUME_FORMAT.colors.divider}`,
    paddingBottom: 4,
  },

  ResumeSummary: {
    fontSize: RESUME_FORMAT.fontSizes.body,
    fontWeight: RESUME_FORMAT.fontWeights.body,
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.text,
    marginBottom: RESUME_FORMAT.spacing.paragraphAfter,
  },

  ResumeSkillLine: {
    fontSize: RESUME_FORMAT.fontSizes.body,
    fontWeight: RESUME_FORMAT.fontWeights.body,
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.text,
    marginBottom: RESUME_FORMAT.spacing.paragraphAfter,
  },

  ResumeCompany: {
    fontSize: RESUME_FORMAT.fontSizes.company,
    fontWeight: RESUME_FORMAT.fontWeights.company,
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.secondary,
  },

  ResumeJobTitle: {
    fontSize: RESUME_FORMAT.fontSizes.jobTitle,
    fontWeight: RESUME_FORMAT.fontWeights.jobTitle,
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.text,
  },

  ResumeDates: {
    fontSize: RESUME_FORMAT.fontSizes.dates,
    fontWeight: RESUME_FORMAT.fontWeights.dates,
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.secondary,
  },

  ResumeBullet: {
    fontSize: RESUME_FORMAT.fontSizes.bullets,
    fontWeight: RESUME_FORMAT.fontWeights.body,
    lineHeight: RESUME_FORMAT.lineHeights.bullets,
    color: RESUME_FORMAT.colors.text,
    marginLeft: `${RESUME_FORMAT.bullets.indentInches}in`,
    marginBottom: RESUME_FORMAT.spacing.bulletAfter,
    textIndent: `-${RESUME_FORMAT.bullets.hangingIndentInches}in`,
  },

  ResumeEducation: {
    fontSize: RESUME_FORMAT.fontSizes.body,
    fontWeight: RESUME_FORMAT.fontWeights.body,
    lineHeight: RESUME_FORMAT.lineHeights.body,
    color: RESUME_FORMAT.colors.text,
    marginBottom: RESUME_FORMAT.spacing.paragraphAfter,
  },
} as const;

export type SectionType = typeof RESUME_FORMAT.sectionOrder[number];
