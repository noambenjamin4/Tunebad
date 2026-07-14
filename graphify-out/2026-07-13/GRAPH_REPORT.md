# Graph Report - Tunebad  (2026-07-13)

## Corpus Check
- 214 files · ~236,183 words
- Verdict: corpus is large enough that graph structure adds value.

## Summary
- 1326 nodes · 3071 edges · 69 communities (62 shown, 7 thin omitted)
- Extraction: 100% EXTRACTED · 0% INFERRED · 0% AMBIGUOUS · INFERRED: 5 edges (avg confidence: 0.5)
- Token cost: 0 input · 0 output

## Graph Freshness
- Built from commit: `00f09b73`
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
- delay.ts
- asyncLoad
- abort
- audio-joiner.ts
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
- useHistory.ts
- analysis.ts
- LandingSeo.tsx
- usePlaylistBatch.ts
- audio-joiner.ts
- lufs.ts
- BassBoosterTool.tsx
- spotify-playlist.ts
- youtube-playlist.ts
- media-url.ts

## God Nodes (most connected - your core abstractions)
1. `useI18n()` - 117 edges
2. `downloadBlob()` - 29 edges
3. `RelatedTools()` - 27 edges
4. `ToolPageShell()` - 26 edges
5. `formatBytes()` - 22 edges
6. `AudioMasteringTool()` - 19 edges
7. `RemixStudio()` - 19 edges
8. `DictKey` - 19 edges
9. `readAllSongs()` - 19 edges
10. `fs` - 19 edges

## Surprising Connections (you probably didn't know these)
- `generateStaticParams()` --calls--> `readAllSongs()`  [EXTRACTED]
  app/song/[slug]/page.tsx → lib/server/link-analysis.ts
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

## Communities (69 total, 7 thin omitted)

### Community 0 - "analysis.ts"
Cohesion: 0.23
Nodes (11): biquad(), blockPowers(), integratedLoudness(), kWeight(), loudnessFromPower(), PlatformTarget, samplePeakDb(), STAGE1 (+3 more)

### Community 1 - "RemixStudio.tsx"
Cohesion: 0.05
Nodes (59): BassBoosterTool(), EightDTool(), formatSemitones(), matchesPreset(), Preset, PRESETS, RemixStudio(), REVERB_TYPE_OPTIONS (+51 more)

### Community 2 - "ytdlp.ts"
Cohesion: 0.13
Nodes (15): AnalyzerPanel(), Footer(), TOOL_LINKS, HISTORY_TAB, NavTabs(), TABS, GlobalDropCatcher(), TunebadContext (+7 more)

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
Cohesion: 0.29
Nodes (11): GET(), GET(), STATIC_ENTRIES, ToolEntry, readAllSongs(), escapeXml(), SitemapEntry, sitemapIndexXml() (+3 more)

### Community 7 - "TunebadApp.tsx"
Cohesion: 0.16
Nodes (19): MetronomeCard(), TapTempoCard(), DelayCalculator(), formatHz(), formatMs(), PRESET_NAME_KEYS, HistoryPanel(), useTunebad() (+11 more)

### Community 8 - "dependencies"
Cohesion: 0.05
Nodes (36): dependencies, essentia.js, fflate, @ffmpeg/core, @ffmpeg/ffmpeg, ffmpeg-static, heic-to, next (+28 more)

### Community 9 - "useI18n"
Cohesion: 0.21
Nodes (14): GET(), idSchema, querySchema, searchSchema, resolveTrack(), Home(), cleanSongTitle(), countSongs() (+6 more)

### Community 10 - "VideoTool.tsx"
Cohesion: 0.14
Nodes (16): metadata, KNOWN_HREFS, LINKS, ToolPageNav(), CopyrightBody(), SECTIONS, LanguageMenu(), detectLocale() (+8 more)

### Community 11 - "link-analysis.ts"
Cohesion: 0.36
Nodes (6): WaveformPreview(), TopBar(), activeSources, isAnyAudioPlaying(), NowPlayingDetail, setNowPlaying()

### Community 12 - "AnalyzerPanel.tsx"
Cohesion: 0.13
Nodes (18): CONTENT_TYPE_BY_FORMAT, contentDisposition(), GET(), GET(), IMPORTANT: this module reads server-only secrets and must never be, Backend, backendForJob(), BackendTag (+10 more)

### Community 13 - "ToolFaq.tsx"
Cohesion: 0.08
Nodes (50): FileDrop(), HeicTool(), ResultRow, Status, ImageDimensionError, ImageFormatPicker(), ImageTool(), ImageToolMode (+42 more)

### Community 14 - "page.tsx"
Cohesion: 0.08
Nodes (36): FAQS, metadata, CAMELOT_ORDER, ErrorKey, exportPlaylistCsv(), Phase, PlaylistAnalyzer(), AnalyzerState (+28 more)

### Community 15 - "ToolPageShell.tsx"
Cohesion: 0.08
Nodes (17): metadata, metadata, metadata, metadata, metadata, metadata, metadata, metadata (+9 more)

