import '@fontsource/press-start-2p'
import '@phosphor-icons/web/bold/style.css'
import './styles.css'
import { inject } from '@vercel/analytics'
import { startGame } from './game/game'

// Inject Vercel Web Analytics
inject()

startGame()
