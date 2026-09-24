import { afterEach, describe, expect, it, vi } from "vitest";
import { parseToVTT, searchSubtitles, searchTmdb, getTvDetails, getSeasonDetails, getSources, getSourcesInfo, configure, withDownloadOptions, WyzieError } from "./main";

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
    source: "charlie",
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
      source: ["charlie", "lima"],
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
    expect(requestUrl.searchParams.get("source")).toBe("charlie,lima");
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

const jsonResponse = (status: number, body: unknown) => ({
  ok: status >= 200 && status < 300,
  status,
  text: async () => JSON.stringify(body),
  json: async () => body,
});

describe("searchSubtitles errors", () => {
  it("resolves to an empty array when nothing matches", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(400, { code: 400, message: "No subtitles found", details: "No subtitles found for your desired parameters, sorry :(" }),
    ) as unknown as typeof fetch;
    await expect(searchSubtitles({ tmdb_id: 1, key: "k" })).resolves.toEqual([]);

    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(400, { code: 400, message: "No matching release found" }),
    ) as unknown as typeof fetch;
    await expect(searchSubtitles({ tmdb_id: 1, release: "x", key: "k" })).resolves.toEqual([]);
  });

  it("rejects other 400s with the API's message", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(400, { code: 400, message: "Invalid source", details: "Source must be one or more of: charlie" }),
    ) as unknown as typeof fetch;
    const error = await searchSubtitles({ tmdb_id: 1, source: "zulu", key: "k" }).catch((e) => e);
    expect(error).toBeInstanceOf(WyzieError);
    expect(error.status).toBe(400);
    expect(error.apiMessage).toBe("Invalid source");
    expect(error.message).toContain("Invalid source");
  });

  it("rejects refusals with a WyzieError carrying status and body", async () => {
    const held = { code: 403, message: "Key on hold", details: "Verify your site", reinstate: "https://store.wyzie.io/verify" };
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(403, held)) as unknown as typeof fetch;
    const error = await searchSubtitles({ tmdb_id: 1, key: "k" }).catch((e) => e);
    expect(error).toBeInstanceOf(WyzieError);
    expect(error.name).toBe("WyzieError");
    expect(error.status).toBe(403);
    expect(error.apiMessage).toBe("Key on hold");
    expect(error.details).toBe("Verify your site");
    expect(error.body.reinstate).toBe("https://store.wyzie.io/verify");
    expect(error.message).toBe("Error fetching subtitles: 403 Key on hold (Verify your site)");
  });

  it("reports paused sources (503)", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(503, { code: 503, message: "Source temporarily offline", offline: ["lima"] }),
    ) as unknown as typeof fetch;
    const error = await searchSubtitles({ tmdb_id: 1, source: "lima", key: "k" }).catch((e) => e);
    expect(error.status).toBe(503);
    expect(error.body.offline).toEqual(["lima"]);
  });

  it("copes with a non-JSON error body", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue({
      ok: false,
      status: 502,
      text: async () => "error code: 502",
    }) as unknown as typeof fetch;
    const error = await searchSubtitles({ tmdb_id: 1, key: "k" }).catch((e) => e);
    expect(error).toBeInstanceOf(WyzieError);
    expect(error.status).toBe(502);
    expect(error.body).toBeUndefined();
    expect(error.message).toBe("Error fetching subtitles: 502");
  });

  it("wraps network failures", async () => {
    globalThis.fetch = vi.fn().mockRejectedValue(new TypeError("fetch failed")) as unknown as typeof fetch;
    await expect(searchSubtitles({ tmdb_id: 1, key: "k" })).rejects.toThrow("Error fetching subtitles: TypeError: fetch failed");
  });

  it("passes limit and page through", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, sampleResponse));
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    await searchSubtitles({ tmdb_id: 1, limit: 50, page: 2, key: "k" });
    const requestUrl = new URL(mockFetch.mock.calls[0][0] as string);
    expect(requestUrl.searchParams.get("limit")).toBe("50");
    expect(requestUrl.searchParams.get("page")).toBe("2");
  });
});

