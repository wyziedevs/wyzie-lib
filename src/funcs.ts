import { SearchSubtitlesParams, SubtitleData, QueryParams, ConfigurationOptions, TmdbSearchResult, TvDetails, SeasonDetails } from "./types";


const config: { baseUrl: string; key?: string } = {
  baseUrl: "https://sub.wyzie.io"
};

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
    hi,
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

/**
 * Fetches subtitles from the provided URL.
 *
 * @param {URL} url - The URL to fetch subtitles from.
 * @returns {Promise<SubtitleData[]>} A promise that resolves to an array of subtitle data.
 * @throws {Error} Throws an error if fetching subtitles fails.
 */
async function fetchSubtitles(url: URL): Promise<SubtitleData[]> {
  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`HTTP error! status: ${response.status}`);
  }
  return response.json();
}

/**
 * Searches for subtitles based on the provided parameters.
 *
 * @param {SearchSubtitlesParams} params - The parameters for searching: SearchSubtitlesParams.
 * @returns {Promise<SubtitleData[]>} A promise that resolves to an array of subtitle data.
 * @throws {Error} Throws an error if fetching subtitles fails or something goes wrong.
 */
export async function searchSubtitles(params: SearchSubtitlesParams): Promise<SubtitleData[]> {
  try {
    const url = await constructUrl(params);
    return await fetchSubtitles(url);
  } catch (error) {
    throw new Error(`Error fetching subtitles: ${error}`);
  }
}

/**
 * Parses subtitle content from a URL to VTT format.
 *
 * @param {string} subtitleUrl - The URL of the subtitle to parse.
 * @returns {Promise<string>} A promise that resolves to the subtitle content in VTT format.
 * @throws {Error} Throws an error if fetching or parsing the subtitle content fails.
 */
export async function parseToVTT(subtitleUrl: string): Promise<string> {
  try {
    const response = await fetch(subtitleUrl);
    if (!response.ok) {
      throw new Error(`Failed to fetch subtitle content: ${response.status}`);
    }

    const content = await response.text();
    const normalizedContent = content.replace(/\r\n|\r/g, "\n").trim();
    const blocks = normalizedContent.split(/\n\n+/);
    const timestampRegex = /^\d{1,2}:\d{2}:\d{2}[,.]\d{3}\s*-->\s*\d{1,2}:\d{2}:\d{2}[,.]\d{3}$/;


    const hasValidSRTFormat = blocks.some((block) => {
      const lines = block.split("\n").map((line) => line.trim());
      return lines.some((line) => timestampRegex.test(line));
    });
    if (!hasValidSRTFormat) {
      throw new Error("Invalid subtitle format: not SRT");
    }

    const vttLines: string[] = ["WEBVTT", ""];

    for (const block of blocks) {
      const lines = block
        .split("\n")
        .map((line) => line.trim())
        .filter((line) => line.length > 0);
      if (lines.length < 2) continue;
      const timestampIndex = lines.findIndex((line) => timestampRegex.test(line));
      if (timestampIndex === -1) continue;
      const textLines = lines.slice(timestampIndex + 1).filter((line) => !/^\d+$/.test(line));
      if (textLines.length === 0) continue;
      let timestampLine = lines[timestampIndex];
      timestampLine = timestampLine
        .replace(/[,.](?=\s*-->)/, "")
        .replace(/[,.]$/, "")
        .replace(/,(\d{3})/g, ".$1");
      vttLines.push(`${timestampLine}\n${textLines.join("\n")}\n`);
    }

    return (
      vttLines
        .join("\n")
        .replace(/\n{3,}/g, "\n\n")
        .trim() + "\n\n"
    );
  } catch (error) {
    console.error("Error in parseToVTT:", error);
    throw error;
  }
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

  const response = await fetch(url.toString());
  if (!response.ok) {
    throw new Error(`Failed to search TMDB: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetches details for a TV show from TMDB.
 *
 * @param {number} id - The TMDB ID of the TV show.
 * @returns {Promise<TvDetails>} A promise that resolves to the TV show details.
 */
export async function getTvDetails(id: number): Promise<TvDetails> {
  const url = `${config.baseUrl}/api/tmdb/tv/${id}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch TV details: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetches details for a specific season of a TV show from TMDB.
 *
 * @param {number} id - The TMDB ID of the TV show.
 * @param {number} season - The season number.
 * @returns {Promise<SeasonDetails>} A promise that resolves to the season details.
 */
export async function getSeasonDetails(id: number, season: number): Promise<SeasonDetails> {
  const url = `${config.baseUrl}/api/tmdb/tv/${id}/${season}`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch season details: ${response.status}`);
  }
  return response.json();
}

/**
 * Fetches the list of currently enabled subtitle sources.
 *
 * @returns {Promise<string[]>} A promise that resolves to an array of enabled source names.
 */
export async function getSources(): Promise<string[]> {
  const url = `${config.baseUrl}/sources`;
  const response = await fetch(url);
  if (!response.ok) {
    throw new Error(`Failed to fetch sources: ${response.status}`);
  }
  const data = await response.json();
  return data.sources;
}
