/** Interest chips on the welcome screen, each mapped to its Apple Podcasts chart genre. */
// Podie is for business and self-improvement listeners who want to keep what they learn,
// so the list sticks to those topics.
export const INTERESTS = [
  { name: "Business", genreId: 1321 },
  { name: "Entrepreneurship", genreId: 1493 },
  { name: "Investing", genreId: 1412 },
  { name: "Marketing", genreId: 1492 },
  { name: "Leadership", genreId: 1491 },
  { name: "Productivity", genreId: 1410 }, // Apple's "Careers" chart
  { name: "Self-improvement", genreId: 1500 },
  { name: "Health", genreId: 1512 },
  { name: "Mental health", genreId: 1517 },
  { name: "Technology", genreId: 1318 },
] as const;

export function genreFor(interest: string): number | null {
  return INTERESTS.find((i) => i.name === interest)?.genreId ?? null;
}