describe("parseToVTT edge cases", () => {
  const vttOf = async (content: string) => {
    globalThis.fetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => content }) as unknown as typeof fetch;
    return parseToVTT("https://sub.wyzie.io/c/x/id/1?tok=t");
  };

  it("keeps dialogue that is only a number", async () => {
    const vtt = await vttOf("1\n00:00:01,000 --> 00:00:02,000\n1999\n\n2\n00:00:03,000 --> 00:00:04,000\n42\n");
    expect(vtt).toContain("00:00:01.000 --> 00:00:02.000\n1999");
    expect(vtt).toContain("00:00:03.000 --> 00:00:04.000\n42");
  });

  it("splits cues that are missing blank lines between them", async () => {
    const vtt = await vttOf("1\n00:00:01,000 --> 00:00:02,000\nFirst\n2\n00:00:03,000 --> 00:00:04,000\nSecond\n");
    expect(vtt).toBe("WEBVTT\n\n00:00:01.000 --> 00:00:02.000\nFirst\n\n00:00:03.000 --> 00:00:04.000\nSecond\n\n");
  });

  it("pads single-digit hours, drops SRT position settings, strips a BOM and CRLF", async () => {
    const vtt = await vttOf("﻿1\r\n1:02:03,456 --> 1:02:04,000  X1:100 X2:200 Y1:10 Y2:20\r\n<i>Hi</i>\r\n");
    expect(vtt).toBe("WEBVTT\n\n01:02:03.456 --> 01:02:04.000\n<i>Hi</i>\n\n");
  });

  it("returns WebVTT input as-is", async () => {
    const input = "WEBVTT\n\n00:01.000 --> 00:02.000\nAlready VTT\n";
    await expect(vttOf(input)).resolves.toBe("WEBVTT\n\n00:01.000 --> 00:02.000\nAlready VTT\n\n");
  });

  it("rejects a refused download with the API's reason", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(
      jsonResponse(401, { code: 401, message: "Download link invalid or expired" }),
    ) as unknown as typeof fetch;
    const error = await parseToVTT("https://sub.wyzie.io/c/x/id/1").catch((e) => e);
    expect(error).toBeInstanceOf(WyzieError);
    expect(error.status).toBe(401);
    expect(error.message).toBe("Failed to fetch subtitle content: 401 Download link invalid or expired");
  });
});

describe("sources", () => {
  const sourcesBody = {
    sources: ["charlie", "foxtrot"],
    free: ["charlie"],
    paid: ["foxtrot"],
    tiered: [
      { key: "charlie", name: "charlie", tier: "free", tags: [] },
      { key: "foxtrot", name: "foxtrot", tier: "paid", tags: ["anime"] },
    ],
    allFree: false,
  };

  it("getSources returns the codenames", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, sourcesBody));
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    await expect(getSources()).resolves.toEqual(["charlie", "foxtrot"]);
    expect(mockFetch.mock.calls[0][0]).toBe("https://sub.wyzie.io/sources");
  });

  it("getSourcesInfo returns the full response and scopes to a key", async () => {
    const mockFetch = vi.fn().mockResolvedValue(jsonResponse(200, sourcesBody));
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    await expect(getSourcesInfo()).resolves.toEqual(sourcesBody);
    expect(new URL(mockFetch.mock.calls[0][0] as string).searchParams.has("key")).toBe(false);

    await getSourcesInfo("wyzie-abc");
    expect(new URL(mockFetch.mock.calls[1][0] as string).searchParams.get("key")).toBe("wyzie-abc");

    configure({ key: "wyzie-configured" });
    await getSourcesInfo();
    expect(new URL(mockFetch.mock.calls[2][0] as string).searchParams.get("key")).toBe("wyzie-configured");
    configure({ key: "" });
  });

  it("getSources rejects with a WyzieError on failure", async () => {
    globalThis.fetch = vi.fn().mockResolvedValue(jsonResponse(500, { message: "boom" })) as unknown as typeof fetch;
    await expect(getSources()).rejects.toBeInstanceOf(WyzieError);
  });
});

describe("searchTmdb", () => {
  it("calls the TMDB search API correctly", async () => {
    const mockResponse = [{ id: 123, title: "Test Show", mediaType: "tv" }];
    const mockFetch = vi.fn().mockResolvedValue({
      ok: true,
      json: async () => ({ results: mockResponse }),
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

describe("withDownloadOptions", () => {
  const link = "https://sub.wyzie.io/c/vrf/id/123?format=srt&id=tt0111161&tok=2.abc%2Bdef";

  it("adds the options and keeps the token and other parameters", () => {
    const url = new URL(
      withDownloadOptions(link, { to: "vtt", offset: -1.5, fps: [25, 23.976], plain: true, sdh: true, clean: true, dual: "ja" }),
    );
    expect(Object.fromEntries(url.searchParams)).toEqual({
      format: "srt",
      id: "tt0111161",
      tok: "2.abc+def",
      to: "vtt",
      offset: "-1.5",
      fps: "25:23.976",
      plain: "1",
      sdh: "strip",
      clean: "1",
      dual: "ja",
    });
  });

  it("accepts a search result and leaves unset options out", () => {
    const url = new URL(withDownloadOptions({ url: link }, { to: "srt", offset: 0, plain: false }));
    expect(url.searchParams.get("to")).toBe("srt");
    expect(url.searchParams.has("offset")).toBe(false);
    expect(url.searchParams.has("plain")).toBe(false);
  });
});

describe("parseToVTT server-side conversion", () => {
  it("asks a Wyzie download link for WebVTT", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "WEBVTT\n\n00:01.000 --> 00:02.000\nHi\n" });
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    await parseToVTT("https://sub.wyzie.io/c/x/id/1?tok=t");
    expect(new URL(mockFetch.mock.calls[0][0] as string).searchParams.get("to")).toBe("vtt");
  });

  it("leaves other URLs alone", async () => {
    const mockFetch = vi.fn().mockResolvedValue({ ok: true, status: 200, text: async () => "1\n00:00:01,000 --> 00:00:02,000\nHi\n" });
    globalThis.fetch = mockFetch as unknown as typeof fetch;
    await parseToVTT("https://example.com/file.srt");
    expect(mockFetch.mock.calls[0][0]).toBe("https://example.com/file.srt");
  });
});
