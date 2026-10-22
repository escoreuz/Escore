// Bo'lim ma'lumoti manbadan kelmagan (meta.unavailable / partial) holat yozuvi.
// O'yinchi, murabbiy va hakam sahifalarida umumiy.

const DEFAULT_TEXT = "Bu bo'lim ma'lumoti hozircha yuklanmadi — manba javob bermadi."

export default function Unavailable({ children = DEFAULT_TEXT }) {
  return (
    <p className="unavailable" role="note">
      {children}
    </p>
  )
}
