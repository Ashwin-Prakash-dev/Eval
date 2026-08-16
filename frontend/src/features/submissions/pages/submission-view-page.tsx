import { ArrowLeft, FileText, Video } from "lucide-react";
import { useNavigate, useParams } from "react-router-dom";

import { ApplicationDetails } from "@/components/shared/application-details";
import { DeckLink, VideoEmbed } from "@/components/shared/media-viewer";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Skeleton } from "@/components/ui/skeleton";

import { useSubmission } from "../hooks";

/**
 * A judge's read-only view of one submission, reached by clicking a leaderboard row.
 *
 * Deliberately NOT the admin SubmissionDetailPage. That page lists every judge's evaluation
 * by name with their scores and comments, which is organiser oversight -- the same reason the
 * judge leaderboard withholds std-dev. This page shows the submission itself and nothing
 * about who scored it or how.
 *
 * The server sends judges `SubmissionJudgeOut`, so there is no admin-only field here to
 * forget to hide.
 */
export function SubmissionViewPage() {
  const { id: submissionId } = useParams();
  const navigate = useNavigate();
  const { data: submission, isLoading } = useSubmission(submissionId);

  if (isLoading || !submission) {
    return (
      <div className="space-y-4">
        <Skeleton className="h-8 w-64" />
        <Skeleton className="h-64 w-full" />
      </div>
    );
  }

  return (
    <div>
      <Button variant="ghost" size="sm" className="mb-2" onClick={() => navigate("/judge/leaderboard")}>
        <ArrowLeft className="h-4 w-4" /> Back to leaderboard
      </Button>
      <PageHeader title={submission.project_title} description={`Team: ${submission.team_identifier}`} />

      <div className="grid gap-6 lg:grid-cols-3">
        {/* The application text is the substance, so it takes the wide column; the deck and
            video are reference material in the rail -- the same split the admin page uses. */}
        <div className="space-y-6 lg:col-span-2">
          <Card>
            <CardHeader>
              <CardTitle>Application</CardTitle>
            </CardHeader>
            <CardContent>
              <ApplicationDetails
                shortDescription={submission.short_description}
                problemEvidence={submission.problem_evidence}
                domains={submission.domains}
                priorWork={submission.prior_work}
                members={submission.members}
              />
            </CardContent>
          </Card>
        </div>

        <div className="space-y-6">
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <Video className="h-4 w-4" /> Pitch video
              </CardTitle>
            </CardHeader>
            <CardContent>
              <VideoEmbed url={submission.video_url} />
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle className="flex items-center gap-2">
                <FileText className="h-4 w-4" /> Deck
              </CardTitle>
            </CardHeader>
            <CardContent>
              <DeckLink url={submission.deck_url} />
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
