// Liga bayrog'i — globus emojisi (🌍/🌎/🌏) o'rniga foydalanuvchi bergan
// globus rasmini ko'rsatadi. Vite orqali import qilamiz (hashli URL — kesh muammosisiz).
import globusUrl from '../assets/globus.svg'

const GLOBES = new Set(['🌍', '🌎', '🌏'])

export default function Flag({ value }) {
  if (GLOBES.has(value)) {
    return <img className="flag-globe" src={globusUrl} alt="" aria-hidden="true" />
  }
  return <>{value}</>
}
