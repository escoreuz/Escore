// Liga bayrog'i — globus emojisi (🌍/🌎/🌏) o'rniga foydalanuvchi bergan
// globus rasmini ko'rsatadi. Vite orqali import qilamiz (hashli URL — kesh muammosisiz).
import globusUrl from '../assets/globus.svg'

const GLOBES = new Set(['🌍', '🌎', '🌏'])

// label (mamlakat nomi) berilsa bayroq (emoji yoki globus rasmi) ekran o'quvchiga shu nom bilan o'qiladi,
// aks holda dekorativ.
export default function Flag({ value, label }) {
  if (!value) return null
  if (GLOBES.has(value)) {
    return label ? (
      <img className="flag-globe" src={globusUrl} alt={label} />
    ) : (
      <img className="flag-globe" src={globusUrl} alt="" aria-hidden="true" />
    )
  }
  if (label) {
    return (
      <span role="img" aria-label={label}>
        {value}
      </span>
    )
  }
  return <span aria-hidden="true">{value}</span>
}
