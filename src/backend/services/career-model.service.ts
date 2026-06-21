import crypto from 'crypto';
import type { Document, CareerModel } from '../../shared/types';

/**
 * Deterministic service that builds a minimal Career Knowledge Layer from uploaded
 * source documents using conservative heuristics.
 *
 * Does NOT call Claude. Uses pattern matching and conservative extraction to build
 * structured knowledge that can be used for resume generation and truthfulness validation.
 *
 * Philosophy:
 * - Never invent facts
 * - Preserve source traceability (every extracted item references source document)
 * - Be conservative: extract only when clearly detectable
 * - Include confidence scores where applicable
 */

interface ExtractedContact {
  name?: string;
  email?: string;
  phone?: string;
  location?: string;
  linkedin?: string;
  website?: string;
}

interface ExtractedRole {
  title: string;
  company: string;
  startDate?: string;
  endDate?: string;
  location?: string;
  achievements: string[];
  sourceDocumentId: string;
  confidence: number;
}

interface ExtractedSkill {
  name: string;
  sourceDocumentId: string;
  confidence: number;
}

interface ExtractedMetric {
  description: string;
  value?: string;
  sourceDocumentId: string;
  confidence: number;
}

interface ExtractedEducation {
  school: string;
  degree?: string;
  graduationDate?: string;
  sourceDocumentId: string;
  confidence: number;
}

interface ExtractedCertification {
  name: string;
  issuer?: string;
  sourceDocumentId: string;
  confidence: number;
}

export class CareerModelService {
  /**
   * Build a Career Model from uploaded documents.
   *
   * This is a conservative first pass: extracts structure when clearly detectable,
   * preserves source traceability, and provides confidence scores.
   */
  buildFromDocuments(sessionId: string, documents: Document[]): CareerModel {
    const sourceDocumentIds = documents.map(d => d.id);
    const sourceHash = this.hashSources(documents);

    // Extract from all documents
    const contact = this.extractContact(documents);
    const roles = this.extractRoles(documents);
    const education = this.extractEducation(documents);
    const certifications = this.extractCertifications(documents);
    const skills = this.extractSkills(documents);
    const tools = this.extractTools(documents);
    const metrics = this.extractMetrics(documents);
    const approvedClaims = this.extractApprovedClaims(documents);

    const model: CareerModel = {
      id: '', // Set by caller when persisting
      session_id: sessionId,
      source_document_ids: sourceDocumentIds,
      source_hash: sourceHash,
      model_json: {
        contact,
        roles: roles.map(r => ({
          title: r.title,
          company: r.company,
          startDate: r.startDate,
          endDate: r.endDate,
          location: r.location,
          achievements: r.achievements,
          confidence: r.confidence,
          sourceDocumentId: r.sourceDocumentId,
        })),
        projects: [],
        skills: skills.map(s => ({
          name: s.name,
          confidence: s.confidence,
          sourceDocumentId: s.sourceDocumentId,
        })),
        tools: tools.map(t => ({
          name: t.name,
          confidence: t.confidence,
          sourceDocumentId: t.sourceDocumentId,
        })),
        metrics: metrics.map(m => ({
          description: m.description,
          value: m.value,
          confidence: m.confidence,
          sourceDocumentId: m.sourceDocumentId,
        })),
        education: education.map(e => ({
          school: e.school,
          degree: e.degree,
          graduationDate: e.graduationDate,
          sourceDocumentId: e.sourceDocumentId,
        })),
        certifications: certifications.map(c => ({
          name: c.name,
          issuer: c.issuer,
          sourceDocumentId: c.sourceDocumentId,
        })),
        approvedClaims,
        sourceDocumentIds,
      },
      model_version: '1.0.0',
      created_at: new Date(),
    };

    return model;
  }

  /**
   * Generate a hash of the source documents for change detection.
   * Same documents always produce the same hash.
   */
  hashSources(documents: Document[]): string {
    const concatenated = documents
      .sort((a, b) => a.id.localeCompare(b.id))
      .map(d => `[${d.type}:${d.filename}]\n${d.raw_text}`)
      .join('\n\n---\n\n');

    return crypto.createHash('sha256').update(concatenated).digest('hex');
  }

  /**
   * Determine if a new Career Model should be built based on source document changes.
   */
  shouldRefreshCareerModel(existingModel: CareerModel | null, documents: Document[]): boolean {
    if (!existingModel) return true; // Always build if none exists
    const newHash = this.hashSources(documents);
    return newHash !== existingModel.source_hash;
  }

