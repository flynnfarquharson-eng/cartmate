const AVATAR_COLORS = [
  "#FF6B6B", "#4ECDC4", "#45B7D1", "#96CEB4",
  "#FFEAA7", "#DDA0DD", "#98D8C8", "#F7DC6F",
  "#BB8FCE", "#85C1E9", "#F0B27A", "#82E0AA",
];

export function generateInviteCode(): string {
  const chars = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789";
  let code = "";
  for (let i = 0; i < 6; i++) {
    code += chars.charAt(Math.floor(Math.random() * chars.length));
  }
  return code;
}

export function getRandomAvatarColor(): string {
  return AVATAR_COLORS[Math.floor(Math.random() * AVATAR_COLORS.length)];
}

export function getInitials(name: string): string {
  return name
    .split(" ")
    .map((n) => n[0])
    .join("")
    .toUpperCase()
    .slice(0, 2);
}

export function formatPrice(price: number | null | undefined): string {
  return `$${(price ?? 0).toFixed(2)}`;
}

export function getMemberId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cartmate_member_id");
}

export function getHouseId(): string | null {
  if (typeof window === "undefined") return null;
  return localStorage.getItem("cartmate_house_id");
}

export function setSession(memberId: string, houseId: string): void {
  localStorage.setItem("cartmate_member_id", memberId);
  localStorage.setItem("cartmate_house_id", houseId);
}

export function clearSession(): void {
  localStorage.removeItem("cartmate_member_id");
  localStorage.removeItem("cartmate_house_id");
}
