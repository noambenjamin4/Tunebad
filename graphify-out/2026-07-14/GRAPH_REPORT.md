# Graph Report - Tunebad  (2026-07-14)

## Corpus Check
- 244 files · ~257,855 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1471 nodes · 3461 edges · 78 communities (69 shown, 9 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 7 edges (avg confidence: 0.59)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `966d10f7`
- Run `git rev-parse HEAD` and compare to check if the graph is stale.
- Run `graphify update .` after code changes (no API cost).

## Community Hubs (Navigation)
- analysis.ts
- RemixStudio.tsx
- route.ts
- ffmpeg-core.js
- server.js
- TunebadApp
- layout.tsx
- rate-limit.ts
- dependencies
- lufs.ts
- VideoTool.tsx
- link-analysis.ts
- AnalyzerPanel.tsx
- ToolFaq.tsx
- CutterPanel.tsx
- ToolPageShell.tsx
- backends.ts
- AudioMasteringTool.tsx
- compilerOptions
- seed-songs.mjs
- VideoTool.tsx
- fs
- LoudnessPanel.tsx
- VideoTool.tsx
- page.tsx
- useAnalyzer.ts
- getWasmTableEntry
- getSocketFromFD
- CutterPanel.tsx
- ExceptionInfo
- intArrayFromString
- ReverbEq.tsx
- AnalysisResult
- _strftime
- CutterPanel.tsx
- asyncLoad
- abort
- audio-joiner.ts
- manifest.json
- page.tsx
- setup-ytdlp.mjs
- link-analysis.ts
- callRuntimeCallbacks
- tunebad-bridge.sh
- TuneBad — Security Review
- TuneBad
- AnalyzerPanel
- route.ts
- next.config.mjs
- gen-og-files.mjs
- TuneBad remote downloader
- essentia.d.ts
- next-env.d.ts
- lufs.ts
- tunebad-local.sh
- ReverbEq.tsx
- route.ts
- page.tsx
- route.ts
- page.tsx
- delay.ts
- useHistory.ts
- CamelotHubPage.tsx
- usePlaylistBatch.ts
- page.tsx
- route.ts
- useFileDrop
- youtube-playlist.ts
- useFileDrop
- page.tsx
- audio-joiner.ts
- PAGE_SIZE
- AnalyzerPanel
- youtube-playlist.ts
- media-url.ts
- youtube-playlist.ts

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 117 edges
2. `downloadBlob()` - 29 edges
3. `RemixStudio()` - 28 edges
4. `RelatedTools()` - 27 edges
5. `ToolPageShell()` - 27 edges
6. `useTunebad()` - 22 edges
7. `formatBytes()` - 22 edges
8. `AudioMasteringTool()` - 21 edges
9. `DictKey` - 21 edges
10. `fs` - 19 edges

## Surprising Connections (you probably didn't know these)
- `PlaylistLookupTrack` --references--> `CachedAnalysis`  [EXTRACTED]
  app/api/playlist-lookup/route.ts → lib/server/link-analysis.ts
- `LinkAnalyze()` --indirect_call--> `song()`  [INFERRED]
  components/analysis/LinkAnalyze.tsx → tests/artists.test.ts
- `RemixStudio()` --indirect_call--> `base()`  [INFERRED]
  components/remix/RemixStudio.tsx → public/vendor/ffmpeg/ffmpeg-core.js
- `GET()` --calls--> `resolveTitle()`  [EXTRACTED]
  app/api/lookup/route.ts → lib/server/link-analysis.ts
- `GET()` --calls--> `sourceIdForUrl()`  [EXTRACTED]
  app/api/lookup/route.ts → lib/server/link-analysis.ts

## Import Cycles
- 3-file cycle: `components/TunebadApp.tsx -> components/layout/TopBar.tsx -> components/layout/NavTabs.tsx -> components/TunebadApp.tsx`
- 3-file cycle: `components/TunebadApp.tsx -> components/converter/ConverterView.tsx -> components/converter/YouTubeDownloader.tsx -> components/TunebadApp.tsx`
- 3-file cycle: `components/TunebadApp.tsx -> components/bpm/BpmToolsView.tsx -> components/bpm/MetronomeCard.tsx -> components/TunebadApp.tsx`
- 3-file cycle: `components/TunebadApp.tsx -> components/bpm/BpmToolsView.tsx -> components/bpm/TapTempoCard.tsx -> components/TunebadApp.tsx`

## Communities (78 total, 9 thin omitted)

### Community 0 - "analysis.ts"
Cohesion: 0.05
Nodes (73): AutomationMove, DistributiveOmit, EFFECT_OPTIONS, formatSemitones(), matchesPreset(), Preset, PRESETS, RemixStudio() (+65 more)

### Community 1 - "RemixStudio.tsx"
Cohesion: 0.24
Nodes (13): artistMetaTitle(), ArtistPage(), generateMetadata(), generateStaticParams(), SongsPage(), ArtistGroup, artistSlug(), artistStats() (+5 more)

### Community 2 - "route.ts"
Cohesion: 0.20
Nodes (17): LocalFileConverter(), EXPORT_TARGETS, formatDb(), LoudnessPanel(), LoudnessWorkerResult, resampleTo48k(), toneFor(), PLATFORM_TARGETS (+9 more)

### Community 3 - "ffmpeg-core.js"
Cohesion: 0.05
Nodes (22): doCallback(), done(), _emscripten_asm_const_int(), _emscripten_get_heap_max(), emscripten_realloc_buffer(), _emscripten_resize_heap(), _environ_get(), _environ_sizes_get() (+14 more)

### Community 4 - "server.js"
Cohesion: 0.07
Nodes (43): AUDIOMACK_HOSTS, canonicalYouTubeUrl(), INSTAGRAM_HOSTS, MIXCLOUD_HOSTS, SOUNDCLOUD_HOSTS, TIKTOK_HOSTS, TWITTER_HOSTS, validateMediaUrl() (+35 more)

### Community 5 - "TunebadApp"
Cohesion: 0.08
Nodes (17): metadata, metadata, metadata, metadata, metadata, metadata, metadata, metadata (+9 more)

### Community 6 - "layout.tsx"
Cohesion: 0.19
Nodes (10): baloo2, geistMono, geistSans, metadata, STRUCTURED_DATA, viewport, ClientErrorReporter(), isReportable() (+2 more)

### Community 7 - "rate-limit.ts"
Cohesion: 0.13
Nodes (21): POST(), resultSchema, GET(), GET(), Home(), countSongs(), countSongsByBpmRange(), countSongsByKey() (+13 more)

### Community 8 - "dependencies"
Cohesion: 0.05
Nodes (40): dependencies, essentia.js, fflate, @ffmpeg/core, @ffmpeg/ffmpeg, ffmpeg-static, heic-to, next (+32 more)

### Community 9 - "lufs.ts"
Cohesion: 0.15
Nodes (16): ALL_CODES, CamelotWheelPage(), CODE_TO_KEY, FAQS, metadata, FAQS, metadata, PlaylistAnalyzerPage() (+8 more)

### Community 10 - "VideoTool.tsx"
Cohesion: 0.11
Nodes (29): metadata, AUDIO_FORMATS, MediaConvertTool(), MP3_BITRATES, Status, VIDEO_FORMATS, Status, VideoTool() (+21 more)

### Community 11 - "link-analysis.ts"
Cohesion: 0.12
Nodes (33): HeicTool(), ResultRow, Status, ImageDimensionError, ImageFormatPicker(), ImageTool(), ImageToolMode, ResultRow (+25 more)

### Community 12 - "AnalyzerPanel.tsx"
Cohesion: 0.17
Nodes (20): analyzeBandCurve(), applyStereoWidth(), BAND_EDGES, clampBand(), crestFactorDb(), effectiveCurve(), fft(), limitPeaks() (+12 more)

### Community 13 - "ToolFaq.tsx"
Cohesion: 0.33
Nodes (10): ensureAnonSession(), entryFromRemoteRow(), entryFromResult(), readLocal(), RemoteRow, useHistory(), writeLocal(), formatTime() (+2 more)

### Community 14 - "CutterPanel.tsx"
Cohesion: 0.11
Nodes (29): AudioEffectResult, Status, AudioFormatPicker(), AudioOutputFormat, MP3_BITRATES, AudioJoinerTool(), nextId(), QueuedFile (+21 more)

### Community 15 - "ToolPageShell.tsx"
Cohesion: 0.36
Nodes (6): WaveformPreview(), TopBar(), activeSources, isAnyAudioPlaying(), NowPlayingDetail, setNowPlaying()

### Community 16 - "backends.ts"
Cohesion: 0.15
Nodes (28): ArchiveFormat, entryFileName(), Status, Tab, ZipTool(), buildHeader(), computeChecksum(), createTarGz() (+20 more)

### Community 17 - "AudioMasteringTool.tsx"
Cohesion: 0.16
Nodes (20): GET(), querySchema, Image(), loadFont(), size, displayTitle(), generateMetadata(), metaTitle() (+12 more)

### Community 18 - "compilerOptions"
Cohesion: 0.10
Nodes (20): send_progress(), compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 19 - "seed-songs.mjs"
Cohesion: 0.12
Nodes (16): foldBpm(), addTracks(), analyze(), CAMELOT, collectTracks(), COUNTRY_PLAYLISTS, __dirname, env (+8 more)

### Community 20 - "VideoTool.tsx"
Cohesion: 0.21
Nodes (14): GET(), idSchema, querySchema, searchSchema, PlaylistLookupTrack, querySchema, resolveTrack(), runPool() (+6 more)

### Community 21 - "fs"
Cohesion: 0.11
Nodes (18): bigintToI53Checked(), doReadv(), doWritev(), _fd_close(), _fd_fdstat_get(), _fd_read(), _fd_seek(), _fd_write() (+10 more)

### Community 23 - "VideoTool.tsx"
Cohesion: 0.23
Nodes (5): AnalyzerPanel(), HistoryPanel(), TunebadContextValue, AnalyzerState, AnalysisResult

### Community 24 - "page.tsx"
Cohesion: 0.13
Nodes (9): CamelotWheelSvg(), metadata, polar(), WHEEL, metadata, metadata, metadata, metadata (+1 more)

### Community 25 - "useAnalyzer.ts"
Cohesion: 0.06
Nodes (30): metadata, metadata, metadata, metadata, metadata, metadata, metadata, metadata (+22 more)

### Community 26 - "getWasmTableEntry"
Cohesion: 0.12
Nodes (16): getWasmTableEntry(), invoke_i(), invoke_ii(), invoke_iii(), invoke_iiii(), invoke_iiiii(), invoke_iiiiii(), invoke_iiiiiiiii() (+8 more)

### Community 27 - "getSocketFromFD"
Cohesion: 0.14
Nodes (19): alignMemory(), _getaddrinfo(), getSocketAddress(), getSocketFromFD(), inetPton4(), inetPton6(), jstoi_q(), mmapAlloc() (+11 more)

### Community 28 - "CutterPanel.tsx"
Cohesion: 0.24
Nodes (12): MetronomeCard(), TapTempoCard(), DelayCalculator(), formatHz(), formatMs(), PRESET_NAME_KEYS, useTunebad(), clampBpm() (+4 more)

### Community 30 - "intArrayFromString"
Cohesion: 0.18
Nodes (12): _getnameinfo(), inetNtop4(), inetNtop6(), intArrayFromString(), LazyUint8Array(), lengthBytesUTF8(), readSockaddr(), stringToNewUTF8() (+4 more)

### Community 31 - "ReverbEq.tsx"
Cohesion: 0.12
Nodes (23): Status, PlaylistBatch(), FormatPicker(), FORMATS, OutputFormat, QUALITIES, Quality, QualityPicker() (+15 more)

### Community 32 - "AnalysisResult"
Cohesion: 0.12
Nodes (21): AbMode, AudioMasteringTool(), barsFromChannels(), differenceCurve(), GENRE_LABELS, GENRE_ORDER, GENRE_PRESETS, GenreKey (+13 more)

### Community 33 - "_strftime"
Cohesion: 0.15
Nodes (13): addDays(), arraySum(), ___assert_fail(), __gmtime_js(), isLeapYear(), __localtime_js(), __mktime_js(), readI53FromI64() (+5 more)

### Community 34 - "CutterPanel.tsx"
Cohesion: 0.13
Nodes (12): FAQ_JSON_LD, FAQ_KEYS, TOUR_KEYS, VALUE_KEYS, de, en, es, fr (+4 more)

### Community 35 - "asyncLoad"
Cohesion: 0.20
Nodes (12): addRunDependency(), assert(), asyncLoad(), createWasm(), FS_createPreloadedFile(), getUniqueRunDependency(), handleMessage(), instantiateAsync() (+4 more)

### Community 36 - "abort"
Cohesion: 0.20
Nodes (11): abort(), _dlopen(), ___dlsym(), getBinary(), getBinaryPromise(), getValue(), initRandomFill(), instantiateArrayBuffer() (+3 more)

### Community 37 - "audio-joiner.ts"
Cohesion: 0.29
Nodes (7): AnalysisSummary(), MetricCardProps, FileMetaPill(), WaveformIcon(), exportResultsCsv(), formatDetailedTime(), formatSampleRate()

### Community 38 - "manifest.json"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, scope, short_name, start_url (+1 more)

### Community 39 - "page.tsx"
Cohesion: 0.15
Nodes (12): PitchConverter(), REFERENCES, BASE_SVG_PROPS, DownloadIcon(), EchoIcon(), GaugeIcon(), HistoryIcon(), IconProps (+4 more)

### Community 40 - "setup-ytdlp.mjs"
Cohesion: 0.22
Nodes (7): actual, binDir, check, expected, line, projectRoot, target

### Community 41 - "link-analysis.ts"
Cohesion: 0.23
Nodes (15): applyFades(), CutterPanel(), Status, clamp(), TrimWaveform(), ZOOM_LEVELS, ZoomLevel, bytesOf() (+7 more)

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

### Community 46 - "AnalyzerPanel"
Cohesion: 0.24
Nodes (9): generateMetadata(), generateMetadata(), ALL_CODES, camelotHubMeta(), CamelotHubPage(), CODE_TO_KEY, parseCode(), countSongsByCamelotCode() (+1 more)

### Community 47 - "route.ts"
Cohesion: 0.15
Nodes (19): CONTENT_TYPE_BY_FORMAT, contentDisposition(), GET(), GET(), Backend, backendForJob(), BackendPick, BackendTag (+11 more)

### Community 48 - "next.config.mjs"
Cohesion: 0.50
Nodes (3): csp, nextConfig, withBundleAnalyzer

### Community 53 - "lufs.ts"
Cohesion: 0.21
Nodes (11): biquad(), blockPowers(), integratedLoudness(), kWeight(), loudnessFromPower(), PlatformTarget, samplePeakDb(), STAGE1 (+3 more)

### Community 56 - "ReverbEq.tsx"
Cohesion: 0.08
Nodes (38): CAMELOT_ORDER, ErrorKey, exportPlaylistCsv(), Phase, PlaylistAnalyzer(), AnalyzeStage, useAnalyzer(), PlaylistCachedRow (+30 more)

### Community 57 - "route.ts"
Cohesion: 0.21
Nodes (14): GET(), GET(), STATIC_ENTRIES, ToolEntry, generateStaticParams(), generateStaticParams(), readAllSongs(), readSongFacets() (+6 more)

### Community 58 - "page.tsx"
Cohesion: 0.17
Nodes (12): ActivityBpmPage(), generateMetadata(), metadata, SongBrowser(), SongRow, SortKey, SearchRow, SongSearch() (+4 more)

### Community 59 - "route.ts"
Cohesion: 0.31
Nodes (8): POST(), spotifyRequestSchema, splitCombinedTitle(), extractItems(), fetchSpotifyTracklist(), findTrackList(), SpotifyTrackItem, SpotifyTracklistResult

### Community 60 - "page.tsx"
Cohesion: 0.26
Nodes (14): globalStore, sweepJobs(), YT_BASE_DIR, YtJob, classifyError(), enumeratePlaylist(), isExecutable(), PlaylistItem (+6 more)

### Community 61 - "delay.ts"
Cohesion: 0.27
Nodes (9): DelayDivision, delayDivisions(), DelayResult, DelayValue, DIVISION_DEFS, REVERB_PRESET_DEFS, ReverbPreset, round2() (+1 more)

### Community 62 - "useHistory.ts"
Cohesion: 0.31
Nodes (5): metadata, NightcoreTool(), NightcoreParams, RenderedAudio, renderNightcore()

### Community 63 - "CamelotHubPage.tsx"
Cohesion: 0.16
Nodes (24): CamelotWheel(), CODE_TO_KEY, point(), segmentPath(), SEGMENTS, shortKey(), generateMetadata(), generateStaticParams() (+16 more)

### Community 64 - "usePlaylistBatch.ts"
Cohesion: 0.60
Nodes (5): BpmHubPage(), generateMetadata(), parseBpm(), tempoContext(), readSongsByBpmRange()

### Community 65 - "page.tsx"
Cohesion: 0.20
Nodes (11): POST(), reportSchema, POST(), runningJobCount(), allow(), allowErrorReport(), allowJobStart(), Buckets (+3 more)

### Community 66 - "route.ts"
Cohesion: 0.36
Nodes (6): GET(), querySchema, quotePostgrestValue(), Row, searchSongs(), SongSearchRow

### Community 68 - "useFileDrop"
Cohesion: 0.52
Nodes (4): DropZone(), FilePicker(), useFileDrop(), formatFileSize()

### Community 70 - "useFileDrop"
Cohesion: 0.22
Nodes (14): DANCE_T, decode(), FFMPEG, findPreview(), foldCurrent(), foldDanceAware(), foldNone(), foldWide() (+6 more)

### Community 71 - "page.tsx"
Cohesion: 0.38
Nodes (5): CURVE, DRIVES, magnitudeAt(), measure(), shape()

### Community 72 - "audio-joiner.ts"
Cohesion: 0.47
Nodes (5): channelDataFor(), JoinOptions, RenderedAudio, renderJoin(), resampleBuffer()

### Community 74 - "AnalyzerPanel"
Cohesion: 0.06
Nodes (45): metadata, metadata, RecentRow, RecentStrip(), ResultsTable(), STAGE_ROW_LABELS, SimilarSong, SimilarSongs() (+37 more)

### Community 75 - "youtube-playlist.ts"
Cohesion: 0.20
Nodes (9): GET(), playlistRequestSchema, POST(), validatePlaylistUrl(), IMPORTANT: this module reads server-only secrets and must never be, allowEnumerate(), fetchYouTubeTracklist(), YouTubeTracklistItem (+1 more)

### Community 76 - "media-url.ts"
Cohesion: 0.13
Nodes (23): CachedRow, isSupportedTrackUrl(), LinkAnalyze(), LinkPreviewMeta, looksLikeUrl(), permalinkFor(), Phase, parseTimestamp() (+15 more)

### Community 78 - "youtube-playlist.ts"
Cohesion: 0.22
Nodes (13): decode(), detect(), FFMPEG, findPreview(), FLAT_TO_SHARP, getEssentia(), main(), PROFILES (+5 more)

## Knowledge Gaps
- **394 isolated node(s):** `metadata`, `resultSchema`, `reportSchema`, `querySchema`, `idSchema` (+389 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **9 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RemixStudio()` connect `analysis.ts` to `AnalysisResult`, `route.ts`, `useFileDrop`, `TunebadApp`, `link-analysis.ts`, `AnalyzerPanel`, `ToolFaq.tsx`, `CutterPanel.tsx`, `ToolPageShell.tsx`, `VideoTool.tsx`, `ReverbEq.tsx`, `CutterPanel.tsx`?**
  _High betweenness centrality (0.262) - this node is a cross-community bridge._
- **Why does `base()` connect `analysis.ts` to `ffmpeg-core.js`?**
  _High betweenness centrality (0.253) - this node is a cross-community bridge._
- **Why does `useI18n()` connect `AnalyzerPanel` to `analysis.ts`, `route.ts`, `TunebadApp`, `VideoTool.tsx`, `link-analysis.ts`, `CutterPanel.tsx`, `ToolPageShell.tsx`, `backends.ts`, `VideoTool.tsx`, `useAnalyzer.ts`, `CutterPanel.tsx`, `ReverbEq.tsx`, `AnalysisResult`, `CutterPanel.tsx`, `audio-joiner.ts`, `page.tsx`, `link-analysis.ts`, `ReverbEq.tsx`, `useHistory.ts`, `useFileDrop`, `media-url.ts`?**
  _High betweenness centrality (0.174) - this node is a cross-community bridge._
- **What connects `metadata`, `resultSchema`, `reportSchema` to the rest of the system?**
  _396 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `analysis.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.0519311911716975 - nodes in this community are weakly interconnected._
- **Should `ffmpeg-core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.05442176870748299 - nodes in this community are weakly interconnected._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06868686868686869 - nodes in this community are weakly interconnected._