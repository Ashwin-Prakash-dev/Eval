import { Badge } from "@/components/ui/badge";
import type { PriorWork } from "@/types/submission";

/**
 * The narrative half of an application, shared by the admin detail page and the judge
 * evaluation page so both see identical substance.
 *
 * `domains` and `prior_work` are rendered with null and [] distinguished: null means the
 * team never answered, [] means they explicitly declared none. Undeclared prior work is a
 * penalty offence on the startathon side, so collapsing the two would hide a judgeable fact.
 */
export function ApplicationDetails({
  shortDescription,
  problemEvidence,
  domains,
  priorWork,
}: {
  shortDescription: string;
  problemEvidence: string;
  domains: string[] | null;
  priorWork: PriorWork[] | null;
}) {
  return (
    // Summary and problem evidence run to several hundred characters, so the prose is
    // capped at a comfortable measure rather than stretching the full column width.
    <div className="space-y-5 text-sm">
      <section>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Summary</p>
        <p className="max-w-prose leading-relaxed">
          {shortDescription || <span className="text-muted-foreground">No summary provided.</span>}
        </p>
      </section>

      <section>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Problem evidence
        </p>
        <p className="max-w-prose leading-relaxed">
          {problemEvidence || <span className="text-muted-foreground">None provided.</span>}
        </p>
      </section>

      <section>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">Domains</p>
        {domains === null ? (
          <p className="text-muted-foreground">Not answered</p>
        ) : domains.length === 0 ? (
          <p className="text-muted-foreground">None declared</p>
        ) : (
          <div className="flex flex-wrap gap-1">
            {domains.map((domain) => (
              <Badge key={domain} variant="secondary">
                {domain}
              </Badge>
            ))}
          </div>
        )}
      </section>

      <section>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Prior work
        </p>
        {priorWork === null ? (
          <p className="text-muted-foreground">Not answered</p>
        ) : priorWork.length === 0 ? (
          <p className="text-muted-foreground">None declared</p>
        ) : (
          <ul className="space-y-2">
            {priorWork.map((item, index) => (
              <li key={`${item.kind}-${index}`} className="rounded-md border p-2">
                <p className="font-medium">{item.kind}</p>
                <p className="max-w-prose leading-relaxed text-muted-foreground">{item.description}</p>
                {item.url && (
                  <a
                    href={item.url}
                    target="_blank"
                    rel="noopener noreferrer"
                    className="mt-0.5 block truncate text-xs text-primary hover:underline"
                  >
                    {item.url}
                  </a>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
