import sanitizeHtml from "sanitize-html";

const ALLOWED_TAGS = [
  "b",
  "i",
  "em",
  "strong",
  "a",
  "p",
  "br",
  "ul",
  "ol",
  "li",
  "code",
  "pre",
  "blockquote",
  "h1",
  "h2",
  "h3",
  "h4",
  "h5",
  "h6",
];

const ALLOWED_ATTRIBUTES = {
  a: ["href", "target", "rel"],
  "*": [],
};

export function sanitizeText(input: string): string {
  return sanitizeHtml(input, {
    allowedTags: ALLOWED_TAGS,
    allowedAttributes: ALLOWED_ATTRIBUTES,
    allowedSchemes: ["https"],
    allowedSchemesByTag: { a: ["https"] },
    allowedSchemesAppliedToAttributes: ["href"],
    transformTags: {
      a: (tagName, attribs) => ({
        tagName,
        attribs: {
          ...attribs,
          target: "_blank",
          rel: "noopener noreferrer",
        },
      }),
    },
    selfClosing: ["br"],
  });
}

// Decode only the entities that cannot form markup. `<` and `>` must NOT be
// decoded: sanitize-html encodes a literal `<` as `&lt;`, and decoding it back
// turned `&lt;script&gt;alert(1)&lt;/script&gt;` into a live tag in every field
// calling sanitizePlainText (bio, company, location, status, ...). Output never
// contains a raw angle bracket now, and still renders as typed.
const ENTITY_DECODES: Array<[RegExp, string]> = [
  [/&quot;/g, '"'],
  [/&#0?39;/g, "'"],
  [/&amp;/g, "&"],
];

function decodeEntities(value: string): string {
  return ENTITY_DECODES.reduce(
    (out, [pattern, char]) => out.replace(pattern, char),
    value,
  );
}

export function sanitizePlainText(input: string | undefined | null): string {
  if (!input) return "";
  return decodeEntities(
    sanitizeHtml(input, {
      allowedTags: [],
      allowedAttributes: {},
    }),
  ).trim();
}

export function sanitizeUrl(input: string | undefined | null): string {
  if (!input) return "";
  const sanitized = sanitizePlainText(input);
  try {
    const url = new URL(sanitized);
    if (url.protocol !== "https:" && url.protocol !== "http:") {
      return "";
    }
    if (!url.hostname) {
      return "";
    }
    return sanitized;
  } catch {
    return "";
  }
}

export function sanitizeGithubUsername(
  input: string | undefined | null,
): string {
  if (!input) return "";
  const sanitized = sanitizePlainText(input).replace(/^@/, "");
  return sanitized;
}
