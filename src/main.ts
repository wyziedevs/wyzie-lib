import { SearchSubtitlesParams, SubtitleData, QueryParams, ConfigurationOptions, TmdbSearchResult, TvDetails, SeasonDetails, SeasonSummary, EpisodeDetails, SourcesResponse, DownloadOptions, SyncParams, SyncResult, StatusReport, SourceStatus, UptimeWindows, DayUptime } from "./types";
import { searchSubtitles, parseToVTT, configure, searchTmdb, getTvDetails, getSeasonDetails, getSources, getSourcesInfo, getStatus, withDownloadOptions, syncSubtitle, WyzieError } from "./funcs";
import { detectSpeech } from "./speech";


export { searchSubtitles, parseToVTT, configure, searchTmdb, getTvDetails, getSeasonDetails, getSources, getSourcesInfo, getStatus, withDownloadOptions, syncSubtitle, detectSpeech, WyzieError };
export type { SubtitleData, SearchSubtitlesParams, QueryParams, ConfigurationOptions, TmdbSearchResult, TvDetails, SeasonDetails, SeasonSummary, EpisodeDetails, SourcesResponse, DownloadOptions, SyncParams, SyncResult, StatusReport, SourceStatus, UptimeWindows, DayUptime };