  // ===== Extraction Heuristics =====

  private extractContact(documents: Document[]): ExtractedContact {
    const contact: ExtractedContact = {};

    for (const doc of documents) {
      const text = doc.raw_text;

      // Email: conservative pattern
      const emailMatch = text.match(/\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Z|a-z]{2,}\b/);
      if (emailMatch && !contact.email) {
        contact.email = emailMatch[0];
      }

      // Phone: conservative pattern (10 digits with separators or plain)
      const phoneMatch = text.match(/\b(?:\+?1[-.\s]?)?\(?(\d{3})\)?[-.\s]?(\d{3})[-.\s]?(\d{4})\b/);
      if (phoneMatch && !contact.phone) {
        contact.phone = phoneMatch[0];
      }

      // LinkedIn: look for linkedin.com/in/
      const linkedinMatch = text.match(/linkedin\.com\/in\/[\w-]+/i);
      if (linkedinMatch && !contact.linkedin) {
        contact.linkedin = linkedinMatch[0];
      }

      // Website/Portfolio: look for common patterns
      const websiteMatch = text.match(/(https?:\/\/|www\.)[\w.-]+\.\w+/i);
      if (websiteMatch && !contact.website && !websiteMatch[0].includes('linkedin')) {
        contact.website = websiteMatch[0];
      }

      // Location: look for City, State or City, Country patterns (end of lines, in first doc)
      if (doc.type === 'resume' && !contact.location) {
        const locationMatch = text.match(/^(\w+,\s*[A-Z]{2})/m);
        if (locationMatch) {
          contact.location = locationMatch[1];
        }
      }

      // Name: if resume, first line might be the name (conservative)
      if (doc.type === 'resume' && !contact.name) {
        const lines = text.split('\n').filter(l => l.trim());
        if (lines.length > 0) {
          const firstLine = lines[0].trim();
          // Conservative: only if it looks like a name (2-3 words, no numbers, reasonable length)
          if (firstLine.length < 50 && firstLine.split(/\s+/).length <= 3 && !firstLine.match(/\d/)) {
            contact.name = firstLine;
          }
        }
      }
    }

