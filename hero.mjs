export function drawHero(canvas) {
  const { width, height } = canvas.getBoundingClientRect()
  if (!width || !height)
    return

  const dpr = window.devicePixelRatio || 1
  canvas.width = Math.round(width * dpr)
  canvas.height = Math.round(height * dpr)
  const ctx = canvas.getContext('2d')
  const scale = Math.min(width / 470, height / 365) * dpr
  ctx.setTransform(scale, 0, 0, scale, (canvas.width - 470 * scale) / 2, (canvas.height - 365 * scale) / 2)

  function shape(points, stroke, fill, lineWidth = 1) {
    ctx.beginPath()
    points.forEach(([x, y], index) => index ? ctx.lineTo(x, y) : ctx.moveTo(x, y))
    if (fill) {
      ctx.closePath()
      ctx.fillStyle = fill
      ctx.fill()
    }
    if (stroke) {
      ctx.strokeStyle = stroke
      ctx.lineWidth = lineWidth
      ctx.stroke()
    }
  }

  function dot(x, y, radius, color) {
    ctx.beginPath()
    ctx.arc(x, y, radius, 0, Math.PI * 2)
    ctx.fillStyle = color
    ctx.fill()
  }

  const ink = '#a43e2a'
  const muted = '#d1937e'
  ctx.lineJoin = 'round'
  const project = (x, y, z = 0) => [235 + (x - y) * .84, 220 + (x + y) * .42 - z]

  ctx.globalAlpha = .55
  for (let x = -120; x <= 120; x += 24) {
    shape([project(x, -120), project(x, 120)], '#dbac99')
    shape([project(-120, x), project(120, x)], '#dbac99')
  }
  ctx.globalAlpha = 1

  const traces = [
    [[-76, -109], [-76, -58], [-48, -58]],
    [[-109, 22], [-67, 22], [-67, 37], [-48, 37]],
    [[32, 120], [32, 72], [16, 72], [16, 48]],
    [[113, 42], [78, 42], [78, 15], [48, 15]],
    [[85, -99], [85, -65], [21, -65], [21, -48]],
    [[-91, 91], [-61, 91], [-61, 66], [-35, 66], [-35, 48]],
  ]

  for (const trace of traces) {
    shape(trace.map(([x, y]) => project(x, y)), muted, null, 1.25)
    const [x, y] = project(...trace[0])
    dot(x, y, 4, muted)
    dot(x, y, 2, '#f9eee6')
  }

  const top = (z, r) => [project(-r, -r, z), project(r, -r, z), project(r, r, z), project(-r, r, z)]
  const plates = [
    { z: 26, r: 81, a: '#f1c3b0', b: '#e4a08a', c: '#f8dccd' },
    { z: 61, r: 74, a: '#e99e86', b: '#d87960', c: '#f5c5b3' },
    { z: 96, r: 67, a: '#d87f63', b: '#bb543b', c: '#f2ad96' },
    { z: 132, r: 60, a: '#da7a5e', b: '#b54831', c: '#f0a589' },
  ]
  for (const { z, r, a, b, c } of plates) {
    const corners = top(z, r)
    const base = top(z - 16, r)
    shape([corners[3], corners[2], base[2], base[3]], ink, a)
    shape([corners[1], corners[2], base[2], base[1]], ink, b)
    shape(corners, ink, c)
    for (const offset of [-30, -18, -6, 6])
      shape([project(offset, r, z - 5), project(offset, r, z - 11)], '#f9d5c4', null, 1.75)
  }

  const accent = '#81311f'
  const inner = top(133, 39)
  shape([...inner, inner[0]], accent, '#f6bba3')
  for (const offset of [-24, -12, 0, 12, 24]) {
    shape([project(offset, -39, 133), project(offset, -51, 133)], accent)
    shape([project(-39, offset, 133), project(-51, offset, 133)], accent)
    shape([project(39, offset, 133), project(51, offset, 133)], accent)
    shape([project(offset, 39, 133), project(offset, 51, 133)], accent)
  }
  shape(top(134, 19), accent, '#a7402a')
  shape(top(135, 9), '#ef9b81', '#d67559')
  for (const [x, y] of [[-30, -30], [30, -30], [30, 30], [-30, 30]])
    dot(...project(x, y, 134), 1.8, accent)

  ctx.setLineDash([3, 5])
  shape([[53, 112], [84, 112], [114, 140]], muted)
  shape([[358, 118], [390, 90], [425, 90]], muted)
  shape([[338, 290], [374, 316], [409, 316]], muted)
  ctx.setLineDash([])
  for (const [x, y] of [[53, 112], [425, 90], [409, 316]]) {
    shape([[x - 4, y], [x + 4, y]], ink)
    shape([[x, y - 4], [x, y + 4]], ink)
  }
}
