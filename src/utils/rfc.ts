import rfcs from '../data/rfc.json';
import {
  type GroupId,
  type Technology,
  groups,
  layers,
  relations,
  technologies,
  technologyById,
  wgMap,
} from '../data/rfc-taxonomy';

export interface RfcEntry {
  number: number;
  title: string;
  year: number;
  status: string | null;
  stream: string | null;
  wg: string | null;
  technology: string;
  subtopic: string;
  subtopicLabel?: string;
  manual?: boolean;
  note?: string;
}

export const entries = rfcs as RfcEntry[];

const byTechnology = new Map<string, RfcEntry[]>();
for (const entry of entries) {
  const list = byTechnology.get(entry.technology);
  if (list) list.push(entry);
  else byTechnology.set(entry.technology, [entry]);
}

export function rfcsOf(technologyId: string): RfcEntry[] {
  return byTechnology.get(technologyId) ?? [];
}

export function countOf(technologyId: string): number {
  return byTechnology.get(technologyId)?.length ?? 0;
}

export function datatrackerUrl(number: number): string {
  return `https://datatracker.ietf.org/doc/rfc${number}/`;
}

function subtopicHeading(entry: RfcEntry): string {
  if (entry.subtopicLabel) return entry.subtopicLabel;
  const known = wgMap[entry.subtopic];
  if (known) return `${entry.subtopic} — ${known[1]}`;
  if (entry.subtopic === 'none') return 'その他';
  return entry.subtopic;
}

export interface Subtopic {
  key: string;
  heading: string;
  rfcs: RfcEntry[];
}

/** groups a technology's RFCs by subtopic, largest first, "その他" last */
export function subtopicsOf(technologyId: string): Subtopic[] {
  const buckets = new Map<string, Subtopic>();
  for (const entry of rfcsOf(technologyId)) {
    const key = entry.subtopicLabel ?? entry.subtopic;
    const bucket = buckets.get(key);
    if (bucket) bucket.rfcs.push(entry);
    else
      buckets.set(key, { key, heading: subtopicHeading(entry), rfcs: [entry] });
  }
  const list = [...buckets.values()];
  // newest first in the rightmost column
  for (const bucket of list) bucket.rfcs.sort((a, b) => b.number - a.number);
  return list.sort((a, b) => {
    if (a.key === 'none') return 1;
    if (b.key === 'none') return -1;
    return b.rfcs.length - a.rfcs.length;
  });
}

export function technologiesOf(groupId: GroupId): Technology[] {
  return technologies.filter((t) => t.group === groupId);
}

/* ---------- data for the column tree ---------- */

/** the first column: network layers first, then the other groups */
export interface Band {
  id: string;
  label: string;
  members: Technology[];
}

export function bands(): Band[] {
  const out: Band[] = layers.map((layer) => ({
    id: `band-${layer.id}`,
    label: layer.name,
    members: technologies.filter(
      (t) => t.group === 'network' && t.layer === layer.id,
    ),
  }));
  for (const group of groups) {
    if (group.layered) continue;
    out.push({
      id: `band-${group.id}`,
      label: group.name,
      members: technologiesOf(group.id),
    });
  }
  return out.filter((band) => band.members.length > 0);
}

/** technology id -> band id, so a related link can open the right branch */
export function bandOfTechnology(): Record<string, string> {
  const out: Record<string, string> = {};
  for (const band of bands()) {
    for (const tech of band.members) out[tech.id] = band.id;
  }
  return out;
}

export function relatedTechnologies(technologyId: string): Technology[] {
  const ids = new Set<string>();
  for (const [a, b] of relations) {
    if (a === technologyId) ids.add(b);
    if (b === technologyId) ids.add(a);
  }
  return [...ids]
    .map((id) => technologyById.get(id))
    .filter((t): t is Technology => t !== undefined)
    .sort((a, b) => countOf(b.id) - countOf(a.id));
}

/** the two upper columns, small enough to ship with the page */
export function treeData() {
  return {
    bands: bands().map((band) => ({
      id: band.id,
      label: band.label,
      count: band.members.reduce((sum, tech) => sum + countOf(tech.id), 0),
      children: band.members.map((tech) => ({
        id: tech.id,
        label: tech.name,
        count: countOf(tech.id),
      })),
    })),
    bandOf: bandOfTechnology(),
  };
}

export { groups, layers, technologies, technologyById };
