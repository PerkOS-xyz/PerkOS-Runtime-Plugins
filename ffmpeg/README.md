# FFmpeg

PerkOS Runtime plugin for locally installed FFmpeg and ffprobe. Install both with
`brew install ffmpeg` on macOS or `sudo apt install ffmpeg` on Debian or Ubuntu.
Both executables must be on the Runtime's `PATH`. The probe checks both version
banners and reports the FFmpeg version to the Runtime. The probe output also
includes the ffprobe version.

The license policy is `installed-by-person`. The package contains command
templates and does not bundle or download FFmpeg. The installed build's license
depends on its configuration. See [FFmpeg licensing](https://ffmpeg.org/legal.html).

| Capability | Command | Arguments and behavior |
| --- | --- | --- |
| `video.probe` | `probe` | `input`. Prints container and stream metadata as JSON. |
| `video.trim` | `trim` | `input`, `start`, `duration`, `output`. Use seconds or FFmpeg time notation. |
| `video.scale` | `scale` | `input`, `width`, `height`, `output`. Supply positive integer dimensions in pixels. |
| `video.strip-audio` | `strip-audio` | `input`, `output`. Copies non-audio streams into a compatible container. |
| `video.concat` | `concat` | `list`, `output`. Supply an ffconcat list with safe relative paths to media with matching streams and codecs. Paths in the list are relative to the list file. |
| `video.captions` | `captions` | `input`, `captions`, `output`. Adds an SRT file as a selectable subtitle track in MP4. The source video and audio codecs must be MP4-compatible. |
| `video.gif` | `gif` | `input`, `output`. Creates a looping GIF at 10 fps with a generated palette. |

Pass local paths as raw placeholder values. The Runtime substitutes values
into individual arguments without using a shell, and the templates prefix
paths with `file:` so FFmpeg treats them as local filenames.

The plugin always sets `AV_LOG_FORCE_NOCOLOR=1` for plain-text diagnostics.
Every output command disables stdin interaction and refuses to overwrite an
existing output file.

See the [FFmpeg CLI](https://ffmpeg.org/ffmpeg.html), [ffprobe CLI](https://ffmpeg.org/ffprobe.html),
and [concat demuxer](https://ffmpeg.org/ffmpeg-formats.html#concat) documentation.
