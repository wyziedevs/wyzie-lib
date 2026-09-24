import { SearchSubtitlesParams, SubtitleData, QueryParams, ConfigurationOptions, TmdbSearchResult, TvDetails, SeasonDetails, SourcesResponse, DownloadOptions } from "./types";


const config: { baseUrl: string; key?: string } = {
  baseUrl: "https://sub.wyzie.io"
};

/**
 * Error thrown when the API answers with a non-2xx status.
 *
 * `status` is the HTTP status. `body` is the API's JSON error when it sent one:
 * `message` and `details`, plus extra fields for some errors (`topup` on 402,
 * `reset_at` on 429, `reinstate` for a key on hold, `offline` when every
 * requested source is paused by its health checks).
 */
export class WyzieError extends Error {
  /** HTTP status of the failed response. */
  readonly status: number;
  /** The API's short error message, e.g. "Invalid API key". */
  readonly apiMessage?: string;
  /** The API's longer explanation, when it sent one. */
  readonly details?: string;
  /** The full JSON error body, when the response had one. */
  readonly body?: Record<string, unknown>;

  constructor(prefix: string, status: number, body?: Record<string, unknown>) {
    const apiMessage = typeof body?.message === "string" ? body.message : undefined;
    const details = typeof body?.details === "string" ? body.details : undefined;
    super(`${prefix}: ${status}${apiMessage ? ` ${apiMessage}` : ""}${details ? ` (${details})` : ""}`);
    this.name = "WyzieError";
    this.status = status;
    this.apiMessage = apiMessage;
    this.details = details;
    this.body = body;
  }
}

/** The JSON error body of a failed response, if it has one. */
async function readErrorBody(response: Response): Promise<Record<string, unknown> | undefined> {
  try {
    const parsed = JSON.parse(await response.text());
    return parsed && typeof parsed === "object" ? parsed : undefined;
  } catch {
    return undefined;
  }
}

/** Fetch a URL and return its JSON, throwing a WyzieError on a non-2xx status. */
async function getJson<T>(url: string, errorPrefix: string): Promise<T> {
  const response = await fetch(url);
  if (!response.ok) {
    throw new WyzieError(errorPrefix, response.status, await readErrorBody(response));
  }
  return response.json();
}

/**
 * Configure the library settings.
 *
 * @param {ConfigurationOptions} options - Config options for the library.
 */
export function configure(options: ConfigurationOptions) {
  if (options.baseUrl) {
    config.baseUrl = options.baseUrl.replace(/\/$/, '');
  }
  if (options.key !== undefined) {
    config.key = options.key;
  }
}

/**
 * Constructs a URL for searching subtitles based on the provided parameters.
 *
 * @param {SearchSubtitlesParams} params - The parameters for constructing the URL.
 * @returns {Promise<URL>} A promise that resolves to the constructed URL.
 */
async function constructUrl({
  tmdb_id,
  imdb_id,
  season,
  episode,
  encoding,
  language,
  format,
  source,
  release,
  filename,
  file,
  fileName,
  origin,
  hi,
  refresh,
  ...extraParams
}: SearchSubtitlesParams): Promise<URL> {
  if (!tmdb_id && !imdb_id) {
    throw new Error("Either tmdb_id or imdb_id must be provided.");
  }

  const hasSeason = season !== undefined;
  const hasEpisode = episode !== undefined;
  if ((hasSeason && !hasEpisode) || (!hasSeason && hasEpisode)) {
    throw new Error("Season and episode must be provided together or omitted together.");
  }

  const url = new URL(`${config.baseUrl}/search`);

  const queryParams: QueryParams = {
    id: String(tmdb_id || imdb_id),
    season,
    episode,
    encoding: Array.isArray(encoding) ? encoding.join(",") : encoding,
    language: Array.isArray(language) ? language.join(",") : language,
    format: Array.isArray(format) ? format.join(",") : format,
    source: Array.isArray(source) ? source.join(",") : source,
    release: Array.isArray(release) ? release.join(",") : release,
    filename: Array.isArray(filename) ? filename.join(",") : filename,
    file: Array.isArray(file) ? file.join(",") : file,
    fileName: Array.isArray(fileName) ? fileName.join(",") : fileName,
    origin: Array.isArray(origin) ? origin.join(",") : origin,
    // Only send when true: the API treats any non-empty value as enabled.
    hi: hi ? true : undefined,
    refresh,
  };

  Object.entries(queryParams).forEach(([key, value]) => {
    if (value !== undefined) {
      url.searchParams.append(key, String(value));
    }
  });


  Object.entries(extraParams).forEach(([key, value]) => {
    if (value !== undefined) {
      if (Array.isArray(value)) {
        url.searchParams.append(key, value.join(","));
      } else {
        url.searchParams.append(key, String(value));
      }
    }
  });

  // Apply global key from configure() if not already set per-request
  if (!url.searchParams.has("key") && config.key) {
    url.searchParams.append("key", config.key);
  }

  return url;
}

