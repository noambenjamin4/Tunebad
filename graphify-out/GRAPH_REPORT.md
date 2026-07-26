# Graph Report - Tunebad  (2026-07-26)

## Corpus Check
- 268 files · ~296,195 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1648 nodes · 4004 edges · 85 communities (75 shown, 10 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 18 edges (avg confidence: 0.72)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `e03643f6`
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
- AudioMasteringTool.tsx
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
- lufs.ts
- callRuntimeCallbacks
- tunebad-bridge.sh
- TuneBad — Security Review
- TuneBad
- AnalyzerPanel
- mp3-encoder.ts
- next.config.mjs
- gen-og-files.mjs
- TuneBad remote downloader
- essentia.d.ts
- next-env.d.ts
- lufs.ts
- tunebad-local.sh
- DelayCalculator.tsx
- route.ts
- page.tsx
- audio-joiner.ts
- formatBytes
- delay.ts
- page.tsx
- CamelotHubPage.tsx
- downloadBlob
- route.ts
- CutterPanel.tsx
- page.tsx
- youtube-playlist.ts
- useFileDrop
- page.tsx
- LandingSeo.tsx
- PAGE_SIZE
- LandingSeo.tsx
- page.tsx
- useHistory.ts
- useUnloadGuard
- youtube-playlist.ts
- usePlaylistBatch.ts
- NightcoreTool.tsx
- octave-map.mjs
- page.tsx
- page.tsx
- StudioClient.tsx

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 123 edges
2. `StudioPanel()` - 48 edges
3. `downloadBlob()` - 31 edges
4. `RelatedTools()` - 28 edges
5. `ToolPageShell()` - 28 edges
6. `RemixStudio()` - 28 edges
7. `useTunebad()` - 22 edges
8. `formatBytes()` - 22 edges
9. `StudioEngine` - 22 edges
10. `AudioMasteringTool()` - 21 edges

## Surprising Connections (you probably didn't know these)
- `PlaylistLookupTrack` --references--> `CachedAnalysis`  [EXTRACTED]
  app/api/playlist-lookup/route.ts → lib/server/link-analysis.ts
- `Home()` --calls--> `countSongs()`  [EXTRACTED]
  app/page.tsx → lib/server/link-analysis.ts
- `LinkAnalyze()` --indirect_call--> `song()`  [INFERRED]
  components/analysis/LinkAnalyze.tsx → tests/artists.test.ts
- `RemixStudio()` --indirect_call--> `base()`  [INFERRED]
  components/remix/RemixStudio.tsx → public/vendor/ffmpeg/ffmpeg-core.js
- `StudioPanel()` --indirect_call--> `hit()`  [INFERRED]
  components/studio/StudioPanel.tsx → scripts/octave-map.mjs

## Import Cycles
- 3-file cycle: `components/TunebadApp.tsx -> components/layout/TopBar.tsx -> components/layout/NavTabs.tsx -> components/TunebadApp.tsx`
- 3-file cycle: `components/TunebadApp.tsx -> components/converter/ConverterView.tsx -> components/converter/YouTubeDownloader.tsx -> components/TunebadApp.tsx`
- 3-file cycle: `components/TunebadApp.tsx -> components/bpm/BpmToolsView.tsx -> components/bpm/MetronomeCard.tsx -> components/TunebadApp.tsx`
- 3-file cycle: `components/TunebadApp.tsx -> components/bpm/BpmToolsView.tsx -> components/bpm/TapTempoCard.tsx -> components/TunebadApp.tsx`

## Communities (85 total, 10 thin omitted)

### Community 0 - "analysis.ts"
Cohesion: 0.08
Nodes (37): EightDTool(), EightDParams, RenderedAudio, renderEightD(), applyEffectParams(), automatedOutputDuration(), baseEffectiveSpeed(), buildEffectChain() (+29 more)

### Community 1 - "RemixStudio.tsx"
Cohesion: 0.14
Nodes (20): artistMetaTitle(), ArtistPage(), generateMetadata(), generateStaticParams(), generateStaticParams(), metadata, SongsPage(), SongBrowser() (+12 more)

### Community 2 - "route.ts"
Cohesion: 0.18
Nodes (29): DragState, Timeline(), BeatGrid, beatTimesInRange(), adjacentClipId(), assignDisplayRows(), audibleDuration(), clipDuration() (+21 more)

### Community 3 - "ffmpeg-core.js"
Cohesion: 0.05
Nodes (22): doCallback(), done(), _emscripten_asm_const_int(), _emscripten_get_heap_max(), emscripten_realloc_buffer(), _emscripten_resize_heap(), _environ_get(), _environ_sizes_get() (+14 more)

### Community 4 - "server.js"
Cohesion: 0.07
Nodes (43): AUDIOMACK_HOSTS, canonicalYouTubeUrl(), INSTAGRAM_HOSTS, MIXCLOUD_HOSTS, SOUNDCLOUD_HOSTS, TIKTOK_HOSTS, TWITTER_HOSTS, validateMediaUrl() (+35 more)

### Community 5 - "TunebadApp"
Cohesion: 0.06
Nodes (24): metadata, metadata, metadata, metadata, metadata, metadata, metadata, metadata (+16 more)

### Community 6 - "layout.tsx"
Cohesion: 0.24
Nodes (12): PdfSplitTool(), Status, extractPages(), imagesToPdf(), isEncryptedError(), isPng(), loadPdfLib(), mergePdfs() (+4 more)

### Community 7 - "rate-limit.ts"
Cohesion: 0.20
Nodes (11): generateMetadata(), generateMetadata(), MinimalFooter(), ALL_CODES, camelotHubMeta(), CamelotHubPage(), CODE_TO_KEY, parseCode() (+3 more)

### Community 8 - "dependencies"
Cohesion: 0.05
Nodes (40): dependencies, essentia.js, fflate, @ffmpeg/core, @ffmpeg/ffmpeg, ffmpeg-static, heic-to, next (+32 more)

### Community 9 - "lufs.ts"
Cohesion: 0.09
Nodes (18): Home(), metadata, FILE_TOOLS, ToolsHub(), FAQ_JSON_LD, FAQ_KEYS, LandingSeo(), TOUR_KEYS (+10 more)

### Community 10 - "VideoTool.tsx"
Cohesion: 0.11
Nodes (23): POST(), resultSchema, POST(), reportSchema, GET(), GET(), GET(), querySchema (+15 more)

### Community 11 - "link-analysis.ts"
Cohesion: 0.09
Nodes (17): metadata, metadata, metadata, metadata, metadata, metadata, metadata, metadata (+9 more)

### Community 12 - "AnalyzerPanel.tsx"
Cohesion: 0.09
Nodes (36): AbMode, AudioMasteringTool(), barsFromChannels(), differenceCurve(), GENRE_LABELS, GENRE_ORDER, GENRE_PRESETS, GenreKey (+28 more)

### Community 13 - "AudioMasteringTool.tsx"
Cohesion: 0.10
Nodes (30): AnalyzerState, AnalyzeStage, useAnalyzer(), PlaylistCachedRow, PlaylistRow, rowsFromTracks(), RowStatus, usePlaylistAnalyzer() (+22 more)

### Community 14 - "CutterPanel.tsx"
Cohesion: 0.14
Nodes (23): metadata, ImageDimensionError, ImageFormatPicker(), ImageTool(), ImageToolMode, ResultRow, SizePreset, Status (+15 more)

### Community 15 - "ToolPageShell.tsx"
Cohesion: 0.12
Nodes (22): GET(), PlaylistLookupTrack, querySchema, runPool(), sleep(), SourceTrack, POST(), spotifyRequestSchema (+14 more)

### Community 16 - "backends.ts"
Cohesion: 0.23
Nodes (12): EXPORT_TARGETS, formatDb(), LoudnessPanel(), LoudnessWorkerResult, resampleTo48k(), toneFor(), clampBpm(), useMetronome() (+4 more)

### Community 17 - "AudioMasteringTool.tsx"
Cohesion: 0.19
Nodes (10): baloo2, geistMono, geistSans, metadata, STRUCTURED_DATA, viewport, ClientErrorReporter(), isReportable() (+2 more)

### Community 18 - "compilerOptions"
Cohesion: 0.10
Nodes (20): send_progress(), compilerOptions, allowJs, esModuleInterop, incremental, isolatedModules, jsx, lib (+12 more)

### Community 19 - "seed-songs.mjs"
Cohesion: 0.12
Nodes (16): foldBpm(), addTracks(), analyze(), CAMELOT, collectTracks(), COUNTRY_PLAYLISTS, __dirname, env (+8 more)

### Community 20 - "VideoTool.tsx"
Cohesion: 0.11
Nodes (23): AnalysisSummary(), MetricCardProps, FileMetaPill(), RecentRow, RecentStrip(), ResultsTable(), STAGE_ROW_LABELS, SimilarSong (+15 more)

### Community 21 - "fs"
Cohesion: 0.11
Nodes (18): bigintToI53Checked(), doReadv(), doWritev(), _fd_close(), _fd_fdstat_get(), _fd_read(), _fd_seek(), _fd_write() (+10 more)

### Community 23 - "VideoTool.tsx"
Cohesion: 0.17
Nodes (23): clamp(), computeResponseDb(), curveDbAt(), curvePath(), dbOf(), EqNodeDef, EqNodeId, Geometry (+15 more)

### Community 24 - "page.tsx"
Cohesion: 0.13
Nodes (9): CamelotWheelSvg(), metadata, polar(), WHEEL, metadata, metadata, metadata, metadata (+1 more)

### Community 25 - "useAnalyzer.ts"
Cohesion: 0.11
Nodes (14): metadata, metadata, metadata, metadata, FAQS, metadata, PlaylistAnalyzerPage(), FAQS (+6 more)

### Community 26 - "getWasmTableEntry"
Cohesion: 0.12
Nodes (16): getWasmTableEntry(), invoke_i(), invoke_ii(), invoke_iii(), invoke_iiii(), invoke_iiiii(), invoke_iiiiii(), invoke_iiiiiiiii() (+8 more)

### Community 27 - "getSocketFromFD"
Cohesion: 0.14
Nodes (19): alignMemory(), _getaddrinfo(), getSocketAddress(), getSocketFromFD(), inetPton4(), inetPton6(), jstoi_q(), mmapAlloc() (+11 more)

### Community 28 - "CutterPanel.tsx"
Cohesion: 0.15
Nodes (28): ArchiveFormat, entryFileName(), Status, Tab, ZipTool(), buildHeader(), computeChecksum(), createTarGz() (+20 more)

### Community 30 - "intArrayFromString"
Cohesion: 0.18
Nodes (12): _getnameinfo(), inetNtop4(), inetNtop6(), intArrayFromString(), LazyUint8Array(), lengthBytesUTF8(), readSockaddr(), stringToNewUTF8() (+4 more)

### Community 31 - "ReverbEq.tsx"
Cohesion: 0.11
Nodes (32): DropZone(), WaveformPreview(), ConverterView(), LocalFileConverter(), Status, PlaylistBatch(), FormatPicker(), FORMATS (+24 more)

### Community 32 - "AnalysisResult"
Cohesion: 0.15
Nodes (21): POST(), globalStore, runningJobCount(), sweepJobs(), YT_BASE_DIR, YtJob, allowJobStart(), AUDIO_QUALITIES (+13 more)

### Community 33 - "_strftime"
Cohesion: 0.15
Nodes (13): addDays(), arraySum(), ___assert_fail(), __gmtime_js(), isLeapYear(), __localtime_js(), __mktime_js(), readI53FromI64() (+5 more)

### Community 35 - "asyncLoad"
Cohesion: 0.20
Nodes (12): addRunDependency(), assert(), asyncLoad(), createWasm(), FS_createPreloadedFile(), getUniqueRunDependency(), handleMessage(), instantiateAsync() (+4 more)

### Community 36 - "abort"
Cohesion: 0.20
Nodes (11): abort(), _dlopen(), ___dlsym(), getBinary(), getBinaryPromise(), getValue(), initRandomFill(), instantiateArrayBuffer() (+3 more)

### Community 37 - "audio-joiner.ts"
Cohesion: 0.13
Nodes (29): bufferKey(), bufferMap, decodedBytes(), DEFAULT_PARAMS, EFFECT_OPTIONS, makeClipId(), REVERB_TYPE_OPTIONS, StudioPanel() (+21 more)

### Community 38 - "manifest.json"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, scope, short_name, start_url (+1 more)

### Community 39 - "page.tsx"
Cohesion: 0.15
Nodes (12): BpmToolsView(), PitchConverter(), REFERENCES, BASE_SVG_PROPS, GaugeIcon(), HistoryIcon(), IconProps, MetronomeIcon() (+4 more)

### Community 40 - "setup-ytdlp.mjs"
Cohesion: 0.22
Nodes (7): actual, binDir, check, expected, line, projectRoot, target

### Community 41 - "lufs.ts"
Cohesion: 0.14
Nodes (16): metadata, KNOWN_HREFS, LINKS, ToolPageNav(), CopyrightBody(), SECTIONS, LanguageMenu(), detectLocale() (+8 more)

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
Cohesion: 0.13
Nodes (29): CamelotWheel(), CODE_TO_KEY, point(), segmentPath(), SEGMENTS, shortKey(), ALL_CODES, CamelotWheelPage() (+21 more)

### Community 47 - "mp3-encoder.ts"
Cohesion: 0.18
Nodes (15): ClipCanvas(), EffectId, EFFECTS, cache, DisplaySignal, forgetDisplaySignals(), getDisplaySignal(), keyOf() (+7 more)

### Community 48 - "next.config.mjs"
Cohesion: 0.50
Nodes (3): csp, nextConfig, withBundleAnalyzer

### Community 53 - "lufs.ts"
Cohesion: 0.12
Nodes (25): AudioEffectResult, AudioEffectTool(), Status, AudioFormatPicker(), AudioOutputFormat, MP3_BITRATES, AudioJoinerTool(), nextId() (+17 more)

### Community 56 - "DelayCalculator.tsx"
Cohesion: 0.14
Nodes (19): MetronomeCard(), TapTempoCard(), DelayCalculator(), formatHz(), formatMs(), PRESET_NAME_KEYS, useTunebad(), EchoIcon() (+11 more)

### Community 57 - "route.ts"
Cohesion: 0.23
Nodes (13): countSongShards(), GET(), GET(), STATIC_ENTRIES, ToolEntry, countSongs(), readSongSlugRange(), escapeXml() (+5 more)

### Community 58 - "page.tsx"
Cohesion: 0.13
Nodes (19): AutomationMove, DistributiveOmit, EFFECT_OPTIONS, formatSemitones(), matchesPreset(), Preset, PRESETS, RemixStudio() (+11 more)

### Community 59 - "audio-joiner.ts"
Cohesion: 0.39
Nodes (6): ActivityBpmPage(), generateMetadata(), ACTIVITIES, Activity, findActivity(), readSongsByBpmRangeAll()

### Community 60 - "formatBytes"
Cohesion: 0.33
Nodes (9): GET(), idSchema, querySchema, searchSchema, resolveTrack(), cleanSongTitle(), findDeezerPreview(), findPreview() (+1 more)

### Community 61 - "delay.ts"
Cohesion: 0.14
Nodes (21): CachedRow, isSupportedTrackUrl(), LinkAnalyze(), LinkPreviewMeta, looksLikeUrl(), permalinkFor(), Phase, AUDIOMACK_HOSTS (+13 more)

### Community 62 - "page.tsx"
Cohesion: 0.23
Nodes (12): metadata, HeicTool(), ResultRow, Status, convertHeic(), HeicDecodeError, HeicOutputFormat, heicOutputName() (+4 more)

### Community 63 - "CamelotHubPage.tsx"
Cohesion: 0.18
Nodes (17): BassBoostParams, limitPeak(), renderBassBoost(), RenderedAudio, convertFileToMp3(), convertFileToWav(), decodeAndTrim(), encodeMp3FromChannels() (+9 more)

### Community 64 - "downloadBlob"
Cohesion: 0.13
Nodes (8): RemixTake, StudioTake, AutomationEvent, RemixParams, StudioEngine, StudioExportOptions, StoredArrangement, StudioClip

### Community 65 - "route.ts"
Cohesion: 0.22
Nodes (11): SimpleFilterInstance, timeStretch(), bytesOf(), cache, forgetStretched(), getStretchedBuffer(), pending, quantiseSpeed() (+3 more)

### Community 66 - "CutterPanel.tsx"
Cohesion: 0.23
Nodes (15): applyFades(), CutterPanel(), Status, clamp(), TrimWaveform(), ZOOM_LEVELS, ZoomLevel, TransportClock() (+7 more)

### Community 68 - "page.tsx"
Cohesion: 0.11
Nodes (18): metadata, metadata, metadata, AUDIO_FORMATS, MediaConvertTool(), MP3_BITRATES, Status, VIDEO_FORMATS (+10 more)

### Community 70 - "useFileDrop"
Cohesion: 0.08
Nodes (35): DANCE_T, decode(), FFMPEG, findPreview(), foldCurrent(), foldDanceAware(), foldNone(), foldWide() (+27 more)

### Community 71 - "page.tsx"
Cohesion: 0.38
Nodes (5): CURVE, DRIVES, magnitudeAt(), measure(), shape()

### Community 72 - "LandingSeo.tsx"
Cohesion: 0.22
Nodes (6): AnalyzerPanel(), HistoryPanel(), GlobalDropCatcher(), TunebadContextValue, VIEWS_ACCEPTING_HANDOFF, VIEWS_WITH_OWN_INTAKE

### Community 74 - "LandingSeo.tsx"
Cohesion: 0.21
Nodes (11): biquad(), blockPowers(), integratedLoudness(), kWeight(), loudnessFromPower(), PlatformTarget, samplePeakDb(), STAGE1 (+3 more)

### Community 75 - "page.tsx"
Cohesion: 0.19
Nodes (17): Image(), loadFont(), size, displayTitle(), generateMetadata(), metaTitle(), pct(), SongPage() (+9 more)

### Community 76 - "useHistory.ts"
Cohesion: 0.35
Nodes (9): ensureAnonSession(), entryFromRemoteRow(), entryFromResult(), readLocal(), RemoteRow, useHistory(), writeLocal(), getSupabase() (+1 more)

### Community 77 - "useUnloadGuard"
Cohesion: 0.33
Nodes (7): CAMELOT_ORDER, ErrorKey, exportPlaylistCsv(), Phase, PlaylistAnalyzer(), PlaylistTrackInput, useUnloadGuard()

### Community 78 - "youtube-playlist.ts"
Cohesion: 0.22
Nodes (13): decode(), detect(), FFMPEG, findPreview(), FLAT_TO_SHARP, getEssentia(), main(), PROFILES (+5 more)

### Community 79 - "usePlaylistBatch.ts"
Cohesion: 0.19
Nodes (16): CONTENT_TYPE_BY_FORMAT, contentDisposition(), GET(), GET(), Backend, backendForJob(), BackendPick, BackendTag (+8 more)

### Community 80 - "NightcoreTool.tsx"
Cohesion: 0.47
Nodes (4): NightcoreTool(), NightcoreParams, RenderedAudio, renderNightcore()

### Community 81 - "octave-map.mjs"
Cohesion: 0.33
Nodes (8): beatTrackerBpm(), getEssentia(), hit(), main(), makeTrack(), PATTERNS, RATE, ROOT

### Community 82 - "page.tsx"
Cohesion: 0.16
Nodes (19): BpmHubPage(), generateMetadata(), generateStaticParams(), parseBpm(), tempoContext(), countSongsByBpmRange(), countSongsByCamelotCode(), countWithFilter() (+11 more)

### Community 85 - "page.tsx"
Cohesion: 0.15
Nodes (16): metadata, metadata, metadata, Status, VideoTool(), compressedName(), CompressProgress, compressToTargetSize() (+8 more)

### Community 86 - "StudioClient.tsx"
Cohesion: 0.40
Nodes (3): metadata, StudioClient(), StudioPanel

## Knowledge Gaps
- **423 isolated node(s):** `metadata`, `resultSchema`, `reportSchema`, `querySchema`, `idSchema` (+418 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **10 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `RemixStudio()` connect `page.tsx` to `analysis.ts`, `route.ts`, `CutterPanel.tsx`, `TunebadApp`, `LandingSeo.tsx`, `AnalyzerPanel.tsx`, `useUnloadGuard`, `backends.ts`, `VideoTool.tsx`, `lufs.ts`, `VideoTool.tsx`, `DelayCalculator.tsx`, `ReverbEq.tsx`, `CamelotHubPage.tsx`?**
  _High betweenness centrality (0.276) - this node is a cross-community bridge._
- **Why does `base()` connect `page.tsx` to `ffmpeg-core.js`?**
  _High betweenness centrality (0.264) - this node is a cross-community bridge._
- **Why does `useI18n()` connect `ReverbEq.tsx` to `analysis.ts`, `route.ts`, `TunebadApp`, `layout.tsx`, `lufs.ts`, `link-analysis.ts`, `AnalyzerPanel.tsx`, `CutterPanel.tsx`, `backends.ts`, `VideoTool.tsx`, `VideoTool.tsx`, `useAnalyzer.ts`, `CutterPanel.tsx`, `audio-joiner.ts`, `page.tsx`, `lufs.ts`, `lufs.ts`, `DelayCalculator.tsx`, `page.tsx`, `delay.ts`, `page.tsx`, `CutterPanel.tsx`, `page.tsx`, `LandingSeo.tsx`, `useUnloadGuard`, `NightcoreTool.tsx`, `page.tsx`?**
  _High betweenness centrality (0.180) - this node is a cross-community bridge._
- **Are the 3 inferred relationships involving `StudioPanel()` (e.g. with `.start()` and `hit()`) actually correct?**
  _`StudioPanel()` has 3 INFERRED edges - model-reasoned connections that need verification._
- **What connects `metadata`, `resultSchema`, `reportSchema` to the rest of the system?**
  _426 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `analysis.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.08362369337979095 - nodes in this community are weakly interconnected._
- **Should `RemixStudio.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.14153846153846153 - nodes in this community are weakly interconnected._