### Community 16 - "backends.ts"
Cohesion: 0.15
Nodes (28): ArchiveFormat, entryFileName(), Status, Tab, ZipTool(), buildHeader(), computeChecksum(), createTarGz() (+20 more)

### Community 17 - "media-url.ts"
Cohesion: 0.11
Nodes (9): metadata, metadata, metadata, metadata, metadata, metadata, metadata, FaqEntry (+1 more)

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
Cohesion: 0.14
Nodes (18): POST(), resultSchema, GET(), GET(), GET(), querySchema, isAllowedPreviewUrl(), readRecentAnalyses() (+10 more)

### Community 23 - "VideoTool.tsx"
Cohesion: 0.17
Nodes (24): CamelotWheel(), CODE_TO_KEY, point(), segmentPath(), SEGMENTS, shortKey(), ALL_CODES, CamelotWheelPage() (+16 more)

### Community 24 - "page.tsx"
Cohesion: 0.13
Nodes (9): CamelotWheelSvg(), metadata, polar(), WHEEL, metadata, metadata, metadata, metadata (+1 more)

### Community 25 - "icons.tsx"
Cohesion: 0.13
Nodes (12): FAQ_JSON_LD, FAQ_KEYS, TOUR_KEYS, VALUE_KEYS, de, en, es, fr (+4 more)

### Community 26 - "getWasmTableEntry"
Cohesion: 0.12
Nodes (16): getWasmTableEntry(), invoke_i(), invoke_ii(), invoke_iii(), invoke_iiii(), invoke_iiiii(), invoke_iiiiii(), invoke_iiiiiiiii() (+8 more)

### Community 27 - "getSocketFromFD"
Cohesion: 0.17
Nodes (16): _getaddrinfo(), getSocketAddress(), getSocketFromFD(), inetPton4(), inetPton6(), jstoi_q(), ___syscall_accept4(), ___syscall_bind() (+8 more)

### Community 28 - "CutterPanel.tsx"
Cohesion: 0.15
Nodes (21): GET(), querySchema, Image(), loadFont(), size, displayTitle(), generateMetadata(), generateStaticParams() (+13 more)

### Community 30 - "intArrayFromString"
Cohesion: 0.18
Nodes (12): _getnameinfo(), inetNtop4(), inetNtop6(), intArrayFromString(), LazyUint8Array(), lengthBytesUTF8(), readSockaddr(), stringToNewUTF8() (+4 more)

### Community 31 - "ReverbEq.tsx"
Cohesion: 0.13
Nodes (29): BpmToolsView(), ConverterView(), LocalFileConverter(), Status, PlaylistBatch(), FormatPicker(), FORMATS, OutputFormat (+21 more)

### Community 32 - "AnalysisResult"
Cohesion: 0.18
Nodes (15): metadata, metadata, Status, VideoTool(), compressedName(), CompressProgress, compressToTargetSize(), FFmpegLike (+7 more)

### Community 33 - "_strftime"
Cohesion: 0.15
Nodes (13): addDays(), arraySum(), ___assert_fail(), __gmtime_js(), isLeapYear(), __localtime_js(), __mktime_js(), readI53FromI64() (+5 more)

### Community 34 - "delay.ts"
Cohesion: 0.43
Nodes (5): ActivityBpmPage(), generateMetadata(), ACTIVITIES, Activity, findActivity()

### Community 35 - "asyncLoad"
Cohesion: 0.20
Nodes (12): addRunDependency(), assert(), asyncLoad(), createWasm(), FS_createPreloadedFile(), getUniqueRunDependency(), handleMessage(), instantiateAsync() (+4 more)

### Community 36 - "abort"
Cohesion: 0.20
Nodes (11): abort(), _dlopen(), ___dlsym(), getBinary(), getBinaryPromise(), getValue(), initRandomFill(), instantiateArrayBuffer() (+3 more)

### Community 37 - "audio-joiner.ts"
Cohesion: 0.17
Nodes (13): AudioFormatPicker(), AudioOutputFormat, MP3_BITRATES, nextId(), QueuedFile, Status, Transition, TRANSITION_LABELS (+5 more)

### Community 38 - "manifest.json"
Cohesion: 0.20
Nodes (9): background_color, description, display, icons, name, scope, short_name, start_url (+1 more)

### Community 39 - "page.tsx"
Cohesion: 0.10
Nodes (32): AbMode, AudioMasteringTool(), barsFromChannels(), differenceCurve(), GENRE_LABELS, GENRE_ORDER, GENRE_PRESETS, GenreKey (+24 more)

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
Cohesion: 0.15
Nodes (13): ALL_CODES, CamelotHubPage(), CODE_TO_KEY, generateMetadata(), parseCode(), metadata, SongBrowser(), SongRow (+5 more)

### Community 56 - "LandingSeo.tsx"
Cohesion: 0.31
Nodes (11): artistMetaTitle(), ArtistPage(), generateMetadata(), generateStaticParams(), SongsPage(), ArtistGroup, artistSlug(), artistStats() (+3 more)

