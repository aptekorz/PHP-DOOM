import './style.css'

const API_URL = import.meta.env.VITE_API_URL || window.location.origin
const WAD_URL = '/wads/doom1.wad'
const WASM_URL = '/engine/doom.wasm'

let doom = null
let activeSessionUuid = null
let startedAt = null

document.querySelector('#app').innerHTML = `
  <main class="shell">
    <header class="topbar" id="menu-panel">
      <div>
        <h1>DOOM in Browser</h1>
        <p class="lede">Press Start Game. On phones, use the touch controls over the game.</p>
      </div>
      <div class="api-pill" id="api-status">API checking...</div>

      <section class="controls" aria-label="Game controls">
        <label>
          Nickname
          <input id="nickname" maxlength="40" autocomplete="nickname" placeholder="Doomguy" />
        </label>
        <button id="start-game" type="button">Start Game</button>
        <button id="fullscreen" type="button">Fullscreen</button>
        <button id="end-session" type="button" disabled>End Session</button>
      </section>

      <section class="messages" aria-live="polite">
        <p id="status">Ready. Press Start Game to load DOOM.</p>
        <p class="legal">WAD legality: this app does not include the commercial DOOM.WAD. Put a legal shareware <code>doom1.wad</code> in <code>/wads/doom1.wad</code>, or use your own legally obtained WAD.</p>
        <p class="keys">Desktop: arrows, Ctrl/fire, Space/use, Shift/run. Phone: use the on-screen controls.</p>
      </section>
    </header>

    <section class="game-wrap">
      <canvas id="doom-canvas" tabindex="0" aria-label="DOOM game canvas"></canvas>
      <div class="touch-controls" aria-label="Touch controls">
        <div class="dpad">
          <button class="touch-btn up" type="button" data-key="ArrowUp" aria-label="Forward">▲</button>
          <button class="touch-btn left" type="button" data-key="ArrowLeft" aria-label="Turn left">◀</button>
          <button class="touch-btn right" type="button" data-key="ArrowRight" aria-label="Turn right">▶</button>
          <button class="touch-btn down" type="button" data-key="ArrowDown" aria-label="Back">▼</button>
        </div>
        <div class="action-pad">
          <button class="touch-btn action fire" type="button" data-key="Control" aria-label="Fire">Fire</button>
          <button class="touch-btn action" type="button" data-key=" " aria-label="Use">Use</button>
          <button class="touch-btn action" type="button" data-key="Shift" aria-label="Run">Run</button>
          <button class="touch-btn action" type="button" data-key="Escape" aria-label="Menu">Menu</button>
        </div>
      </div>
      <button class="hud-fullscreen" id="hud-fullscreen" type="button" aria-label="Fullscreen">Fullscreen</button>
    </section>
  </main>
`

const els = {
  apiStatus: document.querySelector('#api-status'),
  canvas: document.querySelector('#doom-canvas'),
  endSession: document.querySelector('#end-session'),
  fullscreen: document.querySelector('#fullscreen'),
  gameWrap: document.querySelector('.game-wrap'),
  hudFullscreen: document.querySelector('#hud-fullscreen'),
  nickname: document.querySelector('#nickname'),
  shell: document.querySelector('.shell'),
  startGame: document.querySelector('#start-game'),
  status: document.querySelector('#status'),
  touchButtons: document.querySelectorAll('.touch-btn'),
}

function setStatus(message, isError = false) {
  els.status.textContent = message
  els.status.classList.toggle('error', isError)
}

async function api(path, options = {}) {
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      Accept: 'application/json',
      'Content-Type': 'application/json',
      ...(options.headers || {}),
    },
    ...options,
  })

  const body = await response.json().catch(() => null)

  if (!response.ok) {
    const message = body?.message || `API request failed with HTTP ${response.status}`
    throw new Error(message)
  }

  return body
}

async function checkHealth() {
  try {
    const health = await api('/api/health')
    els.apiStatus.textContent = `API ${health.status}`
    els.apiStatus.classList.add('ok')
  } catch (error) {
    els.apiStatus.textContent = 'API offline'
    els.apiStatus.classList.add('bad')
    setStatus(`Backend is not reachable: ${error.message}`, true)
  }
}

async function startApiSession() {
  const nickname = els.nickname.value.trim() || null
  const result = await api('/api/game-session/start', {
    method: 'POST',
    body: JSON.stringify({ nickname }),
  })

  activeSessionUuid = result.data.session_uuid
  startedAt = Date.now()
  els.endSession.disabled = false
}

