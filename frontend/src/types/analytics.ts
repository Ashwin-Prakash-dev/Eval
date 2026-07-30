export interface DashboardStats {
  total_submissions: number;
  total_judges: number;
  total_reviews: number;
  completed_reviews: number;
  pending_reviews: number;
  average_score: number | null;
}

export interface SubmissionDistributionPoint {
  problem_statement: string;
  count: number;
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
  problem_statement: string | null;
  overall_score: number | null;
  criterion_scores: Record<string, number>;
  std_dev: number | null;
  reviews_completed: number;
  is_flagged: boolean;
}

export interface AnalyticsOverview {
  stats: DashboardStats;
  submission_distribution: SubmissionDistributionPoint[];
  judge_progress: JudgeProgressPoint[];
  score_distribution: ScoreDistributionBucket[];
  criterion_averages: CriterionAveragePoint[];
  leaderboard_preview: LeaderboardEntry[];
}
