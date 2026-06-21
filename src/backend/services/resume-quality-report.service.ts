/**
 * Resume Quality Report service.
 *
 * Evaluates generated resumes against the Career Knowledge Layer for:
 * - Truthfulness (source support)
 * - ATS compliance
 * - Keyword alignment with job description
 * - Length/page estimates
 * - Export readiness
 *
 * Uses deterministic matching only. No Claude calls.
 */

import type { CareerModel } from '../../shared/types';

export interface ResumeQualityReport {
  exportReady: boolean;
  overallStatus: 'pass' | 'warn' | 'fail';
  ats: {
    status: 'pass' | 'warn' | 'fail';
    warnings: string[];
  };
  truthfulness: {
    status: 'pass' | 'warn' | 'fail';
    supportedClaims: string[];
    weaklySupportedClaims: string[];
    unsupportedClaims: string[];
  };
  keywords: {
    matched: string[];
    missing: string[];
    suggestedIfTruthful: string[];
  };
  length: {
    estimatedPages: number;
    warnings: string[];
  };
}

export class ResumeQualityReportService {
  /**
   * Build a quality report for a generated resume.
   */
  buildReport(input: {
    generatedContent: string;
    careerModel: CareerModel;
    jobDescription: string;
  }): ResumeQualityReport {
    const { generatedContent, careerModel, jobDescription } = input;

    const truthfulness = this.evaluateTruthfulness(generatedContent, careerModel);
    const ats = this.evaluateAts(generatedContent);
    const keywords = this.evaluateKeywords(generatedContent, jobDescription);
    const length = this.estimateLength(generatedContent);

    const exportReady = this.calculateExportReadiness(truthfulness, ats);
    const overallStatus = this.calculateOverallStatus(truthfulness, ats, keywords, length);

    return {
      exportReady,
      overallStatus,
      ats,
      truthfulness,
      keywords,
      length,
    };
  }

  // ===== Truthfulness Evaluation =====

  private evaluateTruthfulness(
    generatedContent: string,
    careerModel: CareerModel
  ): ResumeQualityReport['truthfulness'] {
    const bullets = this.extractBullets(generatedContent);
    const supportedClaims: string[] = [];
    const weaklySupportedClaims: string[] = [];
    const unsupportedClaims: string[] = [];

    // Build searchable knowledge base from CareerModel
    const knowledgeBase = this.buildKnowledgeBase(careerModel);

    for (const bullet of bullets) {
      const match = this.matchBulletToKnowledge(bullet, knowledgeBase);

      if (match === 'supported') {
        supportedClaims.push(bullet);
      } else if (match === 'weakly-supported') {
        weaklySupportedClaims.push(bullet);
      } else {
        unsupportedClaims.push(bullet);
      }
    }

    // Status logic
    let status: 'pass' | 'warn' | 'fail' = 'pass';
    if (unsupportedClaims.length > 0) {
      // Check for risky unsupported claims (metrics, named entities)
      const riskyUnsupported = unsupportedClaims.filter(claim => this.isRiskyUnsupported(claim));
      if (riskyUnsupported.length > 0) {
        status = 'fail';
      } else if (unsupportedClaims.length > weaklySupportedClaims.length + supportedClaims.length * 0.5) {
        status = 'warn';
      }
    }

    return {
      status,
      supportedClaims,
      weaklySupportedClaims,
      unsupportedClaims,
    };
  }

  private buildKnowledgeBase(
    careerModel: CareerModel
  ): {
    phrases: string[];
    tools: Set<string>;
    metrics: string[];
    companies: Set<string>;
    titles: Set<string>;
    certifications: Set<string>;
  } {
    const phrases: string[] = [];
    const tools = new Set<string>();
    const metrics: string[] = [];
    const companies = new Set<string>();
    const titles = new Set<string>();
    const certifications = new Set<string>();

    const { model_json } = careerModel;

    // Approved claims
    if (model_json.approvedClaims) {
      for (const claim of model_json.approvedClaims) {
        phrases.push(claim.claim);
        // Extract metrics from claims
        const metricMatch = claim.claim.match(/(\d+%|[\$€£]\d+|[\d.]+x|[\d,]+\s+\w+)/);
        if (metricMatch) {
          metrics.push(metricMatch[0]);
        }
      }
    }

    // Roles and achievements
    if (model_json.roles) {
      for (const role of model_json.roles) {
        titles.add(role.title);
        companies.add(role.company);
        if (role.achievements) {
          phrases.push(...role.achievements);
        }
      }
    }

    // Skills
    if (model_json.skills) {
      for (const skill of model_json.skills) {
        phrases.push(skill.name);
      }
    }

    // Tools
    if (model_json.tools) {
      for (const tool of model_json.tools) {
        tools.add(tool.name);
      }
    }

    // Metrics
    if (model_json.metrics) {
      for (const metric of model_json.metrics) {
        phrases.push(metric.description);
        if (metric.value) {
          metrics.push(String(metric.value));
        }
      }
    }

    // Education
    if (model_json.education) {
      for (const edu of model_json.education) {
        phrases.push(edu.school);
        if (edu.degree) phrases.push(edu.degree);
      }
    }

    // Certifications
    if (model_json.certifications) {
      for (const cert of model_json.certifications) {
        certifications.add(cert.name);
        if (cert.issuer) certifications.add(cert.issuer);
      }
    }

    return {
      phrases: phrases.filter(p => p && p.length > 2),
      tools,
      metrics,
      companies,
      titles,
      certifications,
    };
  }

