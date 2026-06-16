import { z } from 'zod';

const SourceRefSchema = z.object({
  document_id: z.string(),
  excerpt: z.string(),
  confidence: z.number().min(0).max(1),
});

export const SkillSchema = z.object({
  id: z.string(),
  name: z.string(),
  category: z.enum(['frontend', 'backend', 'design', 'leadership', 'other']),
  years_experience: z.number().optional(),
  confidence: z.number().min(0).max(1),
  source_document_id: z.string(),
  source_excerpt: z.string(),
  source_refs_json: z.array(SourceRefSchema),
});

export const AchievementSchema = z.object({
  id: z.string(),
  title: z.string(),
  context: z.string(),
  metrics: z.array(z.string()),
  skills_demonstrated: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  source_document_id: z.string(),
  source_excerpt: z.string(),
  source_refs_json: z.array(SourceRefSchema),
});

export const TechnologySchema = z.object({
  id: z.string(),
  name: z.string(),
  proficiency: z.enum(['beginner', 'intermediate', 'expert']),
  confidence: z.number().min(0).max(1),
  source_document_id: z.string(),
  source_excerpt: z.string(),
  source_refs_json: z.array(SourceRefSchema),
});

export const WritingStyleSchema = z.object({
  tone: z.enum(['professional', 'conversational', 'technical']),
  voice_markers: z.array(z.string()),
  examples: z.array(z.string()),
  confidence: z.number().min(0).max(1),
  source_refs_json: z.array(SourceRefSchema),
});

export const ValueSchema = z.object({
  value: z.string(),
  confidence: z.number().min(0).max(1),
  source_document_id: z.string(),
  source_excerpt: z.string(),
  source_refs_json: z.array(SourceRefSchema),
});

export const KnowledgeBaseSchema = z.object({
  id: z.string(),
  skills: z.array(SkillSchema),
  achievements: z.array(AchievementSchema),
  technologies: z.array(TechnologySchema),
  writing_style: WritingStyleSchema,
  values: z.array(ValueSchema),
  extracted_at: z.date().optional(),
  synthesized_at: z.date().optional(),
  synthesis_version: z.number().int(),
  created_at: z.date(),
  updated_at: z.date(),
});

export const DocumentSchema = z.object({
  id: z.string(),
  type: z.enum(['resume', 'cover_letter', 'case_study', 'linkedin']),
  filename: z.string(),
  raw_text: z.string(),
  uploaded_at: z.date(),
  parsed_at: z.date().optional(),
});

export const JobSchema = z.object({
  id: z.string(),
  title: z.string(),
  company: z.string().optional(),
  description: z.string(),
  added_at: z.date(),
});
