# Graph Report - Tunebad  (2026-07-12)

## Corpus Check
- 209 files · ~218,701 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1279 nodes · 2932 edges · 72 communities (63 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `579a08cb`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- analysis.ts
- RemixStudio.tsx
- ytdlp.ts
- ffmpeg-core.js
- server.js
- TunebadApp
- en.ts
- TunebadApp.tsx
- dependencies
- useI18n
- VideoTool.tsx
- link-analysis.ts
- AnalyzerPanel.tsx
- ToolFaq.tsx
- page.tsx
- ToolPageShell.tsx
- backends.ts
- media-url.ts
- compilerOptions
- seed-songs.mjs
- VideoTool.tsx
- fs
- LoudnessPanel.tsx
- VideoTool.tsx
- page.tsx
- icons.tsx
- getWasmTableEntry
- getSocketFromFD
- CutterPanel.tsx
- ExceptionInfo
- intArrayFromString
- ReverbEq.tsx
- AnalysisResult
- _strftime
- page.tsx
- asyncLoad
- abort
- page.tsx
- manifest.json
- page.tsx
- setup-ytdlp.mjs
- layout.tsx
- callRuntimeCallbacks
- tunebad-bridge.sh
- TuneBad — Security Review
- TuneBad
- page.tsx
- getEnvStrings
- next.config.mjs
- gen-og-files.mjs
- TuneBad remote downloader
- essentia.d.ts
- next-env.d.ts
- link-analysis.ts
- tunebad-local.sh
- LandingSeo.tsx
- useHistory.ts
- page.tsx
- route.ts
- delay.ts
- LandingSeo.tsx
- page.tsx
- audio-joiner.ts
- lufs.ts
- page.tsx
- spotify-playlist.ts
- BassBoosterTool.tsx
- page.tsx
- youtube-playlist.ts
- NightcoreTool.tsx
- page.tsx

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 113 edges
2. `downloadBlob()` - 27 edges
3. `RelatedTools()` - 26 edges
4. `ToolPageShell()` - 25 edges
5. `formatBytes()` - 20 edges
6. `RemixStudio()` - 19 edges
7. `readAllSongs()` - 19 edges
8. `fs` - 19 edges
9. `ImageTool()` - 17 edges
10. `DictKey` - 17 edges

## Surprising Connections (you probably didn't know these)
- `PlaylistLookupTrack` --references--> `CachedAnalysis`  [EXTRACTED]
  app/api/playlist-lookup/route.ts → lib/server/link-analysis.ts
- `generateStaticParams()` --calls--> `readAllSongs()`  [EXTRACTED]
  app/songs/bpm/[bpm]/page.tsx → lib/server/link-analysis.ts
- `AnalyzerState` --references--> `AnalysisResult`  [EXTRACTED]
  hooks/useAnalyzer.ts → types/analysis.ts
- `GET()` --calls--> `resolveTitle()`  [EXTRACTED]
  app/api/lookup/route.ts → lib/server/link-analysis.ts
- `GET()` --calls--> `sourceIdForUrl()`  [EXTRACTED]
  app/api/lookup/route.ts → lib/server/link-analysis.ts

## Import Cycles
- 3-file cycle: `components/TunebadApp.tsx -> components/layout/TopBar.tsx -> components/layout/NavTabs.tsx -> components/TunebadApp.tsx`
- 3-file cycle: `components/TunebadApp.tsx -> components/converter/ConverterView.tsx -> components/converter/YouTubeDownloader.tsx -> components/TunebadApp.tsx`
- 3-file cycle: `components/TunebadApp.tsx -> components/bpm/BpmToolsView.tsx -> components/bpm/MetronomeCard.tsx -> components/TunebadApp.tsx`
- 3-file cycle: `components/TunebadApp.tsx -> components/bpm/BpmToolsView.tsx -> components/bpm/TapTempoCard.tsx -> components/TunebadApp.tsx`

## Communities (72 total, 9 thin omitted)

### Community 0 - "analysis.ts"
Cohesion: 0.05
Nodes (59): metadata, applyFades(), CutterPanel(), Status, clamp(), TrimWaveform(), EXPORT_TARGETS, formatDb() (+51 more)

### Community 1 - "RemixStudio.tsx"
Cohesion: 0.06
Nodes (53): EightDTool(), formatSemitones(), matchesPreset(), Preset, PRESETS, RemixStudio(), REVERB_TYPE_OPTIONS, Status (+45 more)

### Community 2 - "ytdlp.ts"
Cohesion: 0.23
Nodes (12): DropZone(), RecentRow, RecentStrip(), ResultsTable(), SimilarSong, SimilarSongs(), WaveformPreview(), clamp() (+4 more)

### Community 3 - "ffmpeg-core.js"
Cohesion: 0.05
Nodes (20): alignMemory(), doCallback(), done(), _emscripten_asm_const_int(), _emscripten_get_heap_max(), emscripten_realloc_buffer(), _emscripten_resize_heap(), exec() (+12 more)

### Community 4 - "server.js"
Cohesion: 0.07
Nodes (43): AUDIOMACK_HOSTS, canonicalYouTubeUrl(), INSTAGRAM_HOSTS, MIXCLOUD_HOSTS, SOUNDCLOUD_HOSTS, TIKTOK_HOSTS, TWITTER_HOSTS, validateMediaUrl() (+35 more)

### Community 5 - "TunebadApp"
Cohesion: 0.06
Nodes (21): metadata, metadata, metadata, metadata, metadata, metadata, metadata, metadata (+13 more)

### Community 6 - "en.ts"
Cohesion: 0.08
Nodes (40): CONTENT_TYPE_BY_FORMAT, contentDisposition(), GET(), GET(), POST(), YouTubeJobState, IMPORTANT: this module reads server-only secrets and must never be, Backend (+32 more)

### Community 7 - "TunebadApp.tsx"
Cohesion: 0.27
Nodes (9): DelayDivision, delayDivisions(), DelayResult, DelayValue, DIVISION_DEFS, REVERB_PRESET_DEFS, ReverbPreset, round2() (+1 more)

### Community 8 - "dependencies"
Cohesion: 0.05
Nodes (36): dependencies, essentia.js, fflate, @ffmpeg/core, @ffmpeg/ffmpeg, ffmpeg-static, heic-to, next (+28 more)

### Community 9 - "useI18n"
Cohesion: 0.21
Nodes (14): GET(), idSchema, querySchema, searchSchema, PlaylistLookupTrack, querySchema, resolveTrack(), runPool() (+6 more)

### Community 10 - "VideoTool.tsx"
Cohesion: 0.12
Nodes (17): metadata, metadata, FILE_TOOLS, ToolsHub(), CopyrightBody(), SECTIONS, LanguageMenu(), detectLocale() (+9 more)

### Community 11 - "link-analysis.ts"
Cohesion: 0.11
Nodes (15): Home(), FAQ_JSON_LD, FAQ_KEYS, LandingSeo(), TOUR_KEYS, VALUE_KEYS, de, en (+7 more)

### Community 12 - "AnalyzerPanel.tsx"
Cohesion: 0.16
Nodes (23): AudioEffectResult, AudioEffectTool(), Status, AudioFormatPicker(), AudioOutputFormat, MP3_BITRATES, AudioJoinerTool(), nextId() (+15 more)

### Community 13 - "ToolFaq.tsx"
Cohesion: 0.18
Nodes (21): ImageDimensionError, ImageTool(), ImageToolMode, ResultRow, SizePreset, Status, convertHeic(), canEncodeWebp() (+13 more)

### Community 14 - "page.tsx"
Cohesion: 0.19
Nodes (17): FileDrop(), PdfSplitTool(), Status, PdfTool(), PdfToolMode, Status, formatBytes(), extractPages() (+9 more)

### Community 15 - "ToolPageShell.tsx"
Cohesion: 0.09
Nodes (15): metadata, metadata, metadata, metadata, metadata, metadata, metadata, metadata (+7 more)

### Community 16 - "backends.ts"
Cohesion: 0.15
Nodes (28): ArchiveFormat, entryFileName(), Status, Tab, ZipTool(), buildHeader(), computeChecksum(), createTarGz() (+20 more)

### Community 17 - "media-url.ts"
Cohesion: 0.12
Nodes (8): metadata, metadata, metadata, metadata, metadata, metadata, FaqEntry, ToolFaq()

### Community 18 - "compilerOptions"
Cohesion: 0.10
Nodes (20): send_progress(), compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 19 - "seed-songs.mjs"
Cohesion: 0.13
Nodes (15): addTracks(), analyze(), CAMELOT, collectTracks(), COUNTRY_PLAYLISTS, __dirname, env, existing (+7 more)

### Community 20 - "VideoTool.tsx"
Cohesion: 0.13
Nodes (17): metadata, metadata, AUDIO_FORMATS, MediaConvertTool(), MP3_BITRATES, Status, VIDEO_FORMATS, AUDIO_MIME (+9 more)

### Community 21 - "fs"
Cohesion: 0.11
Nodes (18): bigintToI53Checked(), doReadv(), doWritev(), _fd_close(), _fd_fdstat_get(), _fd_read(), _fd_seek(), _fd_write() (+10 more)

### Community 22 - "LoudnessPanel.tsx"
Cohesion: 0.19
Nodes (13): POST(), resultSchema, GET(), GET(), querySchema, isAllowedPreviewUrl(), writeCachedAnalysis(), allow() (+5 more)

### Community 23 - "VideoTool.tsx"
Cohesion: 0.17
Nodes (25): CamelotWheel(), CODE_TO_KEY, point(), segmentPath(), SEGMENTS, shortKey(), ALL_CODES, CamelotWheelPage() (+17 more)

### Community 24 - "page.tsx"
Cohesion: 0.13
Nodes (9): CamelotWheelSvg(), metadata, polar(), WHEEL, metadata, metadata, metadata, metadata (+1 more)

### Community 25 - "icons.tsx"
Cohesion: 0.13
Nodes (14): ConverterView(), PitchConverter(), REFERENCES, BASE_SVG_PROPS, DownloadIcon(), EchoIcon(), GaugeIcon(), HistoryIcon() (+6 more)

### Community 26 - "getWasmTableEntry"
Cohesion: 0.12
Nodes (16): getWasmTableEntry(), invoke_i(), invoke_ii(), invoke_iii(), invoke_iiii(), invoke_iiiii(), invoke_iiiiii(), invoke_iiiiiiiii() (+8 more)

### Community 27 - "getSocketFromFD"
Cohesion: 0.17
Nodes (16): _getaddrinfo(), getSocketAddress(), getSocketFromFD(), inetPton4(), inetPton6(), jstoi_q(), ___syscall_accept4(), ___syscall_bind() (+8 more)

### Community 28 - "CutterPanel.tsx"
Cohesion: 0.14
Nodes (24): GET(), Image(), loadFont(), size, displayTitle(), generateMetadata(), pct(), SongPage() (+16 more)

### Community 30 - "intArrayFromString"
Cohesion: 0.18
Nodes (12): _getnameinfo(), inetNtop4(), inetNtop6(), intArrayFromString(), LazyUint8Array(), lengthBytesUTF8(), readSockaddr(), stringToNewUTF8() (+4 more)

### Community 31 - "ReverbEq.tsx"
Cohesion: 0.12
Nodes (25): PlaylistBatch(), FormatPicker(), FORMATS, OutputFormat, QUALITIES, Quality, QualityPicker(), Resolution (+17 more)

### Community 32 - "AnalysisResult"
Cohesion: 0.22
Nodes (14): metadata, Status, VideoTool(), compressedName(), CompressProgress, compressToTargetSize(), FFmpegLike, isIos() (+6 more)

### Community 33 - "_strftime"
Cohesion: 0.15
Nodes (13): addDays(), arraySum(), ___assert_fail(), __gmtime_js(), isLeapYear(), __localtime_js(), __mktime_js(), readI53FromI64() (+5 more)

### Community 34 - "page.tsx"
Cohesion: 0.31
Nodes (8): POST(), spotifyRequestSchema, splitCombinedTitle(), extractItems(), fetchSpotifyTracklist(), findTrackList(), SpotifyTrackItem, SpotifyTracklistResult

### Community 35 - "asyncLoad"
Cohesion: 0.20
Nodes (12): addRunDependency(), assert(), asyncLoad(), createWasm(), FS_createPreloadedFile(), getUniqueRunDependency(), handleMessage(), instantiateAsync() (+4 more)

### Community 36 - "abort"
Cohesion: 0.20
Nodes (11): abort(), _dlopen(), ___dlsym(), getBinary(), getBinaryPromise(), getValue(), initRandomFill(), instantiateArrayBuffer() (+3 more)

### Community 37 - "page.tsx"
Cohesion: 0.18
Nodes (11): ActivityBpmPage(), generateMetadata(), metadata, SongBrowser(), SongRow, SortKey, SearchRow, SongSearch() (+3 more)

### Community 38 - "manifest.json"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, scope, short_name, start_url (+1 more)

### Community 39 - "page.tsx"
Cohesion: 0.29
Nodes (12): CachedRow, isSupportedTrackUrl(), LinkAnalyze(), LinkPreviewMeta, looksLikeUrl(), permalinkFor(), Phase, canonicalYouTubeUrl() (+4 more)

### Community 40 - "setup-ytdlp.mjs"
Cohesion: 0.22
Nodes (7): actual, binDir, check, expected, line, projectRoot, target

### Community 41 - "layout.tsx"
Cohesion: 0.25
Nodes (6): baloo2, geistMono, geistSans, metadata, STRUCTURED_DATA, viewport

### Community 42 - "callRuntimeCallbacks"
Cohesion: 0.25
Nodes (8): addOnPostRun(), addOnPreRun(), callRuntimeCallbacks(), initRuntime(), postRun(), preRun(), run(), setTimeout()

### Community 43 - "tunebad-bridge.sh"
Cohesion: 0.29
Nodes (6): FFMPEG_PATH, HOST, publish_url(), tunebad-bridge.sh script, YTDLP_MAX_JOB_STARTS, YTDLP_PATH

### Community 44 - "TuneBad — Security Review"
Cohesion: 0.25
Nodes (7): Architecture: the link downloader, Attack surface by deployment, Bot / abuse exposure, Recommendations (defense-in-depth, not blockers), Summary, TuneBad — Security Review, Verified-safe findings

### Community 45 - "TuneBad"
Cohesion: 0.29
Nodes (6): Deployment, Features, Home Bridge (route downloads through your own Mac), Local development, Optional: cloud history (Supabase), TuneBad

### Community 46 - "page.tsx"
Cohesion: 0.40
Nodes (3): FAQS, metadata, ROWS

### Community 47 - "getEnvStrings"
Cohesion: 0.40
Nodes (5): _environ_get(), _environ_sizes_get(), getEnvStrings(), getExecutableName(), stringToAscii()

### Community 48 - "next.config.mjs"
Cohesion: 0.50
Nodes (3): csp, nextConfig, withBundleAnalyzer

### Community 53 - "link-analysis.ts"
Cohesion: 0.36
Nodes (6): GET(), querySchema, quotePostgrestValue(), Row, searchSongs(), SongSearchRow

### Community 56 - "LandingSeo.tsx"
Cohesion: 0.14
Nodes (22): BpmToolsView(), MetronomeCard(), TapTempoCard(), DelayCalculator(), formatHz(), formatMs(), PRESET_NAME_KEYS, Footer() (+14 more)

### Community 57 - "useHistory.ts"
Cohesion: 0.25
Nodes (9): AnalysisSummary(), MetricCardProps, FileMetaPill(), LocalFileConverter(), Status, FilePicker(), formatDetailedTime(), formatFileSize() (+1 more)

### Community 58 - "page.tsx"
Cohesion: 0.23
Nodes (5): AnalyzerPanel(), HistoryPanel(), TunebadContextValue, AnalysisResult, HistoryEntry

### Community 59 - "route.ts"
Cohesion: 0.26
Nodes (11): HeicTool(), ResultRow, Status, HeicDecodeError, HeicOutputFormat, heicOutputName(), HeicResult, HeicTooLargeError (+3 more)

### Community 60 - "delay.ts"
Cohesion: 0.17
Nodes (21): ArtistPage(), generateMetadata(), generateStaticParams(), GET(), GET(), STATIC_ENTRIES, ToolEntry, generateStaticParams() (+13 more)

### Community 61 - "LandingSeo.tsx"
Cohesion: 0.52
Nodes (6): GET(), playlistRequestSchema, POST(), validatePlaylistUrl(), allowEnumerate(), fetchYouTubeTracklist()

### Community 62 - "page.tsx"
Cohesion: 0.48
Nodes (6): BpmHubPage(), generateMetadata(), generateStaticParams(), parseBpm(), tempoContext(), readSongsByBpmRange()

### Community 63 - "audio-joiner.ts"
Cohesion: 0.36
Nodes (6): ALL_CODES, CamelotHubPage(), CODE_TO_KEY, generateMetadata(), parseCode(), readSongsByCamelotCode()

### Community 64 - "lufs.ts"
Cohesion: 0.23
Nodes (11): biquad(), blockPowers(), integratedLoudness(), kWeight(), loudnessFromPower(), PlatformTarget, samplePeakDb(), STAGE1 (+3 more)

### Community 66 - "spotify-playlist.ts"
Cohesion: 0.47
Nodes (5): channelDataFor(), JoinOptions, RenderedAudio, renderJoin(), resampleBuffer()

### Community 67 - "BassBoosterTool.tsx"
Cohesion: 0.33
Nodes (6): BassBoosterTool(), CheckRow(), BassBoostParams, limitPeak(), renderBassBoost(), RenderedAudio

### Community 69 - "youtube-playlist.ts"
Cohesion: 0.22
Nodes (8): AUDIOMACK_HOSTS, INSTAGRAM_HOSTS, MIXCLOUD_HOSTS, SOUNDCLOUD_HOSTS, TIKTOK_HOSTS, TWITTER_HOSTS, VIMEO_HOSTS, YOUTUBE_HOSTS

### Community 70 - "NightcoreTool.tsx"
Cohesion: 0.47
Nodes (4): NightcoreTool(), NightcoreParams, RenderedAudio, renderNightcore()

## Knowledge Gaps
- **349 isolated node(s):** `metadata`, `resultSchema`, `querySchema`, `idSchema`, `searchSchema` (+344 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `ytdlp.ts` to `analysis.ts`, `RemixStudio.tsx`, `en.ts`, `VideoTool.tsx`, `link-analysis.ts`, `AnalyzerPanel.tsx`, `ToolFaq.tsx`, `page.tsx`, `ToolPageShell.tsx`, `backends.ts`, `media-url.ts`, `VideoTool.tsx`, `icons.tsx`, `ReverbEq.tsx`, `AnalysisResult`, `page.tsx`, `LandingSeo.tsx`, `useHistory.ts`, `page.tsx`, `route.ts`, `BassBoosterTool.tsx`, `NightcoreTool.tsx`?**
  _High betweenness centrality (0.148) - this node is a cross-community bridge._
- **Why does `validateSpotifyUrl()` connect `page.tsx` to `page.tsx`, `youtube-playlist.ts`, `useI18n`, `CutterPanel.tsx`, `LandingSeo.tsx`, `ReverbEq.tsx`?**
  _High betweenness centrality (0.023) - this node is a cross-community bridge._
- **Why does `validateMediaUrl()` connect `page.tsx` to `CutterPanel.tsx`, `youtube-playlist.ts`, `en.ts`, `ReverbEq.tsx`?**
  _High betweenness centrality (0.020) - this node is a cross-community bridge._
- **What connects `metadata`, `resultSchema`, `querySchema` to the rest of the system?**
  _351 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `analysis.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.052531645569620256 - nodes in this community are weakly interconnected._
- **Should `RemixStudio.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.06440677966101695 - nodes in this community are weakly interconnected._
- **Should `ffmpeg-core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.054078014184397165 - nodes in this community are weakly interconnected._