  private matchBulletToKnowledge(
    bullet: string,
    knowledgeBase: ReturnType<typeof this.buildKnowledgeBase>
  ): 'supported' | 'weakly-supported' | 'unsupported' {
    const bulletLower = bullet.toLowerCase();

    // Check for exact phrase matches
    for (const phrase of knowledgeBase.phrases) {
      if (bulletLower.includes(phrase.toLowerCase())) {
        return 'supported';
      }
    }

    // Check for tools
    for (const tool of knowledgeBase.tools) {
      if (bulletLower.includes(tool.toLowerCase())) {
        return 'supported';
      }
    }

    // Check for companies/titles
    for (const company of knowledgeBase.companies) {
      if (bulletLower.includes(company.toLowerCase())) {
        return 'supported';
      }
    }

    for (const title of knowledgeBase.titles) {
      if (bulletLower.includes(title.toLowerCase())) {
        return 'supported';
      }
    }

    // Check for certifications
    for (const cert of knowledgeBase.certifications) {
      if (bulletLower.includes(cert.toLowerCase())) {
        return 'supported';
      }
    }

    // Weak match: check for keyword overlap
    const keywords = bulletLower.split(/\s+/).filter(w => w.length > 3);
    let matchCount = 0;

    for (const kbPhrase of knowledgeBase.phrases) {
      const kbWords = kbPhrase.toLowerCase().split(/\s+/);
      for (const kbWord of kbWords) {
        if (keywords.includes(kbWord) && kbWord.length > 4) {
          matchCount++;
        }
      }
    }

    if (matchCount >= 2) {
      return 'weakly-supported';
    }

    return 'unsupported';
  }

  private isRiskyUnsupported(claim: string): boolean {
    // Check for metrics, percentages, currency, or named entities
    const riskPatterns = [
      /\d+%/,
      /[\$€£]\d+/,
      /\d+x/,
      /\d+k|\d+m|\d+b/i, // thousands, millions, billions
      /[A-Z][a-z]+\s+[A-Z][a-z]+/, // Likely proper nouns
      /(AWS|GCP|Azure|Salesforce|Oracle|IBM|Microsoft|Google|Apple|Meta|Facebook)/i,
    ];

    for (const pattern of riskPatterns) {
      if (pattern.test(claim)) {
        return true;
      }
    }

    return false;
  }

  // ===== ATS Evaluation =====

  private evaluateAts(generatedContent: string): ResumeQualityReport['ats'] {
    const warnings: string[] = [];
    const upperContent = generatedContent.toUpperCase();

    // Check for required sections (with alternatives for skills)
    const requiredSections = [
      { name: 'SUMMARY', alternatives: ['OBJECTIVE', 'PROFESSIONAL SUMMARY'] },
      { name: 'EXPERIENCE', alternatives: ['PROFESSIONAL EXPERIENCE', 'WORK HISTORY'] },
      { name: 'EDUCATION', alternatives: [] },
      { name: 'SKILLS', alternatives: ['CORE EXPERTISE', 'EXPERTISE', 'COMPETENCIES', 'TECHNICAL SKILLS'] },
    ];

    for (const section of requiredSections) {
      const found = upperContent.includes(section.name) ||
                    section.alternatives.some(alt => upperContent.includes(alt));
      if (!found) {
        warnings.push(`Missing required section: ${section.name}`);
      }
    }

    // Check for common formatting issues
    if (generatedContent.match(/[|—–]/g) && generatedContent.match(/[|—–]/g)!.length > 20) {
      warnings.push('Excessive use of separators (pipes, dashes) may confuse ATS');
    }

    // Check for bullet points
    const bulletCount = (generatedContent.match(/^[•\-*]/gm) || []).length;
    if (bulletCount === 0) {
      warnings.push('No bullet points detected - may not be ATS-friendly');
    }
    if (bulletCount > 40) {
      warnings.push('Excessive bullet points may exceed one page');
    }

    // Check for suspicious formatting
    if (generatedContent.match(/\t/g)) {
      warnings.push('Contains tabs - may not render consistently in ATS');
    }

    const status = warnings.length === 0 ? 'pass' : warnings.length > 2 ? 'fail' : 'warn';

    return {
      status,
      warnings,
    };
  }