    return contact;
  }

  private extractRoles(documents: Document[]): ExtractedRole[] {
    const roles: ExtractedRole[] = [];
    const resumeDocs = documents.filter(d => d.type === 'resume');

    for (const doc of resumeDocs) {
      const text = doc.raw_text;
      const lines = text.split('\n');

      let currentRole: Partial<ExtractedRole> | null = null;

      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        const trimmed = line.trim();

        // Section header detection (skip these)
        if (
          trimmed.match(/^(PROFESSIONAL EXPERIENCE|EXPERIENCE|WORK HISTORY|EDUCATION|SKILLS|SUMMARY)/i) ||
          trimmed.endsWith(':') === false
        ) {
          if (trimmed.match(/^(PROFESSIONAL|EXPERIENCE|WORK HISTORY|EDUCATION)/i)) {
            continue;
          }
        }

        // Role header pattern: "Title | Company" or "Title\nCompany" or just two lines with caps
        const pipeMatch = trimmed.match(/^(.+?)\s*\|\s*(.+?)(?:\s*\|\s*(.+))?$/);
        if (pipeMatch && !trimmed.match(/^(PROFESSIONAL|EDUCATION|SKILLS)/i)) {
          if (currentRole && currentRole.title) {
            roles.push({
              title: currentRole.title,
              company: currentRole.company || '',
              startDate: currentRole.startDate,
              endDate: currentRole.endDate,
              location: currentRole.location,
              achievements: currentRole.achievements || [],
              sourceDocumentId: doc.id,
              confidence: 0.9,
            });
          }

          currentRole = {
            title: pipeMatch[1].trim(),
            company: pipeMatch[2].trim(),
            achievements: [],
          };

          // Check for dates on same line or next line
          if (pipeMatch[3]) {
            const dateMatch = pipeMatch[3].match(
              /(\d{4})\s*[-–]\s*(?:(\d{4})|Present|Current)/i
            );
            if (dateMatch) {
              currentRole.startDate = dateMatch[1];
              currentRole.endDate = dateMatch[2] || 'Present';
            }
          }
        }

        // Bullet point as achievement
        if (currentRole && trimmed.match(/^[•\-\*]\s/) && trimmed.length > 10) {
          const achievement = trimmed.replace(/^[•\-\*]\s+/, '').trim();
          if (currentRole.achievements) {
            currentRole.achievements.push(achievement);
          }
        }

        // Date pattern on separate line
        if (currentRole && !currentRole.startDate) {
          const dateMatch = trimmed.match(/(\d{4})\s*[-–]\s*(?:(\d{4})|Present|Current)/i);
          if (dateMatch) {
            currentRole.startDate = dateMatch[1];
            currentRole.endDate = dateMatch[2] || 'Present';
          }
        }
      }

      // Don't forget the last role
      if (currentRole && currentRole.title) {
        roles.push({
          title: currentRole.title,
          company: currentRole.company || '',
          startDate: currentRole.startDate,
          endDate: currentRole.endDate,
          location: currentRole.location,
          achievements: currentRole.achievements || [],
          sourceDocumentId: doc.id,
          confidence: 0.85,
        });
      }
    }

    return roles;
  }

  private extractEducation(documents: Document[]): ExtractedEducation[] {
    const education: ExtractedEducation[] = [];

    for (const doc of documents) {
      const text = doc.raw_text;
      const lines = text.split('\n');

      // Look for degree patterns
      const degreePatterns = [
        /^(.+?),?\s+(Bachelor|Master|Ph\.?D|Associate|Certificate)(\s+in\s+(.+))?/i,
        /^(Bachelor|Master|Ph\.?D|Associate|Certificate)(\s+in\s+)?(.+?)(?:\s+from\s+)?(.+)/i,
      ];

      for (const line of lines) {
        const trimmed = line.trim();

        for (const pattern of degreePatterns) {
          const match = trimmed.match(pattern);
          if (match) {
            let school = '';
            let degree = '';

            if (match[1]?.includes('Bachelor') || match[1]?.includes('Master')) {
              degree = match[1];
              school = match[3] || match[4] || '';
            } else {
              school = match[1];
              degree = match[2];
            }

            if (school && school.length > 2) {
              education.push({
                school,
                degree: degree || undefined,
                sourceDocumentId: doc.id,
                confidence: 0.8,
              });
              break;
            }
          }
        }
      }
    }

    return education;
  }

  private extractCertifications(documents: Document[]): ExtractedCertification[] {
    const certifications: ExtractedCertification[] = [];

    for (const doc of documents) {
      const text = doc.raw_text;
      const lines = text.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // Look for certification patterns (usually after "Certifications:" or standalone)
        if (
          trimmed.match(/^(AWS|Google Cloud|Microsoft|Certified|CPA|PMP|CISSP|CCNA)/i) &&
          trimmed.length > 5 &&
          trimmed.length < 100
        ) {
          // Extract issuer if present (e.g., "AWS Certified Solutions Architect")
          const issuerMatch = trimmed.match(/(AWS|Google Cloud|Microsoft|Oracle|Salesforce|Cisco)/i);
          certifications.push({
            name: trimmed,
            issuer: issuerMatch ? issuerMatch[1] : undefined,
            sourceDocumentId: doc.id,
            confidence: 0.75,
          });
        }
      }
    }

    return certifications;
  }

  private extractSkills(documents: Document[]): ExtractedSkill[] {
    const skills: ExtractedSkill[] = [];
    const commonSkills = [
      'project management',
      'communication',
      'teamwork',
      'leadership',
      'problem solving',
      'analytical',
      'strategic planning',
      'negotiation',
      'time management',
      'presentations',
    ];

    for (const doc of documents) {
      const text = doc.raw_text;
      const lines = text.split('\n');

      // Find SKILLS section
      let inSkillsSection = false;
      for (const line of lines) {
        const trimmed = line.trim();

        if (trimmed.match(/^SKILLS|^CORE EXPERTISE|^COMPETENCIES/i)) {
          inSkillsSection = true;
          continue;
        }

        if (inSkillsSection) {
          if (trimmed.match(/^(EXPERIENCE|EDUCATION|PROJECTS|CERTIFICATION)/i)) {
            inSkillsSection = false;
            break;
          }

          if (trimmed && !trimmed.match(/^(PROFESSIONAL|EXPERIENCE|EDUCATION)/i)) {
            // Extract comma-separated skills
            const skillList = trimmed.split(/[,•\n]/).map(s => s.trim()).filter(s => s.length > 1);
            for (const skill of skillList) {
              if (skill.length < 50) {
                // Avoid multi-line descriptions
                skills.push({
                  name: skill,
                  sourceDocumentId: doc.id,
                  confidence: 0.85,
                });
              }
            }
          }
        }
      }
    }

    return skills;
  }

  private extractTools(documents: Document[]): ExtractedSkill[] {
    const tools: ExtractedSkill[] = [];
    const knownTools = [
      'React',
      'Vue',
      'Angular',
      'Python',
      'JavaScript',
      'TypeScript',
      'Java',
      'C\\+\\+',
      'Go',
      'Rust',
      'SQL',
      'MongoDB',
      'PostgreSQL',
      'AWS',
      'Azure',
      'GCP',
      'Docker',
      'Kubernetes',
      'Git',
      'GraphQL',
      'REST',
      'Node\\.js',
      'Express',
      'Django',
      'Flask',
      'Spring',
      'Rails',
      'Next\\.js',
      'Tailwind',
      'Figma',
      'Sketch',
      'Adobe XD',
      'Jira',
      'Confluence',
    ];

    const toolNameMap: { [key: string]: string } = {
      'C\\+\\+': 'C++',
      'Node\\.js': 'Node.js',
      'Next\\.js': 'Next.js',
    };

    for (const doc of documents) {
      const text = doc.raw_text;

      for (const toolPattern of knownTools) {
        // Case-insensitive match but preserve original tool name
        if (text.match(new RegExp(`\\b${toolPattern}\\b`, 'i'))) {
          const toolName = toolNameMap[toolPattern] || toolPattern;
          if (!tools.find(t => t.name.toLowerCase() === toolName.toLowerCase())) {
            tools.push({
              name: toolName,
              sourceDocumentId: doc.id,
              confidence: 0.9,
            });
          }
        }
      }
    }

    return tools;
  }

  private extractMetrics(documents: Document[]): ExtractedMetric[] {
    const metrics: ExtractedMetric[] = [];

    for (const doc of documents) {
      const text = doc.raw_text;
      const lines = text.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // Look for bullet-like lines with metrics
        if (trimmed.match(/^[•\-\*]\s/)) {
          const bullet = trimmed.replace(/^[•\-\*]\s+/, '');

          // Check for metric patterns
          const metricPatterns = [
            /(\d+)%/,
            /(\$[\d,]+)/,
            /(\d+)x/,
            /([\d.]+)(k|m|b|million|billion|thousand)/i,
            /(increased|decreased|reduced|improved|grew|grew|achieved)\s+(?:by\s+)?(\d+)%/i,
            /(\d+)\s+(users|customers|clients|members)/i,
          ];

          let foundMetric = false;
          for (const pattern of metricPatterns) {
            if (bullet.match(pattern)) {
              const match = bullet.match(pattern);
              if (match) {
                metrics.push({
                  description: bullet,
                  value: match[0],
                  sourceDocumentId: doc.id,
                  confidence: 0.85,
                });
                foundMetric = true;
                break;
              }
            }
          }
        }
      }
    }

    return metrics;
  }

  private extractApprovedClaims(documents: Document[]): Array<{
    claim: string;
    supportingEvidence: string[];
    sourceDocumentIds: string[];
    confidence: number;
    category: 'achievement' | 'skill' | 'metric' | 'experience';
  }> {
    const claims: Array<{
      claim: string;
      supportingEvidence: string[];
      sourceDocumentIds: string[];
      confidence: number;
      category: 'achievement' | 'skill' | 'metric' | 'experience';
    }> = [];

    for (const doc of documents) {
      const text = doc.raw_text;
      const lines = text.split('\n');

      for (const line of lines) {
        const trimmed = line.trim();

        // Extract bullet points as approved claims
        if (trimmed.match(/^[•\-\*]\s/) && trimmed.length > 20) {
          const claim = trimmed.replace(/^[•\-\*]\s+/, '').trim();

          // Categorize the claim
          let category: 'achievement' | 'skill' | 'metric' | 'experience' = 'achievement';

          if (claim.match(/(%|increased|decreased|reduced|grew|saved|improved)/i)) {
            category = 'metric';
          } else if (claim.match(/proficient|expert|skilled|experienced|knowledge/i)) {
            category = 'skill';
          } else if (claim.match(/(managed|led|developed|built|designed|created)/i)) {
            category = 'experience';
          }

          claims.push({
            claim,
            supportingEvidence: [claim],
            sourceDocumentIds: [doc.id],
            confidence: 0.8,
            category,
          });
        }
      }
    }

    return claims;
  }
}

export const careerModelService = new CareerModelService();
