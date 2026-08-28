import { execFile } from 'node:child_process'
import { promisify } from 'node:util'

const run = promisify(execFile)

export async function probe(file) {
  const { stdout } = await run('ffprobe', [
    '-v', 'error',
    '-show_entries', 'format=duration,bit_rate,size',
    '-show_entries', 'stream=codec_type,codec_name,width,height,bit_rate',
    '-of', 'json',
    file,
  ], { maxBuffer: 1 << 24 })

  const data = JSON.parse(stdout)
  const video = data.streams.find((s) => s.codec_type === 'video')
  const audio = data.streams.find((s) => s.codec_type === 'audio')

  return {
    duration: Number(data.format.duration) || 0,
    bytes: Number(data.format.size) || 0,
    bitrate: Number(video?.bit_rate ?? data.format.bit_rate) || 0,
    width: video ? Number(video.width) : null,
    height: video ? Number(video.height) : null,
    hasVideo: Boolean(video),
    hasAudio: Boolean(audio),
    videoCodec: video?.codec_name ?? null,
  }
}

export async function ffmpeg(args) {
  await run('ffmpeg', ['-hide_banner', '-loglevel', 'error', '-y', ...args], { maxBuffer: 1 << 24 })
}
