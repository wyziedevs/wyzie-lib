/**
 * Parameters for searching subtitles.
 * Either IMDB or TMDB ID is required and if episode is provided, season is also required.
 */
export type SearchSubtitlesParams = (
  /** The TMDB ID of the media you want subtitles for (either TMDB or IMDB ID). */
  | { tmdb_id: number; imdb_id?: never }
  /** The IMDB ID of the media you want subtitles for (either TMDB or IMDB ID). */
  | { imdb_id: string; tmdb_id?: never }
) & {
  /** ISO 639-1 language code or codes of the subtitle desired (e.g. en). */
  language?: string | string[];
  /** The subtitle file's character encoding or encodings.  */
  encoding?: string | string[];
  /** Which subtitle file format(s) you want. */
  format?: string | string[];
  /** When true, only hearing-impaired subtitles are returned. */
  hi?: boolean;
  /** The source where the subtitle will be scraped. Accepts a single value or a list. */
  source?: string | string[];
  /** Filter by specific release group or name (can be a list). */
  release?: string | string[];
  /** Filter by filename (aliases: file, fileName). */
  filename?: string | string[];
  file?: string | string[];
  fileName?: string | string[];
  /** Filter by content origin (e.g., WEB, BluRay). */
  origin?: string | string[];
  /** Bypass cache and fetch fresh results from sources. */
  refresh?: boolean;
  /** Your Wyzie Subs API key (required). Get one at https://store.wyzie.io/redeem */
  key?: string;
  /** Additional parameters that can be used for filtering or other purposes. */
  [key: string]: any;
} & (
  /** The number of the desired season you want subtitles for. */
  | { season: number; episode: number }
  /** The number of the desired episode you want subtitles for. */
  | { season?: never; episode?: never }
);

/**
 * Data structure representing a single subtitle object.
 */
export type SubtitleData = {
  /** Unique identifier (either TMDB or IMDB ID). */
  id: string;
  /** The subtitle file's download URL (https://sub.wyzie.io/c/..., carries an encrypted tok; each download costs 1 request). */
  url: string;
  /** The format of the subtitle file. */
  format: string | null;
  /** The subtitle file's character encoding. (UTF-8, ASCII, ETC) */
  encoding: string | null;
  /** Boolean indicating if the subtitle's is hearing impaired. */
  isHearingImpaired: boolean;
  /** URL to a PNG of the flag of the subtitle's language. */
  flagUrl: string;
  /** The name/title of the media. */
  media: string;
  /** The display language; Example: English. */
  display: string;
  /** ISO 639-1 language code; Example: en (2 alphabetic letters). */
  language: string;
  /** The subtitle's source codename (ex: charlie, lima), or "ai" for AI translations. */
  source?: string | string[];
  /** The release name of the subtitle. */
  release?: string | null;
  /** List of releases compatible with this subtitle. */
  releases?: string[];
  /** The original filename of the subtitle. */
  fileName?: string | null;
  /** Number of downloads on the source platform (if available). */
  downloadCount?: number | null;
  /** The origin of the subtitle (e.g. DVD, WEB, BluRay). */
  origin?: string | null;
  /** Which release value matched the user filter. */
  matchedRelease?: string | null;
  /** Which user-supplied filter matched. */
  matchedFilter?: string | null;
  /** True when the subtitle is an AI translation rather than a scraped file. */
  ai?: boolean;
};

/**
 * Response from the /sources endpoint (GET /sources, optionally with ?key=YOUR_KEY).
 */
export type SourcesResponse = {
  /**
   * Codenames of every live source: enabled and passing its hourly health
   * check. A source that fails two checks in a row is left out of every list
   * in this response until it passes again.
   */
  sources: string[];
  /** Sources any key can query, including free keys. */
  free: string[];
  /** Sources that require a Pro key (empty when allFree is true). */
  paid: string[];
  /** One entry per enabled source. */
  tiered: {
    /** The codename to pass as `source` (e.g. charlie). */
    key: string;
    /** Display name of the source. */
    name: string;
    /** "free" if any key can query it, "paid" if it needs a Pro key. */
    tier: "free" | "paid";
    /** Descriptive tags, e.g. ["anime"]. */
    tags: string[];
    /** Only present when a valid key was passed: whether that key can query this source. */
    available?: boolean;
  }[];
  /** True when every enabled source is available to all keys (paid is then empty). */
  allFree: boolean;
  /**
   * Only present when a key was passed. valid is false for a malformed or unknown key,
   * and null when the key could not be verified right now.
   */
  key?:
    | { valid: true; type: "free" | "paid" }
    | { valid: false; reason: "malformed" | "not_found" }
    | { valid: null; reason: "verification_unavailable" };
  /** Only present for a valid key: sources that key can query. */
  available?: string[];
  /** Only present for a valid key: enabled sources that key cannot query. */
  restricted?: string[];
};

/**
 * Parameters used to construct the URL for subtitle search (requires an ID).
 */
export type QueryParams = {
  /** Unique identifier (either TMDB or IMDB ID). */
  id: string;
  /** Season number if the content is a series. */
  season?: number;
  /** Episode number if the content is a series. */
  episode?: number;
  /** Encoding of the subtitle files. */
  encoding?: string;
  /** ISO 639-1 language code of the subtitle desired. */
  language?: string;
  /** Which subtitle file format you want */
  format?: string;
  /** When true, only hearing-impaired subtitles are returned. */
  hi?: boolean;
  /** The source where the subtitle will be scraped from. */
  source?: string;
  /** Filter by specific release group or name. */
  release?: string;
  /** Filter by filename. */
  filename?: string;
  file?: string;
  fileName?: string;
  /** Filter by content origin (e.g., WEB, BluRay). */
  origin?: string;
  /** Bypass cache and fetch fresh results from sources. */
  refresh?: boolean;
}

/**
 * Type for the configuration options for the library.
 */
export type ConfigurationOptions = {
  /** The API's hostname (default: sub.wyzie.io) */
  baseUrl?: string;
  /** Your Wyzie Subs API key. Get one at https://store.wyzie.io/redeem */
  key?: string;
}

/**
 * Result object from a TMDB search.
 */
export type TmdbSearchResult = {
  id: number;
  /** "movie" or "tv". */
  mediaType: string;
  title: string;
  originalTitle: string | null;
  overview: string;
  /** Four digit year, or null when unknown. */
  releaseYear: string | null;
  /** Full URL to the poster image. */
  poster: string | null;
  /** Full URL to the backdrop image. */
  backdrop: string | null;
  voteAverage: number | null;
  popularity: number | null;
};

/**
 * Summary of a TV season.
 */
export type SeasonSummary = {
  air_date?: string;
  episode_count?: number;
  id: number;
  name: string;
  overview?: string;
  poster_path?: string | null;
  season_number: number;
  vote_average?: number;
};

/**
 * Details of a TV Show.
 */
export type TvDetails = {
  seasons: SeasonSummary[];
  name: string;
  id: number;
};

/**
 * Details of a TV Episode.
 */
export type EpisodeDetails = {
  air_date?: string;
  episode_number: number;
  id: number;
  name: string;
  overview?: string;
  production_code?: string;
  runtime?: number | null;
  season_number: number;
  show_id?: number;
  still_path?: string | null;
  vote_average?: number;
  vote_count?: number;
  [key: string]: any;
};

/**
 * Details of a specific TV Season.
 */
export type SeasonDetails = {
  episodes: EpisodeDetails[];
  season_number: number;
  id: string;
};
