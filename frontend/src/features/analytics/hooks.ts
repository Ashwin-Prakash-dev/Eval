import { useQuery } from "@tanstack/react-query";

import { analyticsApi, type LeaderboardParams } from "./api";

export function useAnalyticsOverview() {
  return useQuery({ queryKey: ["analytics", "overview"], queryFn: analyticsApi.overview, refetchInterval: 30_000 });
}

export function useLeaderboard(params: LeaderboardParams) {
  return useQuery({ queryKey: ["leaderboard", params], queryFn: () => analyticsApi.leaderboard(params) });
}
