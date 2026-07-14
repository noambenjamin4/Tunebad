# Graph Report - Tunebad  (2026-07-14)

## Corpus Check
- 230 files · ~241,449 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1376 nodes · 3261 edges · 81 communities (66 shown, 15 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 6 edges (avg confidence: 0.55)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `c2e4e53c`
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
- icons.tsx
- getWasmTableEntry
- getSocketFromFD
- CutterPanel.tsx
- ExceptionInfo
- intArrayFromString
- ReverbEq.tsx
- AnalysisResult
- _strftime
- delay.ts
- asyncLoad
- abort
- audio-joiner.ts
- manifest.json
- page.tsx
- setup-ytdlp.mjs
- RemixStudio.tsx
- callRuntimeCallbacks
- tunebad-bridge.sh
- TuneBad — Security Review
- TuneBad
- LoudnessPanel.tsx
- getEnvStrings
- next.config.mjs
- gen-og-files.mjs
- TuneBad remote downloader
- essentia.d.ts
- next-env.d.ts
- downloadBlob
- tunebad-local.sh
- LandingSeo.tsx
- route.ts
- LandingSeo.tsx
- useHistory.ts
- page.tsx
- MetronomeCard.tsx
- usePlaylistBatch.ts
- media-url.ts
- format.ts
- MetronomeCard.tsx
- spotify-playlist.ts
- page.tsx
- youtube-playlist.ts
- page.tsx
- delay.ts
- page.tsx
- page.tsx
- page.tsx
- page.tsx
- page.tsx
- NightcoreTool.tsx
- artists.ts
- AnalyzerPanel
- audio-joiner.ts

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 117 edges
2. `downloadBlob()` - 29 edges
3. `RelatedTools()` - 27 edges
4. `ToolPageShell()` - 27 edges
5. `RemixStudio()` - 24 edges
6. `useTunebad()` - 22 edges
7. `formatBytes()` - 22 edges
8. `AudioMasteringTool()` - 20 edges
9. `DictKey` - 19 edges
10. `fs` - 19 edges

## Surprising Connections (you probably didn't know these)
- `PlaylistLookupTrack` --references--> `CachedAnalysis`  [EXTRACTED]
  app/api/playlist-lookup/route.ts → lib/server/link-analysis.ts
- `Home()` --calls--> `countSongs()`  [EXTRACTED]
  app/page.tsx → lib/server/link-analysis.ts
- `PlaylistAnalyzerPage()` --calls--> `faqPageJsonLd()`  [EXTRACTED]
  app/playlist-analyzer/page.tsx → lib/seo/jsonld.ts
- `LinkAnalyze()` --indirect_call--> `song()`  [INFERRED]
  components/analysis/LinkAnalyze.tsx → tests/artists.test.ts
- `AnalyzerState` --references--> `AnalysisResult`  [EXTRACTED]
  hooks/useAnalyzer.ts → types/analysis.ts

## Import Cycles
- 3-file cycle: `components/TunebadApp.tsx -> components/layout/TopBar.tsx -> components/layout/NavTabs.tsx -> components/TunebadApp.tsx`
- 3-file cycle: `components/TunebadApp.tsx -> components/converter/ConverterView.tsx -> components/converter/YouTubeDownloader.tsx -> components/TunebadApp.tsx`
- 3-file cycle: `components/TunebadApp.tsx -> components/bpm/BpmToolsView.tsx -> components/bpm/MetronomeCard.tsx -> components/TunebadApp.tsx`
- 3-file cycle: `components/TunebadApp.tsx -> components/bpm/BpmToolsView.tsx -> components/bpm/TapTempoCard.tsx -> components/TunebadApp.tsx`

## Communities (81 total, 15 thin omitted)

### Community 0 - "analysis.ts"
Cohesion: 0.07
Nodes (45): EightDTool(), clamp(), computeResponseDb(), curveDbAt(), curvePath(), dbOf(), EqNodeDef, EqNodeId (+37 more)

### Community 2 - "route.ts"
Cohesion: 0.33
Nodes (9): GET(), idSchema, querySchema, searchSchema, resolveTrack(), cleanSongTitle(), findDeezerPreview(), findPreview() (+1 more)

### Community 3 - "ffmpeg-core.js"
Cohesion: 0.05
Nodes (20): alignMemory(), doCallback(), done(), _emscripten_asm_const_int(), _emscripten_get_heap_max(), emscripten_realloc_buffer(), _emscripten_resize_heap(), exec() (+12 more)

### Community 4 - "server.js"
Cohesion: 0.07
Nodes (43): AUDIOMACK_HOSTS, canonicalYouTubeUrl(), INSTAGRAM_HOSTS, MIXCLOUD_HOSTS, SOUNDCLOUD_HOSTS, TIKTOK_HOSTS, TWITTER_HOSTS, validateMediaUrl() (+35 more)

### Community 5 - "TunebadApp"
Cohesion: 0.07
Nodes (19): metadata, metadata, metadata, metadata, metadata, metadata, metadata, metadata (+11 more)

### Community 6 - "layout.tsx"
Cohesion: 0.22
Nodes (8): baloo2, geistMono, geistSans, metadata, STRUCTURED_DATA, viewport, ClientErrorReporter(), report()

### Community 7 - "rate-limit.ts"
Cohesion: 0.26
Nodes (14): globalStore, sweepJobs(), YT_BASE_DIR, YtJob, classifyError(), enumeratePlaylist(), isExecutable(), PlaylistItem (+6 more)

### Community 8 - "dependencies"
Cohesion: 0.05
Nodes (40): dependencies, essentia.js, fflate, @ffmpeg/core, @ffmpeg/ffmpeg, ffmpeg-static, heic-to, next (+32 more)

### Community 9 - "lufs.ts"
Cohesion: 0.09
Nodes (35): CAMELOT_ORDER, ErrorKey, exportPlaylistCsv(), Phase, PlaylistAnalyzer(), AnalyzerState, useAnalyzer(), PlaylistCachedRow (+27 more)

### Community 10 - "VideoTool.tsx"
Cohesion: 0.14
Nodes (16): POST(), resultSchema, GET(), GET(), GET(), querySchema, GET(), querySchema (+8 more)

### Community 11 - "link-analysis.ts"
Cohesion: 0.11
Nodes (34): HeicTool(), ResultRow, Status, FileDropSection(), ImageDimensionError, ImageFormatPicker(), ImageTool(), ImageToolMode (+26 more)

### Community 12 - "AnalyzerPanel.tsx"
Cohesion: 0.15
Nodes (21): GET(), PlaylistLookupTrack, querySchema, runPool(), sleep(), SourceTrack, POST(), spotifyRequestSchema (+13 more)

### Community 13 - "ToolFaq.tsx"
Cohesion: 0.13
Nodes (18): CONTENT_TYPE_BY_FORMAT, contentDisposition(), GET(), GET(), IMPORTANT: this module reads server-only secrets and must never be, Backend, backendForJob(), BackendTag (+10 more)

### Community 14 - "CutterPanel.tsx"
Cohesion: 0.31
Nodes (10): WaveformPreview(), applyFades(), CutterPanel(), Status, clamp(), TrimWaveform(), fadeEnvelopeGain(), fadeRampSeconds() (+2 more)

### Community 15 - "ToolPageShell.tsx"
Cohesion: 0.09
Nodes (17): Home(), metadata, FILE_TOOLS, ToolsHub(), FAQ_JSON_LD, FAQ_KEYS, LandingSeo(), TOUR_KEYS (+9 more)

### Community 16 - "backends.ts"
Cohesion: 0.15
Nodes (28): ArchiveFormat, entryFileName(), Status, Tab, ZipTool(), buildHeader(), computeChecksum(), createTarGz() (+20 more)

### Community 17 - "AudioMasteringTool.tsx"
Cohesion: 0.17
Nodes (15): AbMode, AudioMasteringTool(), barsFromChannels(), differenceCurve(), GENRE_LABELS, GENRE_ORDER, GENRE_PRESETS, GenreKey (+7 more)

### Community 18 - "compilerOptions"
Cohesion: 0.10
Nodes (20): send_progress(), compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 19 - "seed-songs.mjs"
Cohesion: 0.13
Nodes (15): addTracks(), analyze(), CAMELOT, collectTracks(), COUNTRY_PLAYLISTS, __dirname, env, existing (+7 more)

### Community 20 - "VideoTool.tsx"
Cohesion: 0.13
Nodes (28): AUDIO_FORMATS, MediaConvertTool(), MP3_BITRATES, Status, VIDEO_FORMATS, Status, VideoTool(), AUDIO_MIME (+20 more)

### Community 21 - "fs"
Cohesion: 0.11
Nodes (18): bigintToI53Checked(), doReadv(), doWritev(), _fd_close(), _fd_fdstat_get(), _fd_read(), _fd_seek(), _fd_write() (+10 more)

### Community 23 - "VideoTool.tsx"
Cohesion: 0.13
Nodes (22): CamelotWheel(), CODE_TO_KEY, point(), segmentPath(), SEGMENTS, shortKey(), ALL_CODES, CamelotWheelPage() (+14 more)

### Community 24 - "page.tsx"
Cohesion: 0.13
Nodes (9): CamelotWheelSvg(), metadata, polar(), WHEEL, metadata, metadata, metadata, metadata (+1 more)

### Community 25 - "icons.tsx"
Cohesion: 0.20
Nodes (11): POST(), reportSchema, POST(), runningJobCount(), allow(), allowErrorReport(), allowJobStart(), Buckets (+3 more)

### Community 26 - "getWasmTableEntry"
Cohesion: 0.12
Nodes (16): getWasmTableEntry(), invoke_i(), invoke_ii(), invoke_iii(), invoke_iiii(), invoke_iiiii(), invoke_iiiiii(), invoke_iiiiiiiii() (+8 more)

### Community 27 - "getSocketFromFD"
Cohesion: 0.17
Nodes (16): _getaddrinfo(), getSocketAddress(), getSocketFromFD(), inetPton4(), inetPton6(), jstoi_q(), ___syscall_accept4(), ___syscall_bind() (+8 more)

### Community 28 - "CutterPanel.tsx"
Cohesion: 0.25
Nodes (14): displayTitle(), generateMetadata(), metaTitle(), pct(), SongPage(), SongPageInner(), tempoFeel(), camelotNeighbors() (+6 more)

### Community 30 - "intArrayFromString"
Cohesion: 0.18
Nodes (12): _getnameinfo(), inetNtop4(), inetNtop6(), intArrayFromString(), LazyUint8Array(), lengthBytesUTF8(), readSockaddr(), stringToNewUTF8() (+4 more)

### Community 31 - "ReverbEq.tsx"
Cohesion: 0.12
Nodes (28): ConverterView(), Status, PlaylistBatch(), FormatPicker(), FORMATS, OutputFormat, QUALITIES, Quality (+20 more)

### Community 32 - "AnalysisResult"
Cohesion: 0.19
Nodes (12): generateStaticParams(), generateStaticParams(), metadata, SongsPage(), SongBrowser(), SongRow, SortKey, SearchRow (+4 more)

### Community 33 - "_strftime"
Cohesion: 0.15
Nodes (13): addDays(), arraySum(), ___assert_fail(), __gmtime_js(), isLeapYear(), __localtime_js(), __mktime_js(), readI53FromI64() (+5 more)

### Community 34 - "delay.ts"
Cohesion: 0.29
Nodes (7): HISTORY_TAB, NavTabs(), TABS, TopBar(), activeSources, isAnyAudioPlaying(), NowPlayingDetail

### Community 35 - "asyncLoad"
Cohesion: 0.20
Nodes (12): addRunDependency(), assert(), asyncLoad(), createWasm(), FS_createPreloadedFile(), getUniqueRunDependency(), handleMessage(), instantiateAsync() (+4 more)

### Community 36 - "abort"
Cohesion: 0.20
Nodes (11): abort(), _dlopen(), ___dlsym(), getBinary(), getBinaryPromise(), getValue(), initRandomFill(), instantiateArrayBuffer() (+3 more)

### Community 37 - "audio-joiner.ts"
Cohesion: 0.25
Nodes (11): DropZone(), FileDrop(), EXPORT_TARGETS, formatDb(), LoudnessPanel(), LoudnessWorkerResult, resampleTo48k(), toneFor() (+3 more)

### Community 38 - "manifest.json"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, scope, short_name, start_url (+1 more)

### Community 39 - "page.tsx"
Cohesion: 0.10
Nodes (29): biquad(), blockPowers(), integratedLoudness(), kWeight(), loudnessFromPower(), PlatformTarget, samplePeakDb(), STAGE1 (+21 more)

### Community 40 - "setup-ytdlp.mjs"
Cohesion: 0.22
Nodes (7): actual, binDir, check, expected, line, projectRoot, target

### Community 41 - "RemixStudio.tsx"
Cohesion: 0.22
Nodes (14): formatSemitones(), matchesPreset(), Preset, PRESETS, RemixStudio(), REVERB_TYPE_OPTIONS, Status, useUnloadGuard() (+6 more)

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

### Community 46 - "LoudnessPanel.tsx"
Cohesion: 0.11
Nodes (12): metadata, metadata, metadata, metadata, metadata, FAQS, metadata, ROWS (+4 more)

### Community 47 - "getEnvStrings"
Cohesion: 0.40
Nodes (5): _environ_get(), _environ_sizes_get(), getEnvStrings(), getExecutableName(), stringToAscii()

### Community 48 - "next.config.mjs"
Cohesion: 0.50
Nodes (3): csp, nextConfig, withBundleAnalyzer

### Community 53 - "downloadBlob"
Cohesion: 0.14
Nodes (21): CachedRow, isSupportedTrackUrl(), LinkAnalyze(), LinkPreviewMeta, looksLikeUrl(), permalinkFor(), Phase, AUDIOMACK_HOSTS (+13 more)

### Community 56 - "LandingSeo.tsx"
Cohesion: 0.39
Nodes (6): ActivityBpmPage(), generateMetadata(), ACTIVITIES, Activity, findActivity(), readSongsByBpmRangeAll()

### Community 57 - "route.ts"
Cohesion: 0.16
Nodes (17): GET(), GET(), STATIC_ENTRIES, ToolEntry, BpmHubPage(), generateMetadata(), generateStaticParams(), parseBpm() (+9 more)

### Community 58 - "LandingSeo.tsx"
Cohesion: 0.20
Nodes (12): Image(), loadFont(), size, DeezerPreviewMatch, isLinkAnalysisConfigured, PreviewMatch, readAnalysisBySlug(), readArtistNames() (+4 more)

### Community 59 - "useHistory.ts"
Cohesion: 0.17
Nodes (11): PitchConverter(), REFERENCES, BASE_SVG_PROPS, EchoIcon(), GaugeIcon(), HistoryIcon(), IconProps, SlowedIcon() (+3 more)

### Community 60 - "page.tsx"
Cohesion: 0.24
Nodes (12): clamp(), SeekableWaveform(), ensureAnonSession(), entryFromRemoteRow(), entryFromResult(), readLocal(), RemoteRow, useHistory() (+4 more)

### Community 61 - "MetronomeCard.tsx"
Cohesion: 0.09
Nodes (17): metadata, metadata, metadata, metadata, metadata, metadata, metadata, metadata (+9 more)

### Community 62 - "usePlaylistBatch.ts"
Cohesion: 0.13
Nodes (17): AnalysisSummary(), MetricCardProps, FileMetaPill(), RecentRow, RecentStrip(), ResultsTable(), SimilarSong, SimilarSongs() (+9 more)

### Community 63 - "media-url.ts"
Cohesion: 0.14
Nodes (25): LocalFileConverter(), AudioEffectResult, AudioEffectTool(), Status, AudioFormatPicker(), AudioOutputFormat, MP3_BITRATES, AudioJoinerTool() (+17 more)

### Community 64 - "format.ts"
Cohesion: 0.12
Nodes (19): metadata, FAQS, metadata, PlaylistAnalyzerPage(), KNOWN_HREFS, LINKS, ToolPageNav(), CopyrightBody() (+11 more)

### Community 65 - "MetronomeCard.tsx"
Cohesion: 0.24
Nodes (13): generateMetadata(), generateStaticParams(), MinimalFooter(), keyHubHref(), keyHubMeta(), KeyHubPage(), ALL_KEYS, CamelotCode (+5 more)

### Community 66 - "spotify-playlist.ts"
Cohesion: 0.43
Nodes (5): BassBoosterTool(), BassBoostParams, limitPeak(), renderBassBoost(), RenderedAudio

### Community 71 - "delay.ts"
Cohesion: 0.13
Nodes (22): BpmToolsView(), MetronomeCard(), TapTempoCard(), DelayCalculator(), formatHz(), formatMs(), PRESET_NAME_KEYS, useTunebad() (+14 more)

### Community 75 - "page.tsx"
Cohesion: 0.20
Nodes (16): PdfSplitTool(), Status, PdfTool(), PdfToolMode, Status, formatBytes(), extractPages(), imagesToPdf() (+8 more)

### Community 77 - "NightcoreTool.tsx"
Cohesion: 0.47
Nodes (4): NightcoreTool(), NightcoreParams, RenderedAudio, renderNightcore()

### Community 78 - "artists.ts"
Cohesion: 0.29
Nodes (10): artistMetaTitle(), ArtistPage(), generateMetadata(), ArtistGroup, artistSlug(), artistStats(), groupSongsByArtist(), readSongsByArtist (+2 more)

### Community 79 - "AnalyzerPanel"
Cohesion: 0.28
Nodes (4): AnalyzerPanel(), HistoryPanel(), TunebadContextValue, AnalysisResult

### Community 80 - "audio-joiner.ts"
Cohesion: 0.47
Nodes (5): channelDataFor(), JoinOptions, RenderedAudio, renderJoin(), resampleBuffer()

## Knowledge Gaps
- **374 isolated node(s):** `metadata`, `resultSchema`, `reportSchema`, `querySchema`, `idSchema` (+369 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **15 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `ReverbEq.tsx` to `analysis.ts`, `TunebadApp`, `lufs.ts`, `link-analysis.ts`, `CutterPanel.tsx`, `ToolPageShell.tsx`, `backends.ts`, `AudioMasteringTool.tsx`, `VideoTool.tsx`, `delay.ts`, `audio-joiner.ts`, `RemixStudio.tsx`, `LoudnessPanel.tsx`, `downloadBlob`, `useHistory.ts`, `page.tsx`, `MetronomeCard.tsx`, `usePlaylistBatch.ts`, `media-url.ts`, `format.ts`, `spotify-playlist.ts`, `delay.ts`, `page.tsx`, `NightcoreTool.tsx`, `AnalyzerPanel`?**
  _High betweenness centrality (0.115) - this node is a cross-community bridge._
- **Why does `keyToSlug()` connect `MetronomeCard.tsx` to `AnalysisResult`, `route.ts`, `CutterPanel.tsx`, `VideoTool.tsx`?**
  _High betweenness centrality (0.014) - this node is a cross-community bridge._
- **Why does `validateSpotifyUrl()` connect `downloadBlob` to `LandingSeo.tsx`, `AnalyzerPanel.tsx`, `ReverbEq.tsx`?**
  _High betweenness centrality (0.012) - this node is a cross-community bridge._
- **What connects `metadata`, `resultSchema`, `reportSchema` to the rest of the system?**
  _376 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `analysis.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.06901960784313725 - nodes in this community are weakly interconnected._
- **Should `ffmpeg-core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.054078014184397165 - nodes in this community are weakly interconnected._
- **Should `server.js` be split into smaller, more focused modules?**
  _Cohesion score 0.06868686868686869 - nodes in this community are weakly interconnected._