// The API answers "nothing matched" with a 400; for a search that is an empty
// result, not a failure.
const NO_RESULTS_MESSAGES = new Set(["No subtitles found", "No matching release found"]);

/**
 * Searches for subtitles based on the provided parameters.
 *
 * Resolves to an empty array when nothing matches. Any other API refusal
 * (missing or invalid key, key on hold, balance or daily limit used up, every
 * requested source paused) rejects with a {@link WyzieError} carrying the
 * HTTP status and the API's message.
 *
 * @param {SearchSubtitlesParams} params - The parameters for searching: SearchSubtitlesParams.
 * @returns {Promise<SubtitleData[]>} A promise that resolves to an array of subtitle data.
 * @throws {WyzieError} When the API refuses the search.
 * @throws {Error} When the parameters are invalid or the request can't be sent.
 */
export async function searchSubtitles(params: SearchSubtitlesParams): Promise<SubtitleData[]> {
  let response: Response;
  try {
    const url = await constructUrl(params);
    response = await fetch(url.toString());
  } catch (error) {
    throw new Error(`Error fetching subtitles: ${error}`);
  }
  if (!response.ok) {
    const body = await readErrorBody(response);
    if (response.status === 400 && NO_RESULTS_MESSAGES.has(String(body?.message))) return [];
    throw new WyzieError("Error fetching subtitles", response.status, body);
  }
  return response.json();
}

const SRT_TIMESTAMP = /^(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})\s*-->\s*(\d{1,2}):(\d{2}):(\d{2})[,.](\d{3})/;

/** "1:02:03,456" parts → "01:02:03.456" (VTT needs two-digit hours). */
function vttTime(h: string, m: string, s: string, ms: string): string {
  return `${h.padStart(2, "0")}:${m}:${s}.${ms}`;
}

/**
 * Converts SRT text to WebVTT. Cues are read by their timestamp lines, so
 * files with missing blank lines between cues still convert, and dialogue
 * that is only a number (e.g. "1999") is kept. SRT position settings after
 * the timestamp are dropped (they have no VTT equivalent).
 */
function srtToVtt(content: string): string {
  const lines = content.replace(/^﻿/, "").replace(/\r\n|\r/g, "\n").split("\n");
  const cues: string[] = [];
  for (let i = 0; i < lines.length; i++) {
    const match = SRT_TIMESTAMP.exec(lines[i].trim());
    if (!match) continue;
    const text: string[] = [];
    let j = i + 1;
    while (j < lines.length && lines[j].trim() !== "" && !SRT_TIMESTAMP.test(lines[j].trim())) {
      text.push(lines[j].trim());
      j++;
    }
    // Ran into the next cue without a blank line: its index number was read as text.
    if (j < lines.length && SRT_TIMESTAMP.test(lines[j].trim()) && /^\d+$/.test(text[text.length - 1] ?? "")) {
      text.pop();
    }
    if (text.length > 0) {
      const [, h1, m1, s1, ms1, h2, m2, s2, ms2] = match;
      cues.push(`${vttTime(h1, m1, s1, ms1)} --> ${vttTime(h2, m2, s2, ms2)}\n${text.join("\n")}`);
    }
    i = j - 1;
  }
  if (cues.length === 0) {
    throw new Error("Invalid subtitle format: not SRT");
  }
  return `WEBVTT\n\n${cues.join("\n\n")}\n\n`;
}

/**
 * Adds download options to a subtitle's download link (the `url` of a
 * {@link searchSubtitles} result), e.g. to get WebVTT, fix timing or add a
 * second language. The link's token and other parameters are kept.
 *
 * @example
 * const url = withDownloadOptions(subtitles[0], { to: "vtt", offset: -1.5 });
 * video.querySelector("track").src = url;
 *
 * @param {string | { url: string }} subtitle - A download URL, or a subtitle result.
 * @param {DownloadOptions} options - The options to apply.
 * @returns {string} The download URL with the options added.
 */
