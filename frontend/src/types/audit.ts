export interface AuditLogOut {
  id: number;
  user_id: number | null;
  username: string | null;
  action: string;
  entity_type: string;
  entity_id: number | null;
  details: Record<string, unknown>;
  created_at: string;
}
