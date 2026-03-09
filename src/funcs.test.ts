import { afterEach, describe, expect, it, vi } from "vitest";
import { parseToVTT, searchSubtitles, searchTmdb, getTvDetails, getSeasonDetails } from "./main";

const originalFetch = globalThis.fetch;

const sampleResponse = [
  {
    id: "12345",
    url: "https://sub.wyzie.io/c/vrf-abc/id/54321",
    format: "srt",
    encoding: "utf-8",
    isHearingImpaired: false,
    flagUrl: "https://flags.example/en.png",
    media: "Sample Media",
    display: "English",
    language: "en",
    source: "opensubtitles",
    release: "Sample Release",
    releases: ["Sample Release"],
    fileName: "sample.srt",
    origin: "WEB-DL",
  },
];

afterEach(() => {
  vi.restoreAllMocks();
  if (originalFetch) {
    globalThis.fetch = originalFetch;
  } else {

    delete globalThis.fetch;
  }
});

describe("searchSubtitles", () => {
  it("calls the Wyzie API with the expected query parameters", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleResponse,
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await searchSubtitles({
      tmdb_id: 2190,
      season: 1,
      episode: 1,
      language: ["en", "es"],
      format: ["srt", "ass"],
      encoding: "utf-8",
      source: ["subdl", "subf2m"],
      hi: true,
    });

    expect(mockFetch).toHaveBeenCalledTimes(1);

    const requestUrl = new URL(mockFetch.mock.calls[0][0] as string);
    expect(requestUrl.pathname).toBe("/search");
    expect(requestUrl.searchParams.get("id")).toBe("2190");
    expect(requestUrl.searchParams.get("season")).toBe("1");
    expect(requestUrl.searchParams.get("episode")).toBe("1");
    expect(requestUrl.searchParams.get("language")).toBe("en,es");
    expect(requestUrl.searchParams.get("format")).toBe("srt,ass");
    expect(requestUrl.searchParams.get("encoding")).toBe("utf-8");
    expect(requestUrl.searchParams.get("source")).toBe("subdl,subf2m");
    expect(requestUrl.searchParams.get("hi")).toBe("true");

    expect(result).toEqual(sampleResponse);
  });

  it("supports searching by IMDB id without season information", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleResponse,
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await searchSubtitles({ imdb_id: "tt0111161", language: "en" });

    const requestUrl = new URL(mockFetch.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get("id")).toBe("tt0111161");
    expect(requestUrl.searchParams.get("season")).toBeNull();
    expect(requestUrl.searchParams.get("episode")).toBeNull();
  });

  it("includes release, file, and origin filters in the query", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => sampleResponse,
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await searchSubtitles({
      tmdb_id: 12345,
      release: "test-release",
      filename: "test-file.mkv",
      file: ["alt-name.srt"],
      origin: ["web", "bluray"],
    });

    const requestUrl = new URL(mockFetch.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get("release")).toBe("test-release");
    expect(requestUrl.searchParams.get("filename")).toBe("test-file.mkv");
    expect(requestUrl.searchParams.get("file")).toBe("alt-name.srt");
    expect(requestUrl.searchParams.get("origin")).toBe("web,bluray");
  });

  it("throws when neither tmdb_id nor imdb_id is provided", async () => {
    await expect(searchSubtitles({ language: "en" } as any)).rejects.toThrow(
      "Either tmdb_id or imdb_id must be provided.",
    );
  });

  it("throws when only season or episode is provided", async () => {
    await expect(
      searchSubtitles({ tmdb_id: 2190, season: 1, language: "en" } as any),
    ).rejects.toThrow("Season and episode must be provided together or omitted together.");
    await expect(
      searchSubtitles({ tmdb_id: 2190, episode: 1, language: "en" } as any),
    ).rejects.toThrow("Season and episode must be provided together or omitted together.");
  });
});

describe("parseToVTT", () => {
  it("converts SRT content to VTT", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () =>
        "1\n00:00:01,000 --> 00:00:03,000\nHello there!\n\n2\n00:00:04,000 --> 00:00:05,500\nGeneral Kenobi!\n",
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const vtt = await parseToVTT("https://sub.wyzie.io/c/vrf/id/file");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    expect(vtt.startsWith("WEBVTT")).toBe(true);
    expect(vtt).toContain("00:00:01.000 --> 00:00:03.000");
    expect(vtt).toContain("Hello there!");
    expect(vtt).toContain("General Kenobi!");
  });

  it("throws when the subtitle content is not valid SRT", async () => {
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      text: async () => "This is not a valid subtitle file",
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    await expect(parseToVTT("https://example.com/bad-subtitle")).rejects.toThrow(
      "Invalid subtitle format: not SRT",
    );
  });
});

describe("searchTmdb", () => {
  it("calls the TMDB search API correctly", async () => {
    const mockResponse = [{ id: 123, name: "Test Show", media_type: "tv" }];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await searchTmdb("Test Show");

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestUrl = new URL(mockFetch.mock.calls[0][0]);
    expect(requestUrl.pathname).toBe("/api/tmdb/search");
    expect(requestUrl.searchParams.get("q")).toBe("Test Show");
    expect(requestUrl.searchParams.get("language")).toBe("en-US");
    expect(result).toEqual(mockResponse);
  });
});

describe("getTvDetails", () => {
  it("calls the TV details API correctly", async () => {
    const mockResponse = { id: 123, name: "Test Show", seasons: [] };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await getTvDetails(123);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestUrl = mockFetch.mock.calls[0][0];
    expect(requestUrl).toContain("/api/tmdb/tv/123");
    expect(result).toEqual(mockResponse);
  });
});

describe("getSeasonDetails", () => {
  it("calls the Season details API correctly", async () => {
    const mockResponse = { id: "abc", season_number: 1, episodes: [] };
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => mockResponse,
    });
    globalThis.fetch = mockFetch as unknown as typeof fetch;

    const result = await getSeasonDetails(123, 1);

    expect(mockFetch).toHaveBeenCalledTimes(1);
    const requestUrl = mockFetch.mock.calls[0][0];
    expect(requestUrl).toContain("/api/tmdb/tv/123/1");
    expect(result).toEqual(mockResponse);
  });
});