  // ===== Keyword Evaluation =====

  private evaluateKeywords(
    generatedContent: string,
    jobDescription: string
  ): ResumeQualityReport['keywords'] {
    const matched: string[] = [];
    const missing: string[] = [];
    const suggestedIfTruthful: string[] = [];

    // Extract keywords from job description
    const jdKeywords = this.extractKeywords(jobDescription);

    // Check each keyword against resume
    const resumeLower = generatedContent.toLowerCase();

    for (const keyword of jdKeywords) {
      if (resumeLower.includes(keyword.toLowerCase())) {
        matched.push(keyword);
      } else {
        // Could be important
        if (this.isImportantKeyword(keyword)) {
          missing.push(keyword);
          suggestedIfTruthful.push(keyword);
        }
      }
    }

    return {
      matched,
      missing,
      suggestedIfTruthful,
    };
  }

  private extractKeywords(text: string): string[] {
    // Simple keyword extraction: split on spaces, filter stop words and short terms
    const stopWords = new Set([
      'the',
      'a',
      'an',
      'and',
      'or',
      'but',
      'in',
      'on',
      'at',
      'to',
      'for',
      'of',
      'by',
      'with',
      'as',
      'is',
      'was',
      'be',
      'are',
      'have',
      'has',
      'had',
      'do',
      'does',
      'did',
      'will',
      'would',
      'could',
      'should',
      'may',
      'might',
      'must',
      'can',
      'we',
      'you',
      'he',
      'she',
      'it',
      'they',
      'our',
      'their',
      'your',
      'from',
      'up',
      'about',
      'out',
      'if',
    ]);

    const words = text
      .toLowerCase()
      .split(/\s+/)
      .filter(w => w.length > 3 && !stopWords.has(w) && !/[^a-z]/i.test(w));

    // Deduplicate and return top terms
    const freq = new Map<string, number>();
    for (const word of words) {
      freq.set(word, (freq.get(word) || 0) + 1);
    }

    return Array.from(freq.entries())
      .filter(([_, count]) => count >= 1)
      .sort((a, b) => b[1] - a[1])
      .slice(0, 15)
      .map(([word]) => word);
  }

  private isImportantKeyword(keyword: string): boolean {
    // Keywords with 8+ chars are likely important domain terms
    return keyword.length >= 8;
  }

  // ===== Length Estimation =====

  private estimateLength(generatedContent: string): ResumeQualityReport['length'] {
    const warnings: string[] = [];

    // Simple heuristic: ~500 words per page (resume is usually 10-11pt, 1" margins)
    const wordCount = generatedContent.split(/\s+/).length;
    const estimatedPages = Math.ceil(wordCount / 500);

    if (estimatedPages > 1) {
      warnings.push(`Estimated ${estimatedPages} pages - ideally should fit on 1 page`);
    }

    // Check bullet count (more bullets = more content)
    const bulletCount = (generatedContent.match(/^[•\-*]/gm) || []).length;
    if (bulletCount > 20) {
      warnings.push(`${bulletCount} bullet points may exceed one page`);
    }

    return {
      estimatedPages,
      warnings,
    };
  }

  // ===== Helper Methods =====

  private extractBullets(content: string): string[] {
    const lines = content.split('\n');
    const bullets: string[] = [];

    for (const line of lines) {
      const trimmed = line.trim();
      if (trimmed.match(/^[•\-*]\s+/)) {
        const bullet = trimmed.replace(/^[•\-*]\s+/, '').trim();
        if (bullet.length > 5) {
          bullets.push(bullet);
        }
      }
    }

    return bullets;
  }

  private calculateExportReadiness(
    truthfulness: ResumeQualityReport['truthfulness'],
    ats: ResumeQualityReport['ats']
  ): boolean {
    // Not export-ready if critical failures
    if (truthfulness.status === 'fail') return false;
    if (ats.status === 'fail') return false;

    // Can export with warnings
    return true;
  }

  private calculateOverallStatus(
    truthfulness: ResumeQualityReport['truthfulness'],
    ats: ResumeQualityReport['ats'],
    keywords: ResumeQualityReport['keywords'],
    length: ResumeQualityReport['length']
  ): 'pass' | 'warn' | 'fail' {
    // Fail if any component fails
    if (truthfulness.status === 'fail' || ats.status === 'fail') {
      return 'fail';
    }

    // Warn if any component warns
    if (truthfulness.status === 'warn' || ats.status === 'warn' || length.warnings.length > 0) {
      return 'warn';
    }

    // Pass if no critical issues
    return 'pass';
  }
}

export const resumeQualityReportService = new ResumeQualityReportService();
