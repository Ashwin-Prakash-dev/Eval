export interface DashboardStats {
  total_submissions: number;
  total_judges: number;
  total_reviews: number;
  completed_reviews: number;
  pending_reviews: number;
  average_score: number | null;
}

/**
 * Review coverage. With no allocation step, coverage is emergent rather than guaranteed —
 * this is what tells an organiser whether every submission will actually get scored.
 */
export interface CoverageBucket {
  label: string;
  count: number;
}

export interface CoverageSubmission {
  id: string;
  project_title: string;
  team_identifier: string;
  /** Excludes reviews invalidated by a later edit — they provide no coverage. */
  completed_reviews: number;
  /** At least one completed review was invalidated when the team edited the submission. */
  needs_reevaluation: boolean;
  needed: number;
  is_scored: boolean;
}

export interface CoverageOut {
  scoring_limit: number;
  total_submissions: number;
  fully_scored: number;
  unreviewed: number;
  buckets: CoverageBucket[];
  submissions: CoverageSubmission[];
}

export interface JudgeProgressPoint {
  judge_id: number;
  judge_name: string;
  completed: number;
  pending: number;
  total: number;
}

export interface ScoreDistributionBucket {
  range_label: string;
  count: number;
}

export interface CriterionAveragePoint {
  criterion_id: number;
  criterion_name: string;
  average_score: number;
}

export interface LeaderboardEntry {
  rank: number;
  submission_id: number;
  project_title: string;
  overall_score: number | null;
  criterion_scores: Record<string, number>;
  std_dev: number | null;
  reviews_completed: number;
  is_flagged: boolean;
  /**
   * The team edited the submission after it was reviewed. `overall_score` and `std_dev` are
   * withheld (null) while this is true rather than reporting a figure computed from content
   * that has since changed; `reviews_completed` counts only the reviews that still apply.
   */
  needs_reevaluation: boolean;
}

export interface AnalyticsOverview {
  stats: DashboardStats;
  coverage: CoverageOut;
  judge_progress: JudgeProgressPoint[];
  score_distribution: ScoreDistributionBucket[];
  criterion_averages: CriterionAveragePoint[];
  leaderboard_preview: LeaderboardEntry[];
}
