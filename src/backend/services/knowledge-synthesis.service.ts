import { v4 as uuid } from 'uuid';
import type {
  Skill,
  Achievement,
  Technology,
  WritingStyle,
  Value,
  SourceRef,
} from '../../shared/types';

export class KnowledgeSynthesisService {
  /**
   * Synthesize knowledge from multiple extraction results.
   * Deduplicates and merges items, aggregating confidence from multiple sources.
   */
  synthesize(allExtractions: {
    skills: Skill[];
    achievements: Achievement[];
    technologies: Technology[];
    writingStyle: WritingStyle;
    values: Value[];
  }[]): {
    skills: Skill[];
    achievements: Achievement[];
    technologies: Technology[];
    writingStyle: WritingStyle;
    values: Value[];
  } {
    return {
      skills: this.dedupeSkills(allExtractions.flatMap(e => e.skills)),
      achievements: this.dedupeAchievements(
        allExtractions.flatMap(e => e.achievements)
      ),
      technologies: this.dedupeTechnologies(
        allExtractions.flatMap(e => e.technologies)
      ),
      writingStyle: this.synthesizeWritingStyle(
        allExtractions.map(e => e.writingStyle)
      ),
      values: this.dedupeValues(allExtractions.flatMap(e => e.values)),
    };
  }

  private dedupeSkills(skills: Skill[]): Skill[] {
    if (skills.length === 0) return [];

    // Group by normalized name (lowercase, trim)
    const grouped = new Map<string, Skill[]>();
    for (const skill of skills) {
      const key = skill.name.toLowerCase().trim();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(skill);
    }

    // Merge each group
    return Array.from(grouped.values()).map(group => this.mergeSkillGroup(group));
  }

  private mergeSkillGroup(skills: Skill[]): Skill {
    // Use first occurrence as base, merge metadata
    const primary = skills[0];
    const allRefs = skills.flatMap(s => s.source_refs_json);
    const avgConfidence = skills.reduce((sum, s) => sum + s.confidence, 0) / skills.length;
    const maxYears = Math.max(...skills.map(s => s.years_experience || 0));

    return {
      id: 'skill-' + uuid().replace(/-/g, '').substring(0, 16),
      name: primary.name,
      category: primary.category,
      years_experience: maxYears > 0 ? maxYears : undefined,
      confidence: Math.min(1, avgConfidence),
      source_document_id: primary.source_document_id,
      source_excerpt: primary.source_excerpt,
      source_refs_json: this.dedupeRefs(allRefs),
    };
  }

  private dedupeAchievements(achievements: Achievement[]): Achievement[] {
    if (achievements.length === 0) return [];

    // Group by normalized title
    const grouped = new Map<string, Achievement[]>();
    for (const ach of achievements) {
      const key = ach.title.toLowerCase().trim();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(ach);
    }

    return Array.from(grouped.values()).map(group =>
      this.mergeAchievementGroup(group)
    );
  }

  private mergeAchievementGroup(achievements: Achievement[]): Achievement {
    const primary = achievements[0];
    const allRefs = achievements.flatMap(a => a.source_refs_json);
    const avgConfidence =
      achievements.reduce((sum, a) => sum + a.confidence, 0) /
      achievements.length;

    // Merge metrics (unique)
    const uniqueMetrics = Array.from(
      new Set(achievements.flatMap(a => a.metrics))
    );

    // Merge skills demonstrated (unique)
    const uniqueSkills = Array.from(
      new Set(achievements.flatMap(a => a.skills_demonstrated))
    );

    return {
      id: 'ach-' + uuid().replace(/-/g, '').substring(0, 16),
      title: primary.title,
      context: primary.context,
      metrics: uniqueMetrics,
      skills_demonstrated: uniqueSkills,
      confidence: Math.min(1, avgConfidence),
      source_document_id: primary.source_document_id,
      source_excerpt: primary.source_excerpt,
      source_refs_json: this.dedupeRefs(allRefs),
    };
  }

