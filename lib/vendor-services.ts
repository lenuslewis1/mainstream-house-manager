import { serviceGroups } from "./services";

export const vendorServiceOptions = serviceGroups.flatMap(group =>
  group.items.map(item => `${group.name} / ${item}`),
);

export function parseVendorServices(value: string): string[] {
  const trimmed = value.trim();
  if (!trimmed) return [];
  try {
    const parsed: unknown = JSON.parse(trimmed);
    if (Array.isArray(parsed) && parsed.every(item => typeof item === "string")) {
      return [...new Set(parsed.map(item => item.trim()).filter(Boolean))];
    }
  } catch {
    // Older vendor records stored a single free-text specialty.
  }
  return [trimmed];
}

export function serializeVendorServices(services: string[]): string {
  const selected = [...new Set(services.map(service => service.trim()).filter(Boolean))];
  return selected.length ? JSON.stringify(selected) : "";
}

export function displayVendorServices(value: string): string {
  return parseVendorServices(value).join(", ");
}
