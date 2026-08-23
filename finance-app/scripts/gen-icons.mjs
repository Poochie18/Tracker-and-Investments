// Одноразовий скрипт: генерує PWA-іконки (icon-192.png, icon-512.png,
// icon-512-maskable.png) на фоні theme_color. Запускати вручну: node scripts/gen-icons.mjs
//
// Використовуємо лише базову форму логотипу (плоска блискавка) без
// декоративних mask/filter шарів з favicon.svg — повний favicon.svg рендериться
// з артефактами (librsvg не до кінця підтримує його mask+feGaussianBlur групи).
import { fileURLToPath } from 'node:url'
import path from 'node:path'
import sharp from 'sharp'

const __dirname = path.dirname(fileURLToPath(import.meta.url))
const publicDir = path.join(__dirname, '..', 'public')
const iconsDir = path.join(publicDir, 'icons')

// Той самий контур, що й основна фігура в favicon.svg, але без mask/blur.
const LOGO_SVG = Buffer.from(`
<svg xmlns="http://www.w3.org/2000/svg" width="48" height="46" viewBox="0 0 48 46">
  <path fill="#863bff" d="M25.946 44.938c-.664.845-2.021.375-2.021-.698V33.937a2.26 2.26 0 0 0-2.262-2.262H10.287c-.92 0-1.456-1.04-.92-1.788l7.48-10.471c1.07-1.497 0-3.578-1.842-3.578H1.237c-.92 0-1.456-1.04-.92-1.788L10.013.474c.214-.297.556-.474.92-.474h28.894c.92 0 1.456 1.04.92 1.788l-7.48 10.471c-1.07 1.498 0 3.579 1.842 3.579h11.377c.943 0 1.473 1.088.89 1.83L25.947 44.94z"/>
</svg>
`)

const BG = '#1B2A2A' // theme_color з vite.config.ts

async function makeIcon(size, logoScale, outFile) {
  const logoSize = Math.round(size * logoScale)
  const logo = await sharp(LOGO_SVG, { density: 384 })
    .ensureAlpha()
    // Без явного прозорого background тут sharp заповнює padding чорним,
    // а не прозорим — і поверх theme_color лишаються чорні смуги.
    .resize(logoSize, logoSize, { fit: 'contain', background: { r: 0, g: 0, b: 0, alpha: 0 } })
    .png()
    .toBuffer()

  await sharp({
    create: { width: size, height: size, channels: 4, background: BG },
  })
    .composite([{ input: logo, gravity: 'center' }])
    .png()
    .toFile(path.join(iconsDir, outFile))

  console.log('  ->', outFile)
}

await makeIcon(192, 0.55, 'icon-192.png')
await makeIcon(512, 0.55, 'icon-512.png')
// Maskable — менший safe-zone (ОС може обрізати кути під форму), тож логотип менший.
await makeIcon(512, 0.4, 'icon-512-maskable.png')

console.log('Готово: public/icons/*.png')
