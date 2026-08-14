import { apiClient } from "@/lib/api-client";
import type { AnalyticsOverview, CoverageOut, LeaderboardEntry } from "@/types/analytics";
import type { Page } from "@/types/common";

export interface LeaderboardParams {
  page: number;
  page_size: number;
  search?: string;
  sort_by?: string;
  sort_dir?: string;
}

export const analyticsApi = {
  overview: () => apiClient.get<AnalyticsOverview>("/analytics/overview").then((r) => r.data),
  coverage: () => apiClient.get<CoverageOut>("/analytics/coverage").then((r) => r.data),
  leaderboard: (params: LeaderboardParams) =>
    apiClient.get<Page<LeaderboardEntry>>("/analytics/leaderboard", { params }).then((r) => r.data),
};

export const exportApi = {
  download: async (format: "csv" | "xlsx" | "pdf") => {
    const response = await apiClient.get(`/export/${format}`, { responseType: "blob" });
    const url = URL.createObjectURL(response.data);
    const link = document.createElement("a");
    link.href = url;
    link.download = `startathon-report.${format}`;
    document.body.appendChild(link);
    link.click();
    link.remove();
    URL.revokeObjectURL(url);
  },
};