async function endApiSession() {
  if (!activeSessionUuid) {
    return
  }

  const sessionUuid = activeSessionUuid
  activeSessionUuid = null
  els.endSession.disabled = true

  await api('/api/game-session/end', {
    method: 'POST',
    body: JSON.stringify({ session_uuid: sessionUuid }),
  })
}

async function loadWadIfPresent() {
  const response = await fetch(WAD_URL, { cache: 'no-store' })

  if (!response.ok) {
    return null
  }

  const bytes = new Uint8Array(await response.arrayBuffer())

  if (bytes.length === 0) {
    return null
  }

  const wadHeader = new TextDecoder('ascii').decode(bytes.slice(0, 4))
  if (!['IWAD', 'PWAD'].includes(wadHeader)) {
    return null
  }

  return bytes
}

async function startGame() {
  if (doom) {
    els.canvas.focus()
    await enterFullscreen()
    return
  }

  els.startGame.disabled = true
  els.shell.classList.add('playing')
  setStatus('Starting API session...')

  try {
    await enterFullscreen()
    await startApiSession()
    setStatus('Loading WAD and WebAssembly engine...')

    const wadBytes = await loadWadIfPresent()
    doom = await loadDoomGame(els.canvas, wadBytes)

    setStatus(wadBytes
      ? 'DOOM is running with /wads/doom1.wad. Click the canvas and play.'
      : 'DOOM is running with the built-in shareware WAD from the WebAssembly module. Add /wads/doom1.wad to override it.')
    els.canvas.focus()
  } catch (error) {
    els.startGame.disabled = false
    els.shell.classList.remove('playing')
    setStatus(`Could not start DOOM: ${error.message}`, true)
  }
}

async function enterFullscreen() {
  if (document.fullscreenElement || !els.gameWrap.requestFullscreen) {
    return
  }

  try {
    await els.gameWrap.requestFullscreen()
  } catch {
    // Mobile Safari may reject fullscreen; CSS still keeps the game full-window.
  }
}

