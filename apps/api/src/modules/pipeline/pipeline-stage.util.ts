export type PipelineStage = 'TO_WORK' | 'READY' | 'SHOT' | 'EDITING' | 'PUBLISHED';

type TopicStatus = 'DRAFT' | 'READY' | 'ARCHIVED';
type SessionLike = { status: string; publishedAt: Date | string | null };
type ProjectLike = { status: 'DRAFT' | 'EDITING' | 'RENDERING' | 'DONE' | 'FAILED' };
type CalendarLike = {
  status: 'PLANNED' | 'RECORDED' | 'EDITING' | 'DELIVERED' | 'PUBLISHED' | 'SKIPPED';
};

export type DerivePipelineStageInput = {
  topicStatus: TopicStatus;
  sessions: SessionLike[];
  projects: ProjectLike[];
  calendarEntries: CalendarLike[];
};

export function derivePipelineStage(input: DerivePipelineStageInput): PipelineStage {
  const { topicStatus, sessions, projects, calendarEntries } = input;

  if (
    calendarEntries.some((c) => c.status === 'PUBLISHED') ||
    sessions.some((s) => s.publishedAt !== null && s.publishedAt !== undefined)
  ) {
    return 'PUBLISHED';
  }

  if (
    projects.some((p) => p.status === 'EDITING' || p.status === 'RENDERING') ||
    calendarEntries.some((c) => c.status === 'EDITING' || c.status === 'DELIVERED')
  ) {
    return 'EDITING';
  }

  const shotSessionStatuses = new Set(['SUBMITTED', 'PROCESSING', 'DONE', 'DELIVERED']);
  if (
    sessions.some((s) => shotSessionStatuses.has(s.status)) ||
    calendarEntries.some((c) => c.status === 'RECORDED')
  ) {
    return 'SHOT';
  }

  if (topicStatus === 'READY') {
    return 'READY';
  }

  return 'TO_WORK';
}
