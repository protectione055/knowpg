export function drawElephant(canvas) {
  const ctx = canvas.getContext('2d')

  function fill(points, color) {
    ctx.fillStyle = color
    ctx.beginPath()
    ctx.moveTo(...points[0])
    for (const point of points.slice(1))
      ctx.lineTo(...point)
    ctx.closePath()
    ctx.fill()
  }

  fill([
    [1, 12], [3, 12], [3, 10], [5, 10], [5, 8], [8, 8], [8, 6], [17, 6],
    [17, 5], [23, 5], [23, 7], [26, 7], [26, 9], [28, 9], [28, 15],
    [30, 15], [30, 12], [32, 12], [32, 17], [31, 17], [31, 19], [27, 19],
    [27, 18], [25, 18], [25, 15], [22, 15], [22, 21], [18, 21], [18, 18],
    [12, 18], [12, 21], [8, 21], [8, 18], [5, 18], [5, 14], [1, 14],
  ], '#91c0df')
  fill([
    [16, 8], [21, 8], [21, 10], [22, 10], [22, 14], [20, 14], [20, 16],
    [16, 16], [16, 14], [15, 14], [15, 10], [16, 10],
  ], '#5485ae')
  ctx.fillStyle = '#173c5b'
  ctx.fillRect(24, 9, 2, 2)
}