async function loadDoomGame(canvas, wadBytes) {
  let moduleMemory = null
  let exports = null
  let frameImageData = null
  let animationTimer = null
  const context = canvas.getContext('2d', { alpha: false })

  const readString = (ptr, length) => {
    const bytes = new Uint8Array(moduleMemory.buffer, ptr, length)
    return new TextDecoder('utf-8', { fatal: false }).decode(bytes)
  }

  const imports = {
    loading: {
      onGameInit(width, height) {
        canvas.width = width
        canvas.height = height
        frameImageData = context.createImageData(width, height)
      },
      wadSizes(numberOfWadsPtr, totalBytesPtr) {
        if (!wadBytes) {
          return
        }

        const view = new DataView(moduleMemory.buffer)
        view.setInt32(numberOfWadsPtr, 1, true)
        view.setUint32(totalBytesPtr, wadBytes.byteLength, true)
      },
      readWads(wadDestinationPtr, wadLengthPtr) {
        if (!wadBytes) {
          return
        }

        new Uint8Array(moduleMemory.buffer, wadDestinationPtr, wadBytes.byteLength).set(wadBytes)
        new DataView(moduleMemory.buffer).setInt32(wadLengthPtr, wadBytes.byteLength, true)
      },
    },
    ui: {
      drawFrame(frameBufferPtr) {
        const frameBuffer = new Uint8Array(moduleMemory.buffer, frameBufferPtr, canvas.width * canvas.height * 4)

        for (let i = 0; i < frameImageData.data.length / 4; i += 1) {
          frameImageData.data[4 * i + 0] = frameBuffer[4 * i + 2]
          frameImageData.data[4 * i + 1] = frameBuffer[4 * i + 1]
          frameImageData.data[4 * i + 2] = frameBuffer[4 * i + 0]
          frameImageData.data[4 * i + 3] = 255
        }

        context.putImageData(frameImageData, 0, 0)
      },
    },
    runtimeControl: {
      timeInMilliseconds: () => BigInt(Math.trunc(performance.now())),
    },
    console: {
      onInfoMessage: (ptr, length) => console.info(`[DOOM] ${readString(ptr, length)}`),
      onErrorMessage: (ptr, length) => console.error(`[DOOM] ${readString(ptr, length)}`),
    },
    gameSaving: {
      sizeOfSaveGame: () => 0,
      readSaveGame: () => 0,
      writeSaveGame: () => 0,
    },
  }

  const wasmResponse = await fetch(WASM_URL)
  if (!wasmResponse.ok) {
    throw new Error(`Missing WebAssembly engine at ${WASM_URL}`)
  }

  const wasmBytes = await wasmResponse.arrayBuffer()
  const { instance } = await WebAssembly.instantiate(wasmBytes, imports)

  exports = instance.exports
  moduleMemory = exports.memory

  const keyMap = new Map([
    ['ArrowLeft', exports.KEY_LEFTARROW],
    ['ArrowRight', exports.KEY_RIGHTARROW],
    ['ArrowUp', exports.KEY_UPARROW],
    ['ArrowDown', exports.KEY_DOWNARROW],
    [',', exports.KEY_STRAFE_L],
    ['.', exports.KEY_STRAFE_R],
    ['Control', exports.KEY_FIRE],
    [' ', exports.KEY_USE],
    ['Shift', exports.KEY_SHIFT],
    ['Tab', exports.KEY_TAB],
    ['Escape', exports.KEY_ESCAPE],
    ['Enter', exports.KEY_ENTER],
    ['Backspace', exports.KEY_BACKSPACE],
    ['Alt', exports.KEY_ALT],
  ])

  const keyValue = (key) => {
    const value = keyMap.get(key)
    if (value !== undefined) {
      return typeof value === 'object' && 'value' in value ? value.value : value
    }

    return key.length === 1 ? key.toLowerCase().charCodeAt(0) : null
  }

  const keyDown = (event) => {
    const doomKey = keyValue(event.key)
    if (doomKey === null) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    exports.reportKeyDown(doomKey)
  }

  const keyUp = (event) => {
    const doomKey = keyValue(event.key)
    if (doomKey === null) {
      return
    }

    event.preventDefault()
    event.stopPropagation()
    exports.reportKeyUp(doomKey)
  }

  const fireKey = () => keyValue('Control')

  canvas.addEventListener('keydown', keyDown)
  canvas.addEventListener('keyup', keyUp)
  canvas.addEventListener('mousedown', () => {
    canvas.focus()
    canvas.requestPointerLock?.()
    exports.reportKeyDown(fireKey())
  })
  window.addEventListener('mouseup', () => exports.reportKeyUp(fireKey()))

  exports.initGame()
  animationTimer = window.setInterval(exports.tickGame, 1000 / 35)

  return {
    pressKey(key) {
      const doomKey = keyValue(key)
      if (doomKey !== null) {
        exports.reportKeyDown(doomKey)
      }
    },
    releaseKey(key) {
      const doomKey = keyValue(key)
      if (doomKey !== null) {
        exports.reportKeyUp(doomKey)
      }
    },
    stop() {
      window.clearInterval(animationTimer)
      canvas.removeEventListener('keydown', keyDown)
      canvas.removeEventListener('keyup', keyUp)
    },
  }
}

function escapeHtml(value) {
  return String(value)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;')
}

els.startGame.addEventListener('click', startGame)
els.endSession.addEventListener('click', async () => {
  try {
    await endApiSession()
    setStatus('Game session ended.')
  } catch (error) {
    setStatus(`Could not end session: ${error.message}`, true)
  }
})

els.fullscreen.addEventListener('click', async () => {
  await enterFullscreen()
  els.canvas.focus()
})

els.hudFullscreen.addEventListener('click', async () => {
  await enterFullscreen()
  els.canvas.focus()
})

els.touchButtons.forEach((button) => {
  const key = button.dataset.key

  const press = (event) => {
    event.preventDefault()
    els.canvas.focus()
    doom?.pressKey(key)
  }

  const release = (event) => {
    event.preventDefault()
    doom?.releaseKey(key)
  }

  button.addEventListener('pointerdown', press)
  button.addEventListener('pointerup', release)
  button.addEventListener('pointercancel', release)
  button.addEventListener('pointerleave', release)
})

window.addEventListener('beforeunload', () => {
  if (!activeSessionUuid) {
    return
  }

  const payload = JSON.stringify({ session_uuid: activeSessionUuid })
  navigator.sendBeacon?.(`${API_URL}/api/game-session/end`, new Blob([payload], { type: 'application/json' }))
})

checkHealth()
