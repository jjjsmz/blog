import type { APIRoute, GetStaticPaths } from 'astro';
import {
  relatedTechnologies,
  subtopicsOf,
  technologies,
} from '../../../../utils/rfc';

// One payload per technology, fetched by the map when a node is opened.
export const getStaticPaths: GetStaticPaths = () =>
  technologies.map((technology) => ({
    params: { tech: technology.id },
    props: { technology },
  }));

export const GET: APIRoute = ({ props }) => {
  const { technology } = props as { technology: (typeof technologies)[number] };
  const subtopics = subtopicsOf(technology.id).map((subtopic) => ({
    key: subtopic.key,
    heading: subtopic.heading,
    count: subtopic.rfcs.length,
    // [number, title, 1 when it is an Internet Standard]
    rfcs: subtopic.rfcs.map((rfc) =>
      rfc.status === 'INTERNET STANDARD'
        ? [rfc.number, rfc.title, 1]
        : [rfc.number, rfc.title],
    ),
  }));

  return new Response(
    JSON.stringify({
      id: technology.id,
      name: technology.name,
      total: subtopics.reduce((sum, s) => sum + s.count, 0),
      subtopics,
      related: relatedTechnologies(technology.id).map((t) => ({
        id: t.id,
        name: t.name,
      })),
    }),
    { headers: { 'Content-Type': 'application/json' } },
  );
};
