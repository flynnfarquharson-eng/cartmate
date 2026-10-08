/** Interest chips on the welcome screen, each mapped to its Apple Podcasts chart genre. */
export const INTERESTS = [
  { name: "Business", genreId: 1321 },
  { name: "Entrepreneurship", genreId: 1493 },
  { name: "Investing", genreId: 1412 },
  { name: "Marketing", genreId: 1492 },
  { name: "Leadership", genreId: 1491 },
  { name: "Technology", genreId: 1318 },
  { name: "Science", genreId: 1533 },
  { name: "Health", genreId: 1512 },
  { name: "Fitness", genreId: 1514 },
  { name: "Mental health", genreId: 1517 },
  { name: "Self-improvement", genreId: 1500 },
  { name: "Comedy", genreId: 1303 },
  { name: "News & politics", genreId: 1489 },
  { name: "Sport", genreId: 1545 },
  { name: "True crime", genreId: 1488 },
  { name: "History", genreId: 1487 },
  { name: "Society & culture", genreId: 1324 },
  { name: "TV & film", genreId: 1309 },
  { name: "Music", genreId: 1310 },
  { name: "Books & arts", genreId: 1301 },
  { name: "Parenting", genreId: 1305 },
  { name: "Religion", genreId: 1314 },
] as const;

export function genreFor(interest: string): number | null {
  return INTERESTS.find((i) => i.name === interest)?.genreId ?? null;
}
