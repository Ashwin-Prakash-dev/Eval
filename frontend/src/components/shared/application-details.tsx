import { Badge } from "@/components/ui/badge";
import type { MemberDetail, PriorWork } from "@/types/submission";

/** A member's outbound links, rendered only when present. */
function MemberLink({ label, href }: { label: string; href: string }) {
  return (
    <a
      href={href}
      target="_blank"
      rel="noopener noreferrer"
      className="text-xs text-primary hover:underline"
    >
      {label}
    </a>
  );
}

/**
 * One roster member. Everyone on the team appears, including those who wrote nothing --
 * dropping them would understate the team's size, which is a fact a judge may care about.
 */
function TeamMember({ member }: { member: MemberDetail }) {
  const links = [
    member.resume_url ? { label: "Résumé", href: member.resume_url } : null,
    member.github ? { label: "GitHub", href: member.github } : null,
    member.linkedin ? { label: "LinkedIn", href: member.linkedin } : null,
    ...(member.project_links ?? []).map((url, i) => ({ label: `Project ${i + 1}`, href: url })),
  ].filter((link): link is { label: string; href: string } => link !== null);

  return (
    <li className="rounded-md border p-2">
      <div className="flex flex-wrap items-center gap-2">
        <p className="font-medium">
          {member.name ?? <span className="text-muted-foreground">Unnamed member</span>}
        </p>
        {member.is_leader && (
          <Badge variant="secondary" className="text-[10px]">
            Leader
          </Badge>
        )}
      </div>

      {member.about && (
        <p className="mt-1 max-w-prose leading-relaxed text-muted-foreground">{member.about}</p>
      )}

      {links.length > 0 ? (
        <div className="mt-1 flex flex-wrap gap-x-3 gap-y-1">
          {links.map((link) => (
            <MemberLink key={`${link.label}-${link.href}`} {...link} />
          ))}
        </div>
      ) : (
        <p className="mt-1 text-xs text-muted-foreground">
          {member.provided_details ? "No links provided." : "Nothing provided."}
        </p>
      )}
    </li>
  );
}

/**
 * The narrative half of an application, shared by the admin detail page and the judge
 * evaluation page so both see identical substance.
 *
 * `domains`, `prior_work` and each member's `project_links` are rendered with null and []
 * distinguished: null means never answered, [] means explicitly declared none. Undeclared
 * prior work is a penalty offence on the startathon side, so collapsing the two would hide a
 * judgeable fact.
 */
export function ApplicationDetails({
  shortDescription,
  problemEvidence,
  domains,
  priorWork,
  members = [],
}: {
  shortDescription: string;
  problemEvidence: string;
  domains: string[] | null;
  priorWork: PriorWork[] | null;
  members?: MemberDetail[];
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

      <section>
        <p className="mb-1 text-xs font-medium uppercase tracking-wide text-muted-foreground">
          Team {members.length > 0 && `(${members.length})`}
        </p>
        {members.length === 0 ? (
          <p className="text-muted-foreground">No members on record</p>
        ) : (
          <ul className="space-y-2">
            {members.map((member) => (
              <TeamMember key={member.user_id} member={member} />
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