export function withDownloadOptions(subtitle: string | Pick<SubtitleData, "url">, options: DownloadOptions): string {
  const url = new URL(typeof subtitle === "string" ? subtitle : subtitle.url);
  const set = (name: string, value: string) => url.searchParams.set(name, value);
  if (options.to) set("to", options.to);
  if (options.offset) set("offset", String(options.offset));
  if (options.fps) set("fps", `${options.fps[0]}:${options.fps[1]}`);
  if (options.plain) set("plain", "1");
  if (options.sdh) set("sdh", "strip");
  if (options.clean) set("clean", "1");
  if (options.dual) set("dual", options.dual);
  return url.toString();
}

/**
 * Fetches a subtitle (usually a `url` from {@link searchSubtitles}) and returns
 * it as WebVTT. Wyzie download links are converted by the server (any format);
 * other SRT is converted here, and a file that is already WebVTT is returned
 * as-is.
 *
 * @param {string} subtitleUrl - The URL of the subtitle to parse.
 * @returns {Promise<string>} A promise that resolves to the subtitle content in VTT format.
 * @throws {WyzieError} When the download is refused (e.g. expired link, balance used up).
 * @throws {Error} When the content is neither SRT nor WebVTT.
 */
export async function parseToVTT(subtitleUrl: string): Promise<string> {
  let url = subtitleUrl;
  try {
    if (new URL(subtitleUrl).pathname.startsWith("/c/")) url = withDownloadOptions(subtitleUrl, { to: "vtt" });
  } catch {
    // not an absolute URL: fetch it as given
  }
  const response = await fetch(url);
  if (!response.ok) {
    throw new WyzieError("Failed to fetch subtitle content", response.status, await readErrorBody(response));
  }
  const content = (await response.text()).replace(/^﻿/, "");
  if (/^WEBVTT/.test(content.trimStart())) {
    return content.replace(/\r\n|\r/g, "\n").trim() + "\n\n";
  }
  return srtToVtt(content);
}

/**
 * Searches TMDB for movies or TV shows.
 *
 * @param {string} query - The search query.
 * @param {string} [language] - Optional language code (default: en-US).
 * @returns {Promise<TmdbSearchResult[]>} A promise that resolves to an array of TMDB search results.
 */
export async function searchTmdb(query: string, language: string = "en-US"): Promise<TmdbSearchResult[]> {
  const url = new URL(`${config.baseUrl}/api/tmdb/search`);
  url.searchParams.append("q", query);
  url.searchParams.append("language", language);

  // The API wraps results as { results: [...] }
  const data = await getJson<any>(url.toString(), "Failed to search TMDB");
  return Array.isArray(data) ? data : (data?.results ?? []);
}

/**
 * Fetches details for a TV show from TMDB.
 *
 * @param {number} id - The TMDB ID of the TV show.
 * @returns {Promise<TvDetails>} A promise that resolves to the TV show details.
 */
export async function getTvDetails(id: number): Promise<TvDetails> {
  return getJson<TvDetails>(`${config.baseUrl}/api/tmdb/tv/${id}`, "Failed to fetch TV details");
}

/**
 * Fetches details for a specific season of a TV show from TMDB.
 *
 * @param {number} id - The TMDB ID of the TV show.
 * @param {number} season - The season number.
 * @returns {Promise<SeasonDetails>} A promise that resolves to the season details.
 */
export async function getSeasonDetails(id: number, season: number): Promise<SeasonDetails> {
  return getJson<SeasonDetails>(`${config.baseUrl}/api/tmdb/tv/${id}/${season}`, "Failed to fetch season details");
}

/**
 * Fetches the codenames of the live subtitle sources: enabled and passing
 * their hourly health checks. A source failing its checks is left out until
 * it recovers, so fetch this rather than hard-coding the list.
 *
 * @returns {Promise<string[]>} A promise that resolves to an array of source codenames.
 */
export async function getSources(): Promise<string[]> {
  const data = await getJson<SourcesResponse>(`${config.baseUrl}/sources`, "Failed to fetch sources");
  return data.sources;
}

/**
 * Fetches the full /sources response: every live source with its tier
 * (free or paid) and tags. With a key (the one passed here, or else the one
 * from {@link configure}) it also says which sources that key can use
 * (`available` / `restricted`). Checking a key this way costs no requests.
 *
 * @param {string} [key] - API key to check; defaults to the configured key.
 * @returns {Promise<SourcesResponse>} A promise that resolves to the /sources response.
 */
export async function getSourcesInfo(key: string | undefined = config.key): Promise<SourcesResponse> {
  const url = new URL(`${config.baseUrl}/sources`);
  if (key) url.searchParams.append("key", key);
  return getJson<SourcesResponse>(url.toString(), "Failed to fetch sources");
}
