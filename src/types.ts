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
  /** ISO 3166 code or codes of the subtitle desired. */
  language?: string | string[];
  /** The subtitle file's character encoding or encodings.  */
  encoding?: string | string[];
  /** Which subtitle file format(s) you want. */
  format?: string | string[];
  /** Determines if you get hearing impaired subtitles. */
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
  /** Your Wyzie Subs API key (required). Get one at https://sub.wyzie.ru/redeem */
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
  /** The subtitle file's URL. */
  url: string;
  /** The format of the subtitle file. */
  format: string;
  /** The subtitle file's character encoding. (UTF-8, ASCII, ETC) */
  encoding: string;
  /** Boolean indicating if the subtitle's is hearing impaired. */
  isHearingImpaired: boolean;
  /** URL to a PNG of the flag of the subtitle's language. */
  flagUrl: string;
  /** The name/title of the media. */
  media: string;
  /** The display language; Example: English. */
  display: string;
  /** ISO 3166 code; Example: en (2 alphabetic letters). */
  language: string;
  /** The subtitle's source (ex: subdl, subf2m, opensubtitles). */
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
};

/**
 * Response from the /sources endpoint.
 */
export type SourcesResponse = {
  /** List of currently enabled subtitle sources. */
  sources: string[];
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
  /** ISO 3166 code of the subtitle desired. */
  language?: string;
  /** Which subtitle file format you want */
  format?: string;
  /** Determines if you get a hearing impaired subtitles */
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
  /** Your Wyzie Subs API key. Get one at https://sub.wyzie.ru/redeem */
  key?: string;
}

/**
 * Result object from a TMDB search.
 */
export type TmdbSearchResult = {
  id: number;
  media_type: string;
  title?: string;
  name?: string;
  original_title?: string;
  original_name?: string;
  overview?: string;
  release_date?: string;
  first_air_date?: string;
  poster_path?: string | null;
  backdrop_path?: string | null;
  popularity?: number;
  vote_average?: number;
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
