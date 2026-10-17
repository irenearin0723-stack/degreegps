import 'server-only';
export interface RetrievedSource {
  content: string; document_title: string; source_url: string;
  section: string | null; verified_at: string | null; effective_date: string | null;
}
export interface RetrievalFilters { official_only?: boolean; major?: string; effective_after?: string }
/** No external retrieval configured. Results must never override validated prerequisite rules. */
export async function retrieveSources(_query: string, _filters?: RetrievalFilters): Promise<RetrievedSource[]> {
  return [];
}