### Community 57 - "useHistory.ts"
Cohesion: 0.24
Nodes (12): EXPORT_TARGETS, formatDb(), LoudnessPanel(), LoudnessWorkerResult, resampleTo48k(), toneFor(), clampBpm(), useMetronome() (+4 more)

### Community 58 - "page.tsx"
Cohesion: 0.48
Nodes (6): BpmHubPage(), generateMetadata(), generateStaticParams(), parseBpm(), tempoContext(), readSongsByBpmRange()

### Community 59 - "useHistory.ts"
Cohesion: 0.15
Nodes (13): PitchConverter(), REFERENCES, BASE_SVG_PROPS, EchoIcon(), GaugeIcon(), HistoryIcon(), IconProps, MetronomeIcon() (+5 more)

### Community 60 - "analysis.ts"
Cohesion: 0.36
Nodes (9): applyFades(), CutterPanel(), Status, clamp(), TrimWaveform(), fadeEnvelopeGain(), fadeRampSeconds(), computeWaveformBars() (+1 more)

### Community 61 - "LandingSeo.tsx"
Cohesion: 0.19
Nodes (18): POST(), globalStore, runningJobCount(), sweepJobs(), YT_BASE_DIR, YtJob, allowJobStart(), classifyError() (+10 more)

### Community 62 - "usePlaylistBatch.ts"
Cohesion: 0.10
Nodes (22): AnalysisSummary(), MetricCardProps, DropZone(), FileMetaPill(), RecentRow, RecentStrip(), ResultsTable(), SimilarSong (+14 more)

### Community 63 - "audio-joiner.ts"
Cohesion: 0.14
Nodes (22): GET(), PlaylistLookupTrack, querySchema, runPool(), sleep(), SourceTrack, POST(), spotifyRequestSchema (+14 more)

### Community 64 - "lufs.ts"
Cohesion: 0.25
Nodes (15): AudioEffectResult, AudioEffectTool(), Status, AudioJoinerTool(), decodeAudioFile(), convertFileToMp3(), convertFileToWav(), decodeAndTrim() (+7 more)

### Community 65 - "BassBoosterTool.tsx"
Cohesion: 0.40
Nodes (3): metadata, FILE_TOOLS, ToolsHub()

### Community 66 - "spotify-playlist.ts"
Cohesion: 0.47
Nodes (4): NightcoreTool(), NightcoreParams, RenderedAudio, renderNightcore()

### Community 71 - "media-url.ts"
Cohesion: 0.15
Nodes (20): CachedRow, isSupportedTrackUrl(), LinkAnalyze(), LinkPreviewMeta, looksLikeUrl(), permalinkFor(), Phase, AUDIOMACK_HOSTS (+12 more)

## Knowledge Gaps
- **366 isolated node(s):** `metadata`, `resultSchema`, `querySchema`, `idSchema`, `searchSchema` (+361 more)
  These have ≤1 connection - possible missing edges or undocumented components.
- **7 thin communities (<3 nodes) omitted from report** — run `graphify query` to explore isolated nodes.

## Suggested Questions
_Questions this graph is uniquely positioned to answer:_

- **Why does `useI18n()` connect `ReverbEq.tsx` to `RemixStudio.tsx`, `ytdlp.ts`, `TunebadApp.tsx`, `VideoTool.tsx`, `link-analysis.ts`, `ToolFaq.tsx`, `page.tsx`, `ToolPageShell.tsx`, `backends.ts`, `media-url.ts`, `VideoTool.tsx`, `icons.tsx`, `AnalysisResult`, `audio-joiner.ts`, `page.tsx`, `useHistory.ts`, `useHistory.ts`, `analysis.ts`, `usePlaylistBatch.ts`, `lufs.ts`, `BassBoosterTool.tsx`, `spotify-playlist.ts`, `media-url.ts`?**
  _High betweenness centrality (0.140) - this node is a cross-community bridge._
- **Why does `validateSpotifyUrl()` connect `media-url.ts` to `useI18n`, `ReverbEq.tsx`, `audio-joiner.ts`?**
  _High betweenness centrality (0.017) - this node is a cross-community bridge._
- **Why does `validateMediaUrl()` connect `media-url.ts` to `useI18n`, `AnalyzerPanel.tsx`, `LandingSeo.tsx`, `ReverbEq.tsx`?**
  _High betweenness centrality (0.016) - this node is a cross-community bridge._
- **What connects `metadata`, `resultSchema`, `querySchema` to the rest of the system?**
  _368 weakly-connected nodes found - possible documentation gaps or missing edges._
- **Should `RemixStudio.tsx` be split into smaller, more focused modules?**
  _Cohesion score 0.05456095481670929 - nodes in this community are weakly interconnected._
- **Should `ytdlp.ts` be split into smaller, more focused modules?**
  _Cohesion score 0.12535612535612536 - nodes in this community are weakly interconnected._
- **Should `ffmpeg-core.js` be split into smaller, more focused modules?**
  _Cohesion score 0.054078014184397165 - nodes in this community are weakly interconnected._