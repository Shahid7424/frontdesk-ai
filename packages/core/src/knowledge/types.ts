/** One retrieved chunk, as the agent sees it. */
export interface KnowledgeHit {
  id: string;
  /** Document name, e.g. "Rate card.pdf" or a quick answer's title. */
  source: string;
  page: number | null;
  content: string;
}