  private dedupeTechnologies(technologies: Technology[]): Technology[] {
    if (technologies.length === 0) return [];

    const grouped = new Map<string, Technology[]>();
    for (const tech of technologies) {
      const key = tech.name.toLowerCase().trim();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(tech);
    }

    return Array.from(grouped.values()).map(group =>
      this.mergeTechnologyGroup(group)
    );
  }

  private mergeTechnologyGroup(technologies: Technology[]): Technology {
    const primary = technologies[0];
    const allRefs = technologies.flatMap(t => t.source_refs_json);
    const avgConfidence =
      technologies.reduce((sum, t) => sum + t.confidence, 0) /
      technologies.length;

    // Use highest proficiency level
    const proficiencyRank = { beginner: 1, intermediate: 2, expert: 3 };
    const bestProficiency = technologies.reduce((best, t) => {
      return proficiencyRank[t.proficiency] > proficiencyRank[best.proficiency]
        ? t.proficiency
        : best.proficiency;
    });

    return {
      id: 'tech-' + uuid().replace(/-/g, '').substring(0, 16),
      name: primary.name,
      proficiency: bestProficiency,
      confidence: Math.min(1, avgConfidence),
      source_document_id: primary.source_document_id,
      source_excerpt: primary.source_excerpt,
      source_refs_json: this.dedupeRefs(allRefs),
    };
  }

  private synthesizeWritingStyle(styles: WritingStyle[]): WritingStyle {
    if (styles.length === 0) {
      return {
        tone: 'professional',
        voice_markers: [],
        examples: [],
        confidence: 0,
        source_refs_json: [],
      };
    }

    const avgConfidence =
      styles.reduce((sum, s) => sum + s.confidence, 0) / styles.length;

    // Find most common tone
    const toneCounts = styles.reduce(
      (acc, s) => {
        acc[s.tone] = (acc[s.tone] || 0) + 1;
        return acc;
      },
      {} as Record<string, number>
    );
    const tone = (
      Object.entries(toneCounts).sort(([, a], [, b]) => b - a)[0] || [
        'professional',
      ]
    )[0] as WritingStyle['tone'];

    // Merge unique markers and examples
    const allRefs = styles.flatMap(s => s.source_refs_json);
    const uniqueMarkers = Array.from(
      new Set(styles.flatMap(s => s.voice_markers))
    );
    const uniqueExamples = Array.from(
      new Set(styles.flatMap(s => s.examples))
    );

    return {
      tone,
      voice_markers: uniqueMarkers,
      examples: uniqueExamples,
      confidence: Math.min(1, avgConfidence),
      source_refs_json: this.dedupeRefs(allRefs),
    };
  }

  private dedupeValues(values: Value[]): Value[] {
    if (values.length === 0) return [];

    const grouped = new Map<string, Value[]>();
    for (const value of values) {
      const key = value.value.toLowerCase().trim();
      if (!grouped.has(key)) grouped.set(key, []);
      grouped.get(key)!.push(value);
    }

    return Array.from(grouped.values()).map(group =>
      this.mergeValueGroup(group)
    );
  }

  private mergeValueGroup(values: Value[]): Value {
    const primary = values[0];
    const allRefs = values.flatMap(v => v.source_refs_json);
    const avgConfidence =
      values.reduce((sum, v) => sum + v.confidence, 0) / values.length;

    return {
      value: primary.value,
      confidence: Math.min(1, avgConfidence),
      source_document_id: primary.source_document_id,
      source_excerpt: primary.source_excerpt,
      source_refs_json: this.dedupeRefs(allRefs),
    };
  }

  private dedupeRefs(refs: SourceRef[]): SourceRef[] {
    // Keep unique refs by document_id
    const seen = new Set<string>();
    return refs.filter(ref => {
      const key = ref.document_id;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    });
  }
}

export const synthesizer = new KnowledgeSynthesisService();
